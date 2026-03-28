const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const genre = express();

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

genre.get('/genre/:id/:page?', async (req, res) => {
    const genreneed = req.params.id;
    const pagenumber = parseInt(req.params.page) || 1;

    const cacheKey = `genre_${genreneed}_${pagenumber}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const genrelink     = `https://aniwatchtv.to/genre/${genreneed}?page=${pagenumber}`;
    const genrelinkNext = `https://aniwatchtv.to/genre/${genreneed}?page=${pagenumber + 1}`;

    try {
        // Fetch current page AND next page IN PARALLEL
        const [genreone, nextpageani] = await Promise.all([
            axios.get(genrelink,     { timeout: 12000, headers: { 'User-Agent': USER_AGENT } }),
            axios.get(genrelinkNext, { timeout: 12000, headers: { 'User-Agent': USER_AGENT } }),
        ]);

        const $  = cheerio.load(genreone.data);
        const $1 = cheerio.load(nextpageani.data);

        const nextpageavai = $1('.flw-item').length > 0;
        const genrey = $('.block_area_category').find('.cat-heading').text();

        const genreX = [];
        $('.flw-item').each((i, el) => {
            const href = $(el).find('.film-poster a').attr('href') || '';
            genreX.push({
                name:      $(el).find('.dynamic-name').text(),
                jname:     $(el).find('.dynamic-name').attr('data-jname'),
                format:    $(el).find('.fdi-item:first').text(),
                duration:  $(el).find('.fdi-item:eq(1)').text(),
                sub:       $(el).find('.tick-sub').text(),
                dubXanime: $(el).find('.tick-dub').text() || false,
                totalepX:  $(el).find('.tick-eps').text() || false,
                descX:     $(el).find('.description').text().trim() || false,
                imageX:    $(el).find('.film-poster img').attr('data-src'),
                idX:       href.split('/')[1] || '',
            });
        });

        const result = { genrey, nextpageavai, genreX };
        cacheSet(cacheKey, result, 5 * 60 * 1000);
        res.json(result);
    } catch (error) {
        console.error('[genre] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = genre;
