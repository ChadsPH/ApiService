const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const createHttpError = require('http-errors');

const src1 = express();

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

// ✅ CACHE — simple in-memory cache, no extra dependencies needed
const cache = new Map();
const CACHE_TTL = {
    src: 5 * 60 * 1000,       // video sources: 5 minutes
    script: 30 * 60 * 1000,   // decrypt script: 30 minutes (it barely changes)
};

function cacheGet(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

function cacheSet(key, value, ttl) {
    cache.set(key, { value, expiry: Date.now() + ttl });
}

// ✅ Shared axios instance with timeout & keep-alive
const http = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

// ─── Server type detection ────────────────────────────────────────────────────
// Routes to the right extractor based on the embed URL returned by AniWatch.
// 'megacloud' covers MegaCloud (e-1) AND VidStreaming (e-2) — same CDN, same API.
// Everything else falls back to 'iframe' so the frontend can use IframePlayer.
function detectServerType(link) {
    if (!link) return 'unknown';
    const l = link.toLowerCase();
    if (l.includes('megacloud.blog') || l.includes('megacloud.co')) return 'megacloud';
    // Add more cases here as you add extractors (e.g. rapidcloud, streamtape).
    return 'iframe';
}

// ─── MegaCloud extractor ──────────────────────────────────────────────────────
// Handles ANY megacloud.blog embed path (e-1, e-2, …) by deriving all API
// URLs dynamically from the actual embed URL instead of hardcoding them.
class MegaCloud {
    constructor() {
        this.serverName = 'megacloud';
    }

    async extract(videoUrl) {
        const extractedData = {
            tracks: [],
            intro: { start: 0, end: 0 },
            outro: { start: 0, end: 0 },
            sources: [],
        };

        // Step 1: Fetch iframe HTML to get nonce
        const { data: iframeHtml } = await http.get(videoUrl.href, {
            headers: { Referer: videoUrl.href },
        });

        const nounce = this.extractNonce(iframeHtml);
        const videoId = videoUrl.href.split('/').pop().split('?')[0];

        // ✅ FIX: Build getSources URL from the actual embed URL path.
        //
        // BEFORE (broken): hardcoded megacloud.sources constant
        //   → 'https://megacloud.blog/embed-2/v3/e-1/getSources?id='
        //   → always pointed to e-1, so VidStreaming (e-2) always failed.
        //
        // AFTER: derive the base from videoUrl itself:
        //   embed  URL: https://megacloud.blog/embed-2/v3/e-1/HASH?k=1
        //   sources URL: https://megacloud.blog/embed-2/v3/e-1/getSources?id=HASH&_k=NONCE
        //
        //   embed  URL: https://megacloud.blog/embed-2/v3/e-2/HASH?k=1  ← VidStreaming
        //   sources URL: https://megacloud.blog/embed-2/v3/e-2/getSources?id=HASH&_k=NONCE
        const pathDir = videoUrl.pathname.split('/').slice(0, -1).join('/');
        const finalUrl = `${videoUrl.protocol}//${videoUrl.host}${pathDir}/getSources?id=${videoId}&_k=${nounce}`;

        // Step 2: Fetch sources JSON
        const { data: srcsData } = await http.get(finalUrl, {
            headers: { Referer: videoUrl.href },
        });

        if (!srcsData) {
            throw createHttpError.NotFound('Url may have an invalid video id');
        }

        const encryptedString = srcsData.sources;

        // If NOT encrypted, return directly — no need to fetch the big JS script
        if (!srcsData.encrypted && Array.isArray(encryptedString)) {
            extractedData.intro = srcsData.intro;
            extractedData.outro = srcsData.outro;
            extractedData.tracks = srcsData.tracks;
            extractedData.sources = encryptedString.map((s) => ({
                url: s.file,
                type: s.type,
            }));
            return extractedData;
        }

        // Step 3: Fetch decrypt script — CACHED per host for 30 minutes.
        // ✅ FIX: Script URL also derived from the embed host, not hardcoded.
        const scriptCacheKey = `megacloud_script_${videoUrl.host}`;
        let text = cacheGet(scriptCacheKey);
        if (!text) {
            const scriptUrl = `${videoUrl.protocol}//${videoUrl.host}/js/player/a/v3/pro/embed-1.min.js?v=${Date.now()}`;
            const { data } = await http.get(scriptUrl);
            if (!data) {
                throw createHttpError.InternalServerError(
                    "Couldn't fetch script to decrypt resource"
                );
            }
            text = data;
            cacheSet(scriptCacheKey, text, CACHE_TTL.script);
        }

        const vars = this.extractVariables(text);
        if (!vars.length) {
            throw new Error(
                "Can't find variables. Perhaps the extractor is outdated."
            );
        }

        const { secret, encryptedSource } = this.getSecret(encryptedString, vars);
        const decrypted = this.decrypt(encryptedSource, secret);

        try {
            const sources = JSON.parse(decrypted);
            extractedData.intro = srcsData.intro;
            extractedData.outro = srcsData.outro;
            extractedData.tracks = srcsData.tracks;
            extractedData.sources = sources.map((s) => ({
                url: s.file,
                type: s.type,
            }));
            return extractedData;
        } catch {
            throw createHttpError.InternalServerError('Failed to decrypt resource');
        }
    }

    extractNonce(iframeHtml) {
        const match =
            iframeHtml.match(/\b[a-zA-Z0-9]{48}\b/) ||
            iframeHtml.match(
                /\b([a-zA-Z0-9]{16})\b.?\b([a-zA-Z0-9]{16})\b.?\b([a-zA-Z0-9]{16})\b/
            );
        return match
            ? match.length === 4
                ? match.slice(1).join('')
                : match[0]
            : null;
    }

    extractVariables(text) {
        const regex =
            /case\s*0x[0-9a-f]+:(?![^;]*=partKey)\s*\w+\s*=\s*(\w+)\s*,\s*\w+\s*=\s*(\w+);/g;
        const matches = text.matchAll(regex);
        return Array.from(matches, (match) => {
            const matchKey1 = this.matchingKey(match[1], text);
            const matchKey2 = this.matchingKey(match[2], text);
            try {
                return [parseInt(matchKey1, 16), parseInt(matchKey2, 16)];
            } catch {
                return [];
            }
        }).filter((pair) => pair.length > 0);
    }

    getSecret(encryptedString, values) {
        let secret = '',
            encryptedSourceArray = encryptedString.split(''),
            currentIndex = 0;

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
            key = keyOrSecret;
            iv = maybe_iv;
            contents = encrypted;
        } else {
            const cypher = Buffer.from(encrypted, 'base64');
            const salt = cypher.subarray(8, 16);
            const password = Buffer.concat([
                Buffer.from(keyOrSecret, 'binary'),
                salt,
            ]);
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
        return (
            decipher.update(
                contents,
                typeof contents === 'string' ? 'base64' : undefined,
                'utf8'
            ) + decipher.final()
        );
    }

    matchingKey(value, script) {
        const regex = new RegExp(`,${value}=((?:0x)?([0-9a-fA-F]+))`);
        const match = script.match(regex);
        if (match) return match[1].replace(/^0x/, '');
        throw new Error('Failed to match the key');
    }
}

const megaCloudInstance = new MegaCloud();

// ✅ /src-server/:id — supports ALL servers, not just MegaCloud
src1.get('/src-server/:id', async (req, res) => {
    try {
        const servernum = parseInt(req.params.id);
        if (isNaN(servernum)) {
            return res.status(400).json({ error: 'Invalid server id' });
        }

        // ✅ Check cache first — same episode won't re-scrape for 5 minutes
        const cacheKey = `src_${servernum}`;
        const cached = cacheGet(cacheKey);
        if (cached) {
            return res.json({ restres: cached, cached: true });
        }

        // Step 1: Get the embed link from AniWatch for this server ID
        const serverlink = `https://aniwatchtv.to/ajax/v2/episode/sources?id=${servernum}`;
        const serreq = await http.get(serverlink);
        const serres = serreq.data;

        const linkPart = serres?.link;
        if (!linkPart) {
            return res.status(404).json({ error: 'Could not find video source link' });
        }

        // Step 2: Route to the correct extractor
        const serverType = detectServerType(linkPart);

        // ─── Non-MegaCloud servers ─────────────────────────────────────────────
        // For servers without a dedicated extractor (RapidCloud, StreamTape, etc.),
        // return the raw embed URL. The frontend will use IframePlayer for these.
        if (serverType === 'iframe') {
            const result = {
                sources: [],
                tracks: [],
                embedUrl: linkPart,
            };
            cacheSet(cacheKey, result, CACHE_TTL.src);
            return res.json({ restres: result });
        }

        // ─── MegaCloud (e-1 = MegaCloud sub/dub, e-2 = VidStreaming, etc.) ────
        const videoUrl = new URL(linkPart);
        const result = await megaCloudInstance.extract(videoUrl);

        // ✅ Attach the embed referer so the proxy can pass it downstream
        result.referer = `${videoUrl.protocol}//${videoUrl.host}/`;

        // ✅ Cache the result
        cacheSet(cacheKey, result, CACHE_TTL.src);

        res.json({ restres: result });
    } catch (error) {
        console.error('[src-server] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

module.exports = src1;
