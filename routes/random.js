const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const random = express();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

random.get('/random', async (req, res) => {
    try {
        const { data } = await axios.get('https://aniwatchtv.to/random', {
            timeout: 12000,
            headers: { 'User-Agent': USER_AGENT },
        });

        const $ = cheerio.load(data);
        const randomAnime = [];

        $('.anis-content').each((i, el) => {
            const href = $(el).find('.film-buttons a').attr('href') || '';
            randomAnime.push({
                name:     $(el).find('.dynamic-name').text(),
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
            randomAnime.push({
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
            randomAnime.push({ animechar });
        });

        $('.block_area-seasons').each((i, el) => {
            const season = $('.os-list a').map((i, e) => ({
                id:         $(e).attr('href')?.split('/')[1] || '',
                Seasonname: $(e).attr('title'),
            })).get();
            randomAnime.push({ season });
        });

        // No caching for /random — it should always return a different anime
        res.json({ randomAnime });
    } catch (error) {
        console.error('[random] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = random;
