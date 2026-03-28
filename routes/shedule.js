const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const shedule = express();

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

shedule.get('/shedule/:id', async (req, res) => {
    const date = req.params.id;

    const cacheKey = `shedule_${date}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const { data } = await axios.get(
            `https://aniwatchtv.to/ajax/schedule/list?tzOffset=-330&date=${date}`,
            {
                timeout: 12000,
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept-Encoding': 'gzip, deflate, br',
                },
            }
        );

        const $ = cheerio.load(data?.html || '');
        const Sheduletoday = [];

        $('li').each((i, el) => {
            Sheduletoday.push({
                name:      $(el).find('.dynamic-name').text(),
                jname:     $(el).find('.dynamic-name').attr('data-jname'),
                time:      $(el).find('.time').text(),
                epshedule: $(el).find('.btn').text().trim(),
            });
        });

        const result = { Sheduletoday };
        cacheSet(cacheKey, result, 60 * 60 * 1000); // cache 1 hour — schedule doesn't change often
        res.json(result);
    } catch (error) {
        console.error('[shedule] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = shedule;
