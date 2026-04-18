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

// Valid letter tokens AniWatch accepts
const VALID_LETTERS = new Set([
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
    '0',  // AniWatch uses "0" for numbers/symbols
]);

/**
 * Parse .flw-item cards from a loaded cheerio instance.
 */
function parseItems($) {
    const items = [];
    $('.flw-item').each((_, el) => {
        const href = $(el).find('.film-poster a').attr('href') || '';
        items.push({
            name:     $(el).find('.dynamic-name').text().trim()   || null,
            jname:    $(el).find('.dynamic-name').attr('data-jname') || null,
            id:       href.split('/')[1]?.split('?')[0]           || null,
            image:    $(el).find('.film-poster img').attr('data-src') || null,
            format:   $(el).find('.fdi-item:first').text().trim() || null,
            duration: $(el).find('.fdi-item:eq(1)').text().trim() || null,
            sub:      $(el).find('.tick-sub').text().trim()        || null,
            dub:      $(el).find('.tick-dub').text().trim()        || null,
            totalEp:  $(el).find('.tick-eps').text().trim()        || null,
        });
    });
    return items;
}

/**
 * Build the AniWatch az-list URL.
 * letter=null → no letter filter (returns everything, sorted A-Z)
 */
function buildUrl(letter, page) {
    const base = 'https://aniwatchtv.to/az-list';
    const params = new URLSearchParams();
    if (letter) params.set('letter', letter.toUpperCase());
    params.set('page', String(page));
    return `${base}?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/az-list
//   Optional query params: ?letter=A  ?page=2
//
// GET /api/az-list/:letter
// GET /api/az-list/:letter/:page
//
// letter  — single A-Z letter, or "0" for numbers/symbols (case-insensitive)
// page    — page number (default 1)
//
// Returns:
//   { letter, page, totalPages, hasNextPage, items: [...] }
// ─────────────────────────────────────────────────────────────────────────────
async function handleAzList(req, res) {
    // Support both path params and query params
    const rawLetter = (req.params.letter || req.query.letter || '').toUpperCase().trim();
    const letter    = rawLetter === '' ? null : rawLetter;
    const page      = Math.max(1, parseInt(req.params.page || req.query.page) || 1);

    // Validate letter
    if (letter !== null && !VALID_LETTERS.has(letter)) {
        return res.status(400).json({
            error: `Invalid letter "${letter}". Use A-Z or "0" for numbers/symbols.`,
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

        // Total pages — AniWatch renders pagination with class .page-link
        // Try to read the last page number from the pagination bar
        let totalPages = page; // fallback: current page at minimum
        $('.pagination .page-item a.page-link').each((_, el) => {
            const n = parseInt($( el).text().trim());
            if (!isNaN(n) && n > totalPages) totalPages = n;
        });

        const hasNextPage = $next('.flw-item').length > 0;
        if (hasNextPage && page + 1 > totalPages) totalPages = page + 1;

        // Available letters from the sidebar (so clients know which letters have content)
        const availableLetters = [];
        $('.az-list-letter a').each((_, el) => {
            const l = $(el).text().trim();
            if (l) availableLetters.push(l.toUpperCase());
        });

        const items = parseItems($);

        const result = { letter: letter || 'ALL', page, totalPages, hasNextPage, items };
        if (availableLetters.length) result.availableLetters = availableLetters;

        cacheSet(cacheKey, result, 10 * 60 * 1000); // cache 10 min
        res.json(result);

    } catch (error) {
        console.error('[az-list] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/az-list/all/:letter
//   Fetches ALL pages for a given letter (or all letters if omitted) and
//   returns a combined list. Use with caution on large letters like "S".
//
// Returns:
//   { letter, totalPages, totalItems, items: [...] }
// ─────────────────────────────────────────────────────────────────────────────
azlist.get('/az-list/all/:letter?', async (req, res) => {
    const rawLetter = (req.params.letter || req.query.letter || '').toUpperCase().trim();
    const letter    = rawLetter === '' ? null : rawLetter;

    if (letter !== null && !VALID_LETTERS.has(letter)) {
        return res.status(400).json({
            error: `Invalid letter "${letter}". Use A-Z or "0".`,
            valid: [...VALID_LETTERS],
        });
    }

    const cacheKey = `azlist_all_${letter || 'ALL'}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        // ── Step 1: fetch page 1 to learn totalPages ──────────────────────
        const firstUrl = buildUrl(letter, 1);
        const { data: firstHtml } = await axios.get(firstUrl, {
            timeout: 12000,
            headers: { 'User-Agent': USER_AGENT },
        });

        const $first = cheerio.load(firstHtml);

        let totalPages = 1;
        $first('.pagination .page-item a.page-link').each((_, el) => {
            const n = parseInt($first(el).text().trim());
            if (!isNaN(n) && n > totalPages) totalPages = n;
        });

        // If only 1 page just return it
        let allItems = parseItems($first);

        if (totalPages > 1) {
            // ── Step 2: fetch remaining pages in parallel ──────────────────
            const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
            const pageRequests = pageNums.map(p =>
                axios.get(buildUrl(letter, p), {
                    timeout: 12000,
                    headers: { 'User-Agent': USER_AGENT },
                }).then(r => parseItems(cheerio.load(r.data)))
                  .catch(() => []) // don't let one page failure kill the whole request
            );

            const restPages = await Promise.all(pageRequests);
            for (const pageItems of restPages) allItems = allItems.concat(pageItems);
        }

        const result = {
            letter:     letter || 'ALL',
            totalPages,
            totalItems: allItems.length,
            items:      allItems,
        };

        cacheSet(cacheKey, result, 30 * 60 * 1000); // cache 30 min — full lists change rarely
        res.json(result);

    } catch (error) {
        console.error('[az-list/all] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
});

// Single-page route (with optional letter / page path params)
azlist.get('/az-list/:letter/:page', handleAzList);
azlist.get('/az-list/:letter',       handleAzList);
azlist.get('/az-list',               handleAzList);

module.exports = azlist;
