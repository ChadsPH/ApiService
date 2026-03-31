const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

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

app.get('/parse', async (req, res) => {
    const cached = cacheGet('homepage');
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const response = await axios.get('https://aniwatchtv.to/home', {
            timeout: 12000,
            headers: { 'User-Agent': USER_AGENT },
        });

        const $ = cheerio.load(response.data);

        const slides = [];
        $('.deslide-item').each((i, el) => {
            const animeIdHref = $(el).find('.desi-buttons a:eq(1)').attr('href') || '';
            slides.push({
                name: $(el).find('.dynamic-name').text(),
                jname: $(el).find('.dynamic-name').attr('data-jname'),
                spotlight: $(el).find('.desi-sub-text').text(),
                imageAnime: $(el).find('.deslide-cover-img img').attr('data-src'),
                format: $(el).find('.sc-detail .scd-item:first').text().trim(),
                duration: $(el).find('.sc-detail .scd-item:eq(1)').text().trim(),
                release: $(el).find('.sc-detail .scd-item:eq(2)').text().trim(),
                quality: $(el).find('.sc-detail .scd-item:eq(3)').text().trim(),
                animeId: animeIdHref.split('/')[1] || '',
                anidesc: $(el).find('.desi-description').text().trim(),
            });
        });

        const trend = [];
        $('.swiper-slide.item-qtip').each((i, el) => {
            const href = $(el).find('.item a').attr('href') || '';
            trend.push({
                name: $(el).find('.dynamic-name').text(),
                jname: $(el).find('.dynamic-name').attr('data-jname'),
                ranking: $(el).find('.number span').text(),
                imgAni: $(el).find('.film-poster img').attr('data-src'),
                iD: href.split('/')[1] || '',
            });
        });

        const UpcomingAnime = [];
        $('.flw-item').each((i, el) => {
            const href = $(el).find('.film-name a').attr('href') || '';
            UpcomingAnime.push({
                name: $(el).find('.dynamic-name').text(),
                jname: $(el).find('.dynamic-name').attr('data-jname'),
                format: $(el).find('.fdi-item:first').text(),
                release: $(el).find('.fdi-item.fdi-duration').text(),
                idani: href.split('/')[1] || '',
                imgAnime: $(el).find('.film-poster img').attr('data-src'),
            });
        });

        const result = { slides, trend, UpcomingAnime };
        cacheSet('homepage', result, 5 * 60 * 1000); // cache 5 min
        res.json(result);
    } catch (error) {
        console.error('[parse] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = app;
