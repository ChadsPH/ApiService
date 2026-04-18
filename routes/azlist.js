const express  = require('express');
const axios    = require('axios');
const cheerio  = require('cheerio');

const azlist = express();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

// ── in-memory cache ───────────────────────────────────────────────────────────
const cache = new Map();
function cacheGet(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) { cache.delete(key); return null; }
    return entry.value;
}
function cacheSet(key, value, ttlMs) {
    cache.set(key, { value, expiry: Date.now() + ttlMs });
}

// ── Valid letter tokens (path segments used by AniWatch) ──────────────────────
//   #     → /az-list/other
//   0-9   → /az-list/0-9
//   A-Z   → /az-list/A … /az-list/Z
const VALID_LETTERS = new Set([
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
    '0-9', 'OTHER',
]);

/**
 * Normalise the raw letter value from the request.
 * Returns: canonical path segment string | null (= All) | undefined (= invalid)
 */
function normaliseLetter(raw) {
    if (!raw) return null;
    const u = raw.toUpperCase().trim();
    if (u === '' || u === 'ALL') return null;
    if (u === '#' || u === 'OTHER') return 'other';   // → /az-list/other
    if (u === '0' || u === '0-9')  return '0-9';      // → /az-list/0-9
    if (VALID_LETTERS.has(u))      return u;           // A-Z
    return undefined; // invalid
}

/**
 * Build the AniWatch az-list URL using the correct PATH-based format.
 *
 *   All     → https://aniwatchtv.to/az-list?page=1
 *   Letter  → https://aniwatchtv.to/az-list/A?page=2
 *   Numbers → https://aniwatchtv.to/az-list/0-9?page=1
 *   Symbols → https://aniwatchtv.to/az-list/other?page=1
 */
function buildUrl(letter, page) {
    const base = letter
        ? `https://aniwatchtv.to/az-list/${letter}`
        : 'https://aniwatchtv.to/az-list';
    return `${base}?page=${page}`;
}

/**
 * Parse .flw-item cards from a loaded cheerio instance.
 */
function parseItems($) {
    const items = [];
    $('.flw-item').each((_, el) => {
        const href = $(el).find('.film-poster a').attr('href') || '';
        items.push({
            name:     $(el).find('.dynamic-name').text().trim()       || null,
            jname:    $(el).find('.dynamic-name').attr('data-jname')  || null,
            id:       href.split('/')[1]?.split('?')[0]               || null,
            image:    $(el).find('.film-poster img').attr('data-src') || null,
            format:   $(el).find('.fdi-item:first').text().trim()     || null,
            duration: $(el).find('.fdi-item:eq(1)').text().trim()     || null,
            rating:   $(el).find('.tick-rate').text().trim()          || null,
            sub:      $(el).find('.tick-sub').text().trim()           || null,
            dub:      $(el).find('.tick-dub').text().trim()           || null,
            totalEp:  $(el).find('.tick-eps').text().trim()           || null,
        });
    });
    return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/az-list                   → all letters, page 1
// GET /api/az-list?letter=A&page=2   → query-string style
// GET /api/az-list/:letter           → /api/az-list/A
// GET /api/az-list/:letter/:page     → /api/az-list/A/2
//
// letter  — A-Z | 0-9 | other | # (case-insensitive); omit for All
// page    — page number (default 1)
//
// Response: { letter, page, totalPages, hasNextPage, availableLetters?, items }
// ─────────────────────────────────────────────────────────────────────────────
async function handleAzList(req, res) {
    const rawLetter = req.params.letter || req.query.letter || '';
    const letter    = normaliseLetter(rawLetter);
    const page      = Math.max(1, parseInt(req.params.page || req.query.page) || 1);

    if (letter === undefined) {
        return res.status(400).json({
            error: `Invalid letter "${rawLetter}". Use A-Z, "0-9", "other"/"#", or omit for all.`,
            valid: [...VALID_LETTERS],
        });
    }

    const cacheKey = `azlist_${letter || 'ALL'}_p${page}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const url     = buildUrl(letter, page);
    const urlNext = buildUrl(letter, page + 1);

    try {
        const [pageRes, nextRes] = await Promise.all([
            axios.get(url,     { timeout: 12000, headers: { 'User-Agent': USER_AGENT } }),
            axios.get(urlNext, { timeout: 12000, headers: { 'User-Agent': USER_AGENT } }),
        ]);

        const $     = cheerio.load(pageRes.data);
        const $next = cheerio.load(nextRes.data);

        // Total pages from the pagination bar
        let totalPages = page;
        $('.pagination .page-item a.page-link').each((_, el) => {
            const n = parseInt($(el).text().trim());
            if (!isNaN(n) && n > totalPages) totalPages = n;
        });

        const hasNextPage = $next('.flw-item').length > 0;
        if (hasNextPage && page + 1 > totalPages) totalPages = page + 1;

        // Available letters from sidebar links
        const availableLetters = [];
        $('a[href*="/az-list"]').each((_, el) => {
            const label = $(el).text().trim();
            if (label && !availableLetters.includes(label)) availableLetters.push(label);
        });

        const items  = parseItems($);
        const result = {
            letter:     letter ? letter.toUpperCase() : 'ALL',
            page,
            totalPages,
            hasNextPage,
            items,
        };
        if (availableLetters.length) result.availableLetters = availableLetters;

        cacheSet(cacheKey, result, 10 * 60 * 1000);
        res.json(result);

    } catch (error) {
        console.error('[az-list] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/az-list/all/:letter?
//   Returns ALL pages for a letter combined into one response.
//   Response: { letter, totalPages, totalItems, items }
// ─────────────────────────────────────────────────────────────────────────────
azlist.get('/az-list/all/:letter?', async (req, res) => {
    const rawLetter = req.params.letter || req.query.letter || '';
    const letter    = normaliseLetter(rawLetter);

    if (letter === undefined) {
        return res.status(400).json({
            error: `Invalid letter "${rawLetter}". Use A-Z, "0-9", "other"/"#", or omit for all.`,
            valid: [...VALID_LETTERS],
        });
    }

    const cacheKey = `azlist_all_${letter || 'ALL'}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const { data: firstHtml } = await axios.get(buildUrl(letter, 1), {
            timeout: 12000,
            headers: { 'User-Agent': USER_AGENT },
        });

        const $first = cheerio.load(firstHtml);
        let totalPages = 1;
        $first('.pagination .page-item a.page-link').each((_, el) => {
            const n = parseInt($first(el).text().trim());
            if (!isNaN(n) && n > totalPages) totalPages = n;
        });

        let allItems = parseItems($first);

        if (totalPages > 1) {
            const rest = await Promise.all(
                Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(p =>
                    axios.get(buildUrl(letter, p), {
                        timeout: 12000,
                        headers: { 'User-Agent': USER_AGENT },
                    })
                    .then(r => parseItems(cheerio.load(r.data)))
                    .catch(() => [])
                )
            );
            for (const pageItems of rest) allItems = allItems.concat(pageItems);
        }

        const result = {
            letter:     letter ? letter.toUpperCase() : 'ALL',
            totalPages,
            totalItems: allItems.length,
            items:      allItems,
        };

        cacheSet(cacheKey, result, 30 * 60 * 1000);
        res.json(result);

    } catch (error) {
        console.error('[az-list/all] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
});

// Single-page routes
azlist.get('/az-list/:letter/:page', handleAzList);
azlist.get('/az-list/:letter',       handleAzList);
azlist.get('/az-list',               handleAzList);

module.exports = azlist;
