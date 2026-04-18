const express = require('express');
const axios   = require('axios');
const cheerio = require('cheerio');

const character = express();

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

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the numeric AniWatch anime ID from a slug.
 *   "one-piece-100"  → "100"
 *   "naruto-355"     → "355"
 *   "100"            → "100"  (already numeric)
 */
function extractNumericId(slug) {
    if (!slug) return null;
    if (/^\d+$/.test(slug)) return slug;
    const parts = slug.split('-');
    const last  = parts[parts.length - 1];
    return /^\d+$/.test(last) ? last : null;
}

/**
 * Parse a single .bac-item element into a fully-structured character object.
 *
 * AniWatch uses two layouts depending on the character entry:
 *   Layout A: .per-info.ltr  (character)  +  .per-info.rtl  (VA)
 *   Layout B: .per-info.ltr  (character)  +  .per-info       (VA, no rtl class)
 *
 * We try every known pattern so nothing gets missed.
 */
function parseBacItem($, el) {
    const $el = $(el);

    // ── character (left / ltr side) ──────────────────────────────────────────
    const $ltr    = $el.find('.per-info.ltr').first();
    const charImg  = $ltr.find('img').attr('data-src')
                  || $ltr.find('img').attr('src')
                  || null;
    const charName = $ltr.find('.pi-name').text().trim()
                  || $ltr.find('h4, a').first().text().trim()
                  || null;
    const charRole = $ltr.find('.pi-cast').first().text().trim()
                  || $ltr.find('span').first().text().trim()
                  || null;

    if (!charName) return null;

    // ── voice actor(s) (right side) ───────────────────────────────────────────
    // AniWatch sometimes uses .per-info.rtl, sometimes just .per-info (no rtl),
    // and sometimes stacks multiple blocks for Japanese + English VAs.
    // Strategy: collect every .per-info block that is NOT the ltr/character side.
    const voiceActors = [];
    const seen        = new Set();

    // Pass 1: explicit .rtl blocks (most reliable)
    $el.find('.per-info.rtl').each((_, va) => {
        const $va = $(va);
        const name = $va.find('.pi-name').text().trim()
                  || $va.find('h4').text().trim()
                  || $va.find('a').first().text().trim()
                  || null;
        if (!name || seen.has(name)) return;
        seen.add(name);

        const language = $va.find('.pi-cast').text().trim()
                      || $va.find('span').first().text().trim()
                      || null;

        voiceActors.push({
            name,
            poster:   $va.find('img').attr('data-src') || $va.find('img').attr('src') || null,
            language: language || null,
        });
    });

    // Pass 2: any remaining .per-info blocks that are NOT the ltr block
    // (catches the layout where rtl class is missing)
    if (voiceActors.length === 0) {
        $el.find('.per-info').each((_, block) => {
            const $block = $(block);
            if ($block.hasClass('ltr')) return; // skip character side

            const name = $block.find('.pi-name').text().trim()
                      || $block.find('h4').text().trim()
                      || $block.find('a').first().text().trim()
                      || null;
            if (!name || seen.has(name)) return;
            seen.add(name);

            const language = $block.find('.pi-cast').text().trim()
                          || $block.find('span').first().text().trim()
                          || null;

            voiceActors.push({
                name,
                poster:   $block.find('img').attr('data-src') || $block.find('img').attr('src') || null,
                language: language || null,
            });
        });
    }

    // Pass 3: last-resort — any .pi-name that is NOT the character's own name
    if (voiceActors.length === 0) {
        $el.find('.pi-name').each((i, nameEl) => {
            if (i === 0) return; // first .pi-name is always the character
            const name = $(nameEl).text().trim();
            if (!name || seen.has(name)) return;
            seen.add(name);

            const $parent  = $(nameEl).closest('.per-info, .bac-item-right, div');
            const language = $parent.find('.pi-cast, span').first().text().trim() || null;

            voiceActors.push({
                name,
                poster:   $parent.find('img').attr('data-src') || $parent.find('img').attr('src') || null,
                language: language || null,
            });
        });
    }

    return {
        character: {
            name:   charName,
            poster: charImg,
            role:   charRole,
        },
        voiceActors,
    };
}

/**
 * Fetch a single page from AniWatch's character AJAX endpoint.
 * Returns { items: [...], totalPages: N }
 */
async function fetchCharacterPage(numericId, page) {
    const { data } = await axios.get(
        `https://aniwatchtv.to/ajax/character/list/${numericId}?page=${page}`,
        {
            timeout: 12000,
            headers: {
                'User-Agent':       USER_AGENT,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer':          'https://aniwatchtv.to/',
            },
        }
    );

    if (!data || !data.html) {
        throw new Error(`Empty response from AniWatch character API (page ${page})`);
    }

    const $          = cheerio.load(data.html);
    const totalPages = parseInt(data.totalPages) || 1;

    const items = [];
    $('.bac-item').each((_, el) => {
        const parsed = parseBacItem($, el);
        if (parsed) items.push(parsed);
    });

    return { items, totalPages };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/character/list/:id?page=1
//
//   Returns a SINGLE PAGE of characters & voice actors.
//   :id  — AniWatch anime slug (e.g. "one-piece-100") or plain numeric ID
//   page — page number (default 1)
//
//   Response: { results: [...], totalPages, page }
// ─────────────────────────────────────────────────────────────────────────────
character.get('/character/list/:id', async (req, res) => {
    const slug      = req.params.id;
    const page      = Math.max(1, parseInt(req.query.page) || 1);
    const numericId = extractNumericId(slug);

    if (!numericId) {
        return res.status(400).json({
            error: 'Invalid anime ID — could not extract numeric ID from slug.',
        });
    }

    const cacheKey = `character_${numericId}_p${page}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const { items, totalPages } = await fetchCharacterPage(numericId, page);
        const result = { results: items, totalPages, page };
        cacheSet(cacheKey, result, 15 * 60 * 1000);
        res.json(result);
    } catch (error) {
        console.error('[character/list] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch character list.', detail: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/character/all/:id
//
//   Fetches EVERY PAGE of characters & voice actors for an anime and
//   returns them all combined in a single response.
//
//   :id — AniWatch anime slug or plain numeric ID
//
//   Response:
//   {
//     animeId:    "100",
//     totalPages: 3,
//     total:      120,
//     results: [
//       {
//         character:   { name, poster, role },
//         voiceActors: [ { name, poster, language }, ... ]
//       },
//       ...
//     ]
//   }
// ─────────────────────────────────────────────────────────────────────────────
character.get('/character/all/:id', async (req, res) => {
    const slug      = req.params.id;
    const numericId = extractNumericId(slug);

    if (!numericId) {
        return res.status(400).json({
            error: 'Invalid anime ID — could not extract numeric ID from slug.',
        });
    }

    const cacheKey = `character_all_${numericId}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        // ── Step 1: fetch page 1 to discover totalPages ───────────────────
        const first      = await fetchCharacterPage(numericId, 1);
        let   allItems   = [...first.items];
        const totalPages = first.totalPages;

        // ── Step 2: fetch remaining pages in parallel ─────────────────────
        if (totalPages > 1) {
            const pageNums    = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
            const pageResults = await Promise.all(
                pageNums.map(p =>
                    fetchCharacterPage(numericId, p)
                        .then(r => r.items)
                        .catch(err => {
                            console.warn(`[character/all] page ${p} failed: ${err.message}`);
                            return [];
                        })
                )
            );
            for (const pageItems of pageResults) allItems = allItems.concat(pageItems);
        }

        const result = {
            animeId:    numericId,
            totalPages,
            total:      allItems.length,
            results:    allItems,
        };

        cacheSet(cacheKey, result, 15 * 60 * 1000);
        res.json(result);

    } catch (error) {
        console.error('[character/all] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch all characters.', detail: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/character/search?id=one-piece-100&name=Nami
//
//   Searches through a given anime's characters by name (case-insensitive).
//   Matches both character names and voice actor names.
//
//   Query params:
//     id   — (required) anime slug or numeric ID
//     name — (required) search term
//
//   Response: { animeId, query, total, results: [...] }
// ─────────────────────────────────────────────────────────────────────────────
character.get('/character/search', async (req, res) => {
    const slug  = req.query.id   || '';
    const query = req.query.name || '';

    if (!slug)  return res.status(400).json({ error: 'Query param "id" is required.' });
    if (!query) return res.status(400).json({ error: 'Query param "name" is required.' });

    const numericId = extractNumericId(slug);
    if (!numericId) return res.status(400).json({ error: 'Invalid anime ID.' });

    try {
        const allKey    = `character_all_${numericId}`;
        let   allResult = cacheGet(allKey);

        if (!allResult) {
            const first      = await fetchCharacterPage(numericId, 1);
            let   allItems   = [...first.items];
            const totalPages = first.totalPages;

            if (totalPages > 1) {
                const rest = await Promise.all(
                    Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(p =>
                        fetchCharacterPage(numericId, p).then(r => r.items).catch(() => [])
                    )
                );
                for (const items of rest) allItems = allItems.concat(items);
            }

            allResult = { animeId: numericId, totalPages, total: allItems.length, results: allItems };
            cacheSet(allKey, allResult, 15 * 60 * 1000);
        }

        const lowerQuery = query.toLowerCase();
        const filtered   = allResult.results.filter(item =>
            item.character.name?.toLowerCase().includes(lowerQuery) ||
            item.voiceActors.some(va => va.name?.toLowerCase().includes(lowerQuery))
        );

        res.json({
            animeId: numericId,
            query,
            total:   filtered.length,
            results: filtered,
        });
    } catch (error) {
        console.error('[character/search] Error:', error.message);
        res.status(500).json({ error: 'Failed to search characters.', detail: error.message });
    }
});

module.exports = character;
