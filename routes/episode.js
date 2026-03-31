const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const episode = express();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

// ✅ Simple in-memory cache
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

function extractAnimeNumericId(raw) {
    const value = decodeURIComponent(String(raw || '')).trim();
    if (!value) return null;
    const direct = value.match(/^(\d+)$/);
    if (direct) return direct[1];
    // Use trailing numeric token from anime slug, e.g. "title-part-1-20401" -> 20401
    const tail = value.match(/-(\d+)$/);
    if (tail) return tail[1];
    return null;
}

episode.get('/episode/:id', async (req, res) => {
    const episodeanime = extractAnimeNumericId(req.params.id);
    if (!episodeanime) {
        return res.status(400).json({ error: 'Invalid anime id' });
    }

    const cacheKey = `episode_${episodeanime}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ episodetown: cached, cached: true });

    const episodelink = `https://aniwatchtv.to/ajax/v2/episode/list/${episodeanime}`;

    try {
        const episodewanna = await axios.get(episodelink, {
            timeout: 12000,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Encoding': 'gzip, deflate, br',
            },
        });

        const $ = cheerio.load(episodewanna?.data?.html || '');
        const episodetown = [];

        $('.ss-list .ssl-item.ep-item').each((i, el) => {
            const href = $(el).attr('href') || '';
            episodetown.push({
                order: $(el).find('.ssli-order').text().trim(),
                name: $(el).find('.e-dynamic-name').text().trim(),
                epId: href.split('/watch/')[1] || '',
            });
        });

        cacheSet(cacheKey, episodetown, 10 * 60 * 1000); // cache 10 min
        res.json({ episodetown });
    } catch (error) {
        console.error('[episode] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = episode;
