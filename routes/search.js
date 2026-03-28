const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const search = express();

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

search.get('/search/:id/:page?', async (req, res) => {
    const searchdetails = req.params.id;
    const pagenumber = parseInt(req.params.page) || 1;

    const cacheKey = `search_${searchdetails}_${pagenumber}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const searchlink     = `https://aniwatchtv.to/search?keyword=${searchdetails}&page=${pagenumber}`;
    const searchlinkNext = `https://aniwatchtv.to/search?keyword=${searchdetails}&page=${pagenumber + 1}`;

    try {
        // Fetch current page AND next page IN PARALLEL — not sequentially
        const [searchmob, nextpageani] = await Promise.all([
            axios.get(searchlink,     { timeout: 12000, headers: { 'User-Agent': USER_AGENT } }),
            axios.get(searchlinkNext, { timeout: 12000, headers: { 'User-Agent': USER_AGENT } }),
        ]);

        const $  = cheerio.load(searchmob.data);
        const $1 = cheerio.load(nextpageani.data);

        const nextpageavailable = $1('.flw-item').length > 0;

        const searchYour = [];
        $('.flw-item').each((i, el) => {
            const href = $(el).find('.film-name a').attr('href') || '';
            searchYour.push({
                name:     $(el).find('.dynamic-name').text(),
                jname:    $(el).find('.dynamic-name').attr('data-jname'),
                format:   $(el).find('.fdi-item:first').text(),
                duration: $(el).find('.fdi-item:eq(1)').text(),
                idanime:  href.split('/')[1]?.split('?')[0] || '',
                sub:      $(el).find('.tick-sub').text(),
                dubani:   $(el).find('.tick-dub').text() || 0,
                totalep:  $(el).find('.tick-eps').text() || false,
                img:      $(el).find('.film-poster img').attr('data-src'),
                pg:       $(el).find('.tick-rate').text() || false,
            });
        });

        const result = { nextpageavailable, searchYour };
        cacheSet(cacheKey, result, 3 * 60 * 1000);
        res.json(result);
    } catch (error) {
        console.error('[search] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = search;
