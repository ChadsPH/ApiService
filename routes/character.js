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

function extractNumericId(slug) {
    if (!slug) return null;
    if (/^\d+$/.test(slug)) return slug;
    const parts = slug.split('-');
    const last  = parts[parts.length - 1];
    return /^\d+$/.test(last) ? last : null;
}

async function fetchAniwatch(numericId, page) {
    const { data } = await axios.get(
        `https://aniwatchtv.to/ajax/character/list/${numericId}?page=${page}`,
        {
            timeout: 12000,
            headers: {
                'User-Agent': USER_AGENT,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://aniwatchtv.to/',
            },
        }
    );
    return data;
}

/**
 * Parse a single .bac-item element.
 * Tries multiple selector strategies to handle AniWatch HTML variations.
 */
function parseBacItem($, el) {
    const $el = $(el);

    // ── CHARACTER (ltr side) ─────────────────────────────────────────────────
    const $ltr    = $el.find('.per-info.ltr');
    const charImg = $ltr.find('img').attr('data-src') || $ltr.find('img').attr('src') || null;

    // name: try .pi-name first, then any h4, then any anchor text
    const charName = $ltr.find('.pi-name').text().trim()
                  || $ltr.find('h4').text().trim()
                  || $ltr.find('a[href*="/character"]').text().trim()
                  || null;

    // role: try .pi-cast, then span
    const charRole = $ltr.find('.pi-cast').first().text().trim()
                  || $ltr.find('span').first().text().trim()
                  || null;

    // ── VOICE ACTORS (rtl side) ──────────────────────────────────────────────
    const voiceActors = [];

    // Strategy 1: iterate each .per-info.rtl block (one block per language)
    $el.find('.per-info.rtl').each((_, vaEl) => {
        const $va = $(vaEl);

        const name = $va.find('.pi-name').text().trim()
                  || $va.find('h4').text().trim()
                  || $va.find('a[href*="/people"]').text().trim()
                  || $va.find('a').first().text().trim()
                  || null;

        if (!name) return;

        const language = $va.find('.pi-cast').text().trim()
                      || $va.find('span').first().text().trim()
                      || null;

        const poster = $va.find('img').attr('data-src')
                    || $va.find('img').attr('src')
                    || null;

        voiceActors.push({ name, poster, language });
    });

    // Strategy 2: if no VAs found yet, try direct h4 siblings inside the item
    // (some AniWatch versions put all VAs inline without .per-info.rtl wrappers)
    if (voiceActors.length === 0) {
        // Look for any h4 NOT inside .per-info.ltr (those belong to the character)
        $el.find('h4').each((_, h4El) => {
            if ($ltr.find(h4El).length > 0) return; // skip character's own h4
            const $h4   = $(h4El);
            const name  = $h4.text().trim();
            if (!name) return;
            const $wrap = $h4.closest('[class]');
            const lang  = $wrap.find('span').first().text().trim() || null;
            const img   = $wrap.find('img').attr('data-src') || $wrap.find('img').attr('src') || null;
            voiceActors.push({ name, poster: img, language: lang });
        });
    }

    return {
        character: { name: charName, poster: charImg, role: charRole },
        voiceActors,
    };
}

// ── DEBUG: returns raw HTML of the first bac-item so you can inspect selectors
character.get('/character/debug/:id', async (req, res) => {
    const numericId = extractNumericId(req.params.id);
    if (!numericId) return res.status(400).json({ error: 'Invalid ID' });

    try {
        const data = await fetchAniwatch(numericId, 1);
        if (!data?.html) return res.json({ raw: null, note: 'No html field in response', data });

        const $     = cheerio.load(data.html);
        const items = [];

        $('.bac-item').each((i, el) => {
            if (i >= 2) return false; // only first 2 items for debugging
            items.push({
                index:      i,
                outerHTML:  $(el).prop('outerHTML'),
                parsed:     parseBacItem($, el),
            });
        });

        res.json({ totalPages: data.totalPages, itemCount: $('.bac-item').length, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── MAIN: GET /api/character/list/:id?page=1
character.get('/character/list/:id', async (req, res) => {
    const slug = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);

    const numericId = extractNumericId(slug);
    if (!numericId) {
        return res.status(400).json({ error: 'Invalid anime ID.' });
    }

    const cacheKey = `character_${numericId}_p${page}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const data = await fetchAniwatch(numericId, page);

        if (!data || !data.html) {
            return res.status(502).json({ error: 'Empty response from AniWatch.', raw: data });
        }

        const $          = cheerio.load(data.html);
        const totalPages = parseInt(data.totalPages) || 1;

        const results = [];
        $('.bac-item').each((_, el) => {
            const item = parseBacItem($, el);
            if (item.character.name) results.push(item);
        });

        const result = { results, totalPages, page };
        cacheSet(cacheKey, result, 15 * 60 * 1000);
        res.json(result);

    } catch (error) {
        console.error('[character/list] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch character list.', detail: error.message });
    }
});

module.exports = character;
