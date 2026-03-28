const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const server = express();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

// ✅ Simple in-memory cache shared across routes
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

server.get('/server/:id', async (req, res) => {
    const serverour = req.params.id.match(/\d+/);
    if (!serverour) return res.status(400).json({ error: 'Invalid episode id' });

    const cacheKey = `server_${serverour[0]}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const serverlink = `https://aniwatchtv.to/ajax/v2/episode/servers?episodeId=${serverour}`;

    try {
        const serverdefine = await axios.get(serverlink, {
            timeout: 12000,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Encoding': 'gzip, deflate, br',
            },
        });

        const $ = cheerio.load(serverdefine?.data?.html || '');
        const sub = [];
        const dub = [];

        $('.ps_-block.ps_-block-sub.servers-sub .ps__-list .server-item').each((i, el) => {
            sub.push({
                server: $(el).find('a').text().toLowerCase().trim(),
                id: $(el).attr('data-server-id')?.trim(),
                srcId: $(el).attr('data-id')?.trim(),
            });
        });

        $('.ps_-block.ps_-block-sub.servers-dub .ps__-list .server-item').each((i, el) => {
            dub.push({
                server: $(el).find('a').text().toLowerCase().trim(),
                id: $(el).attr('data-server-id')?.trim(),
                srcId: $(el).attr('data-id')?.trim(),
            });
        });

        const result = { sub, dub };
        cacheSet(cacheKey, result, 3 * 60 * 1000); // cache 3 min
        res.json(result);
    } catch (error) {
        console.error('[server] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = server;
