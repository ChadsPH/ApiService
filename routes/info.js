const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const info = express();

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

info.get('/related/:id', async (req, res) => {
    const animeinfo = req.params.id;

    const cacheKey = `info_${animeinfo}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const { data } = await axios.get(`https://aniwatchtv.to/${animeinfo}`, {
            timeout: 12000,
            headers: { 'User-Agent': USER_AGENT },
        });

        const $ = cheerio.load(data);
        const infoX = [];

        $('.anis-content').each((i, el) => {
            const href = $(el).find('.film-buttons a').attr('href') || '';
            infoX.push({
                name:     $(el).find('.film-name.dynamic-name').text(),
                jname:    $(el).find('.dynamic-name').attr('data-jname'),
                pganime:  $(el).find('.tick-pg').text(),
                quality:  $(el).find('.tick-quality').text(),
                epsub:    $(el).find('.tick-sub').text(),
                epdub:    $(el).find('.tick-dub').text() || false,
                totalep:  $(el).find('.tick-eps').text() || false,
                format:   $(el).find('.item:eq(0)').text(),
                duration: $(el).find('.item:eq(1)').text(),
                desc:     $(el).find('.text').text().trim(),
                id:       href.split('/watch/')[1] || '',
                image:    $(el).find('.film-poster img').attr('src'),
            });
        });

        $('.anisc-info').each((i, el) => {
            infoX.push({
                japanese:    $(el).find('.name:eq(0)').text(),
                aired:       $(el).find('.name:eq(2)').text(),
                premired:    $(el).find('.name:eq(3)').text(),
                statusAnime: $(el).find('.name:eq(5)').text(),
                malscore:    $(el).find('.name:eq(6)').text(),
                genre:       $(el).find('.item-list a').map((i, e) => $(e).text()).get(),
                studio:      $(el).find('.name:eq(7)').text(),
                producer:    $(el).find('.item-title:eq(9) a').map((i, e) => $(e).text()).get(),
            });
        });

        $('.bac-list-wrap').each((i, el) => {
            const animechar = $(el).find('.bac-item').map((i, e) => ({
                name:             $(e).find('.pi-name').text() || null,
                voice:            $(e).find('.per-info.rtl h4').text() || null,
                animeImg:         $(e).find('.per-info.ltr img').attr('data-src') || null,
                animedesignation: $(e).find('.pi-cast:first').text(),
                voicelang:        $(e).find('.per-info.rtl span').text() || null,
                voiceImageX:      $(e).find('.per-info.rtl img').attr('data-src') || null,
            })).get();
            infoX.push({ animechar });
        });

        $('.block_area-seasons').each((i, el) => {
            const season = $('.os-list a').map((i, e) => ({
                id:         $(e).attr('href')?.split('/')[1] || '',
                Seasonname: $(e).attr('title'),
            })).get();
            infoX.push({ season });
        });

        const syncText = $('#syncData').text();
        const mal_id  = syncText.split('"mal_id":"')[1]?.split('",')[0] || null;
        const aniid   = syncText.split('"anilist_id":"')[1]?.split('",')[0] || null;

        const recommendation = [];
        $('.film_list-wrap .flw-item').each((i, el) => {
            const href = $(el).find('a').attr('href') || '';
            recommendation.push({
                name:     $(el).find('.film-name').text() || null,
                jname:    $(el).find('.film-name a').attr('data-jname') || null,
                sub:      $(el).find('.tick-item.tick-sub').text(),
                dub:      $(el).find('.tick-item.tick-dub').text() || 0,
                total:    $(el).find('.tick-item.tick-eps').text() || null,
                xid:      href.split('/')[1] || null,
                image:    $(el).find('img').attr('data-src') || null,
                format:   $(el).find('.fdi-item:first').text() || null,
                duration: $(el).find('.fdi-duration').text() || null,
            });
        });

        const result = { infoX, mal_id, aniid, recommendation };
        cacheSet(cacheKey, result, 10 * 60 * 1000); // cache 10 min — anime info rarely changes
        res.json(result);
    } catch (error) {
        console.error('[related] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = info;
