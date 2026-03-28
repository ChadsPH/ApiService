const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const mix = express();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

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

mix.get('/mix/:id/:page?', async (req, res) => {
    const mixid = req.params.id;
    const pagenumber = parseInt(req.params.page) || 1;

    const cacheKey = `mix_${mixid}_${pagenumber}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const mixlink     = `https://aniwatchtv.to/${mixid}?page=${pagenumber}`;
    const mixlinkNext = `https://aniwatchtv.to/${mixid}?page=${pagenumber + 1}`;

    try {
        // Fetch current page AND next page IN PARALLEL
        const [mixanime, nextpageani] = await Promise.all([
            axios.get(mixlink,     { timeout: 12000, headers: { 'User-Agent': USER_AGENT } }),
            axios.get(mixlinkNext, { timeout: 12000, headers: { 'User-Agent': USER_AGENT } }),
        ]);

        const $  = cheerio.load(mixanime.data);
        const $1 = cheerio.load(nextpageani.data);

        const nextpageavai = $1('.flw-item').length > 0;

        const mixAni = [];
        $('.flw-item').each((i, el) => {
            const href = $(el).find('.film-name a').attr('href') || '';
            mixAni.push({
                name:     $(el).find('.dynamic-name').text(),
                jname:    $(el).find('.dynamic-name').attr('data-jname'),
                format:   $(el).find('.fdi-item:first').text(),
                duration: $(el).find('.fdi-item:eq(1)').text(),
                idanime:  href.split('/')[1]?.split('?')[0] || '',
                sub:      $(el).find('.tick-sub').text(),
                dubani:   $(el).find('.tick-dub').text() || false,
                totalep:  $(el).find('.tick-eps').text() || false,
                img:      $(el).find('.film-poster img').attr('data-src'),
                pg:       $(el).find('.tick-rate').text() || false,
            });
        });

        const result = { nextpageavai, mixAni };
        cacheSet(cacheKey, result, 5 * 60 * 1000);
        res.json(result);
    } catch (error) {
        console.error('[mix] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = mix;
