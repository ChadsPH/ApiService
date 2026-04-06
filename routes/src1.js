const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const createHttpError = require('http-errors');

const src1 = express();

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

// ✅ CACHE
const cache = new Map();
const CACHE_TTL = {
    src:  5  * 60 * 1000,
    keys: 10 * 60 * 1000,
};

function cacheGet(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) { cache.delete(key); return null; }
    return entry.value;
}
function cacheSet(key, value, ttl) {
    cache.set(key, { value, expiry: Date.now() + ttl });
}

const http = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

function detectServerType(link) {
    if (!link) return 'unknown';
    const l = link.toLowerCase();
    if (l.includes('megacloud.blog') || l.includes('megacloud.co')) return 'megacloud';
    if (l.includes('megaplay.buzz')) return 'megaplay';
    return 'iframe';
}

// MegaCloud extractor using externally-maintained keys repo
// instead of fragile regex-based JS parsing (which caused "Can't find variables").
class MegaCloud {
    constructor() { this.serverName = 'megacloud'; }

    async extract(videoUrl) {
        const extractedData = { tracks: [], intro: { start: 0, end: 0 }, outro: { start: 0, end: 0 }, sources: [] };

        const { data: iframeHtml } = await http.get(videoUrl.href, { headers: { Referer: videoUrl.href } });

        const nonce = this.extractNonce(iframeHtml);
        const videoId = videoUrl.href.split('/').pop().split('?')[0];
        const pathDir = videoUrl.pathname.split('/').slice(0, -1).join('/');
        const finalUrl = `${videoUrl.protocol}//${videoUrl.host}${pathDir}/getSources?id=${videoId}&_k=${nonce}`;

        const { data: srcsData } = await http.get(finalUrl, { headers: { Referer: videoUrl.href } });
        if (!srcsData) throw createHttpError.NotFound('Url may have an invalid video id');

        const encryptedString = srcsData.sources;

        if (!srcsData.encrypted && Array.isArray(encryptedString)) {
            extractedData.intro = srcsData.intro;
            extractedData.outro = srcsData.outro;
            extractedData.tracks = srcsData.tracks;
            extractedData.sources = encryptedString.map(s => ({ url: s.file, type: s.type }));
            return extractedData;
        }

        const sources = await this.decryptSources(encryptedString, nonce);
        extractedData.intro = srcsData.intro;
        extractedData.outro = srcsData.outro;
        extractedData.tracks = srcsData.tracks;
        extractedData.sources = sources;
        return extractedData;
    }

    async decryptSources(encryptedString, nonce) {
        let keys = cacheGet('megacloud_keys');
        if (!keys) {
            const { data } = await http.get(
                'https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json'
            );
            keys = data;
            cacheSet('megacloud_keys', data, CACHE_TTL.keys);
        }

        const megaKeys = keys['mega'] || keys['megacloud'] || keys;

        if (Array.isArray(megaKeys)) {
            const { secret, encryptedSource } = this.getSecret(encryptedString, megaKeys);
            const decrypted = this.decrypt(encryptedSource, secret);
            const sources = JSON.parse(decrypted);
            return sources.map(s => ({ url: s.file, type: s.type }));
        }

        const decryptUrl =
            `https://megacloud-api-nine.vercel.app/` +
            `?encrypted_data=${encodeURIComponent(encryptedString)}` +
            `&nonce=${encodeURIComponent(nonce)}` +
            `&secret=${encodeURIComponent(megaKeys)}`;

        const { data: result } = await http.get(decryptUrl);

        if (typeof result === 'string') {
            const m3u8 = result.match(/"file":"(.*?)"/)?.[1];
            if (!m3u8) throw createHttpError.InternalServerError('Failed to decrypt resource');
            return [{ url: m3u8, type: 'hls' }];
        }
        if (Array.isArray(result)) return result.map(s => ({ url: s.file || s.url, type: s.type || 'hls' }));

        throw createHttpError.InternalServerError('Failed to decrypt resource');
    }

    extractNonce(iframeHtml) {
        const match =
            iframeHtml.match(/\b[a-zA-Z0-9]{48}\b/) ||
            iframeHtml.match(/\b([a-zA-Z0-9]{16})\b.?\b([a-zA-Z0-9]{16})\b.?\b([a-zA-Z0-9]{16})\b/);
        return match ? (match.length === 4 ? match.slice(1).join('') : match[0]) : null;
    }

    getSecret(encryptedString, values) {
        let secret = '', encryptedSourceArray = encryptedString.split(''), currentIndex = 0;
        for (const index of values) {
            const start = index[0] + currentIndex;
            const end = start + index[1];
            for (let i = start; i < end; i++) {
                secret += encryptedString[i];
                encryptedSourceArray[i] = '';
            }
            currentIndex += index[1];
        }
        return { secret, encryptedSource: encryptedSourceArray.join('') };
    }

    decrypt(encrypted, keyOrSecret, maybe_iv) {
        let key, iv, contents;
        if (maybe_iv) {
            key = keyOrSecret; iv = maybe_iv; contents = encrypted;
        } else {
            const cypher = Buffer.from(encrypted, 'base64');
            const salt = cypher.subarray(8, 16);
            const password = Buffer.concat([Buffer.from(keyOrSecret, 'binary'), salt]);
            const md5Hashes = [];
            let digest = password;
            for (let i = 0; i < 3; i++) {
                md5Hashes[i] = crypto.createHash('md5').update(digest).digest();
                digest = Buffer.concat([md5Hashes[i], password]);
            }
            key = Buffer.concat([md5Hashes[0], md5Hashes[1]]);
            iv = md5Hashes[2];
            contents = cypher.subarray(16);
        }
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        return decipher.update(contents, typeof contents === 'string' ? 'base64' : undefined, 'utf8') + decipher.final();
    }
}

const megaCloudInstance = new MegaCloud();

// GET /api/src-server/:id
// Takes the srcId from /api/server/:episodeId and returns video sources.
src1.get('/src-server/:id', async (req, res) => {
    try {
        const servernum = parseInt(req.params.id);
        if (isNaN(servernum)) return res.status(400).json({ error: 'Invalid server id' });

        const cacheKey = `src_${servernum}`;
        const cached = cacheGet(cacheKey);
        if (cached) return res.json({ restres: cached, cached: true });

        const serverlink = `https://aniwatchtv.to/ajax/v2/episode/sources?id=${servernum}`;
        const serreq = await http.get(serverlink);
        const linkPart = serreq.data?.link;
        if (!linkPart) return res.status(404).json({ error: 'Could not find video source link' });

        const serverType = detectServerType(linkPart);

        if (serverType === 'megaplay' || serverType === 'iframe') {
            const result = { sources: [], tracks: [], embedUrl: linkPart };
            cacheSet(cacheKey, result, CACHE_TTL.src);
            return res.json({ restres: result });
        }

        const videoUrl = new URL(linkPart);
        const result = await megaCloudInstance.extract(videoUrl);
        result.referer = `${videoUrl.protocol}//${videoUrl.host}/`;
        cacheSet(cacheKey, result, CACHE_TTL.src);
        res.json({ restres: result });
    } catch (error) {
        console.error('[src-server] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

// GET /api/mega-embed/:episodeId/:lang
// Returns a ready-to-use megaplay.buzz embed URL.
// episodeId = the ?ep= value from the HiAnime/AniWatch episode URL.
// lang      = 'sub' or 'dub'
//
// Example: GET /api/mega-embed/84802/sub
src1.get('/mega-embed/:episodeId/:lang', (req, res) => {
    const { episodeId, lang } = req.params;
    if (!episodeId || !['sub', 'dub'].includes(lang?.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid params.',
            usage: 'GET /api/mega-embed/:episodeId/sub  or  /api/mega-embed/:episodeId/dub',
        });
    }
    const embedUrl = `https://megaplay.buzz/stream/s-2/${episodeId}/${lang.toLowerCase()}`;
    res.json({
        embedUrl,
        iframe: `<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" scrolling="no" allowfullscreen></iframe>`,
    });
});

module.exports = src1;
