const express = require('express');
const axios   = require('axios');
const cheerio = require('cheerio');

const topten = express();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

// ── in-memory cache ───────────────────────────────────────────────────────────
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

/**
 * Parse a Top-10 sidebar list (#top-viewed-day / week / month).
 * AniWatch renders each block as:
 *   <div id="top-viewed-day">
 *     <ul class="ulclear">
 *       <li>
 *         <div class="film-number"><span>1</span></div>
 *         <div class="film-detail">
 *           <h3 class="film-name"><a class="dynamic-name" data-jname="...">Name</a></h3>
 *           <div class="fd-infor">
 *             <span class="fdi-item">TV</span>
 *             <span class="tick-item tick-sub">12</span>
 *             <span class="tick-item tick-dub">10</span>
 *           </div>
 *         </div>
 *         <div class="film-poster">
 *           <img data-src="...">
 *         </div>
 *       </li>
 *     </ul>
 *   </div>
 */
function parseTopBlock($, blockId) {
    const items = [];
    $(`#${blockId} li`).each((_, el) => {
        const href = $(el).find('.film-detail .film-name a').attr('href') || '';
        items.push({
            rank:    $(el).find('.film-number span').first().text().trim() || null,
            name:    $(el).find('.dynamic-name').text().trim()             || null,
            jname:   $(el).find('.dynamic-name').attr('data-jname')       || null,
            id:      href.split('/')[1]?.split('?')[0]                    || null,
            image:   $(el).find('.film-poster img').attr('data-src')      || null,
            format:  $(el).find('.fdi-item').first().text().trim()        || null,
            sub:     $(el).find('.tick-sub').text().trim()                || null,
            dub:     $(el).find('.tick-dub').text().trim()                || null,
        });
    });
    return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/top-ten
//
// Scrapes the Top 10 Today / Week / Month sidebar from AniWatch's home page.
//
// Response:
//   {
//     today:  [ { rank, name, jname, id, image, format, sub, dub }, … ],
//     week:   [ … ],
//     month:  [ … ],
//   }
// ─────────────────────────────────────────────────────────────────────────────
topten.get('/top-ten', async (req, res) => {
    const cached = cacheGet('topten');
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const { data: html } = await axios.get('https://aniwatchtv.to/home', {
            timeout: 12000,
            headers: { 'User-Agent': USER_AGENT },
        });

        const $ = cheerio.load(html);

        const today = parseTopBlock($, 'top-viewed-day');
        const week  = parseTopBlock($, 'top-viewed-week');
        const month = parseTopBlock($, 'top-viewed-month');

        const result = { today, week, month };

        cacheSet('topten', result, 5 * 60 * 1000); // 5 min — rankings change often
        res.json(result);

    } catch (error) {
        console.error('[top-ten] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/top-ten/:period
//   period: today | week | month
//   Returns just that one list for lighter responses.
// ─────────────────────────────────────────────────────────────────────────────
topten.get('/top-ten/:period', async (req, res) => {
    const PERIODS = { today: 'top-viewed-day', week: 'top-viewed-week', month: 'top-viewed-month' };
    const period  = req.params.period.toLowerCase();

    if (!PERIODS[period]) {
        return res.status(400).json({
            error: `Invalid period "${period}". Use: today, week, or month.`,
        });
    }

    const cacheKey = `topten_${period}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    try {
        const { data: html } = await axios.get('https://aniwatchtv.to/home', {
            timeout: 12000,
            headers: { 'User-Agent': USER_AGENT },
        });

        const $     = cheerio.load(html);
        const items = parseTopBlock($, PERIODS[period]);
        const result = { period, items };

        cacheSet(cacheKey, result, 5 * 60 * 1000);
        res.json(result);

    } catch (error) {
        console.error('[top-ten] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
});

module.exports = topten;
