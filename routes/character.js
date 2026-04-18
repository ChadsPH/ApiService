const express   = require('express');
const axios     = require('axios');
const cheerio   = require('cheerio');

const character = express();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

// ── in-memory cache ──────────────────────────────────────────────────────────
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

/**
 * Extract the numeric AniWatch anime ID from a slug.
 * e.g. "one-piece-100"  → "100"
 *      "naruto-355"     → "355"
 *      "100"            → "100"  (already numeric)
 */
function extractNumericId(slug) {
    if (!slug) return null;
    // If it's already purely numeric, use as-is
    if (/^\d+$/.test(slug)) return slug;
    // Otherwise take the last hyphen-separated segment
    const parts = slug.split('-');
    const last  = parts[parts.length - 1];
    return /^\d+$/.test(last) ? last : null;
}

/**
 * Parse a single .bac-item element into a structured character object.
 * Each item can have multiple voice actors (different languages on the right side).
 */
function parseBacItem($, el) {
    const $el = $(el);

    // ── character (left / ltr side) ──────────────────────────────────────────
    const charImg  = $el.find('.per-info.ltr img').attr('data-src')
                  || $el.find('.per-info.ltr img').attr('src')
                  || null;
    const charName = $el.find('.per-info.ltr .pi-name').text().trim() || null;
    const charRole = $el.find('.per-info.ltr .pi-cast').first().text().trim() || null;

    // ── voice actor(s) (right / rtl side) ───────────────────────────────────
    // AniWatch can stack multiple .per-info.rtl blocks for multi-language VAs
    const voiceActors = [];
    $el.find('.per-info.rtl').each((_, va) => {
        const $va = $(va);
        const name = $va.find('.pi-name').text().trim()
                  || $va.find('h4').text().trim()
                  || null;
        if (!name) return; // skip empty blocks
        voiceActors.push({
            name,
            poster:   $va.find('img').attr('data-src') || $va.find('img').attr('src') || null,
            language: $va.find('.pi-cast').text().trim()
                   || $va.find('span').text().trim()
                   || null,
        });
    });

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
 * GET /api/character/list/:id?page=1
 *
 * :id  — the AniWatch anime slug (e.g. "one-piece-100") or numeric ID ("100")
 * page — page number (default 1)
 *
 * Returns: { results: [...], totalPages: N, page: N }
 */
character.get('/character/list/:id', async (req, res) => {
    const slug = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);

    // Extract the internal numeric anime ID AniWatch uses for its AJAX call
    const numericId = extractNumericId(slug);
    if (!numericId) {
        return res.status(400).json({ error: 'Invalid anime ID — could not extract numeric ID from slug.' });
    }

    const cacheKey = `character_${numericId}_p${page}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        // ── hit AniWatch's AJAX character-list endpoint ──────────────────────
        const { data } = await axios.get(
            `https://aniwatchtv.to/ajax/character/list/${numericId}?page=${page}`,
            {
                timeout: 12000,
                headers: {
                    'User-Agent': USER_AGENT,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `https://aniwatchtv.to/`,
                },
            }
        );

        // The endpoint returns { status: true, html: "...", totalPages: N }
        if (!data || !data.html) {
            return res.status(502).json({ error: 'Empty response from AniWatch character API.' });
        }

        const $          = cheerio.load(data.html);
        const totalPages = parseInt(data.totalPages) || 1;

        const results = [];
        $('.bac-item').each((_, el) => {
            const item = parseBacItem($, el);
            // Only include items that have at least a character name
            if (item.character.name) results.push(item);
        });

        const result = { results, totalPages, page };
        cacheSet(cacheKey, result, 15 * 60 * 1000); // cache 15 min
        res.json(result);

    } catch (error) {
        console.error('[character/list] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch character list.', detail: error.message });
    }
});

module.exports = character;