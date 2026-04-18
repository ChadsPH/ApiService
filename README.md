# ApiService — Anime API

An Express.js API for fetching anime data from AniWatch (aniwatchtv.to).  
Video sources are served via **megaplay.buzz** — a reliable long-term video host that mirrors the AniWatch library.

**Base URL:** `https://apiservice-production-585e.up.railway.app`

---

## Endpoints

### `GET` Home Page

```
/api/parse
```

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/parse");
const data = await resp.json();
```

**Response:**
```json
{
  "slides": [
    {
      "name": "The Apothecary Diaries",
      "jname": "Kusuriya no Hitorigoto",
      "spotlight": "#1 Spotlight",
      "imageAnime": "https://img.flawlessfiles.com/...",
      "format": "TV",
      "duration": "24m",
      "release": "Oct 22, 2023",
      "quality": "HD",
      "animeId": "the-apothecary-diaries-18578",
      "anidesc": "..."
    }
  ],
  "trend": [
    {
      "name": "One Piece",
      "ranking": "01",
      "imgAni": "https://img.flawlessfiles.com/...",
      "jname": "One Piece",
      "iD": "one-piece-100"
    }
  ],
  "UpcomingAnime": [
    {
      "name": "Shangri-La Frontier",
      "format": "TV",
      "release": "25m",
      "idani": "shangri-la-frontier-18567",
      "imgAnime": "https://img.flawlessfiles.com/..."
    }
  ]
}
```

---

### `GET` Search Anime

```
/api/search/:query/:page
```

| Parameter | Type   | Description           | Required         |
|-----------|--------|-----------------------|------------------|
| `query`   | string | Anime title to search | Yes              |
| `page`    | int    | Page number           | Yes (default: 1) |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/search/your%20name/1");
const data = await resp.json();
```

**Response:**
```json
{
  "nextpageavailable": true,
  "searchYour": [
    {
      "name": "Your Name",
      "jname": "Kimi no Na wa.",
      "format": "Movie",
      "duration": "106m",
      "idanime": "your-name-10",
      "sub": "1",
      "dubani": "1",
      "totalep": false,
      "img": "https://img.flawlessfiles.com/...",
      "pg": false
    }
  ]
}
```

---

### `GET` Anime by Genre

```
/api/genre/:genre_name/:page
```

| Parameter    | Type   | Description                           | Required         |
|--------------|--------|---------------------------------------|------------------|
| `genre_name` | string | Genre name (e.g. `romance`, `action`) | Yes              |
| `page`       | int    | Page number                           | Yes (default: 1) |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/genre/romance/1");
const data = await resp.json();
```

**Response:**
```json
{
  "genrey": "Romance Anime",
  "nextpageavai": true,
  "genreX": [
    {
      "name": "Ranma ½ OVA",
      "jname": "Ranma ½ OVA",
      "format": "OVA",
      "duration": "30m",
      "sub": "6",
      "dubXanime": "6",
      "totalepX": "6",
      "descX": "...",
      "imageX": "https://img.flawlessfiles.com/...",
      "idX": "ranma-ova-906"
    }
  ]
}
```

---

### `GET` Anime by Type / Category

```
/api/mix/:type/:page
```

| Parameter | Type   | Description | Required |
|-----------|--------|-------------|----------|
| `type`    | string | One of: `movie`, `ova`, `ona`, `subbed-anime`, `dubbed-anime`, `special`, `tv`, `popular` | Yes |
| `page`    | int    | Page number | Yes (default: 1) |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/mix/tv/1");
const data = await resp.json();
```

**Response:**
```json
{
  "nextpageavai": true,
  "mixAni": [
    {
      "name": "Isekai Onsen Paradise",
      "jname": "...",
      "format": "TV",
      "duration": "3m",
      "idanime": "isekai-onsen-paradise-18982",
      "sub": "2",
      "dubani": false,
      "totalep": false,
      "img": "https://img.flawlessfiles.com/...",
      "pg": "18+"
    }
  ]
}
```

---

### `GET` A-Z Anime List ⭐ New

Browse the full AniWatch library sorted alphabetically.

```
/api/az-list
/api/az-list/:letter
/api/az-list/:letter/:page
```

| Parameter | Type   | Description                                                       | Required         |
|-----------|--------|-------------------------------------------------------------------|------------------|
| `letter`  | string | A–Z letter, or `0` for titles starting with a number/symbol      | No (returns all) |
| `page`    | int    | Page number                                                       | No (default: 1)  |

> You can also pass `letter` and `page` as query params: `/api/az-list?letter=A&page=2`

**Request:**
```javascript
// All anime starting with "N", page 1
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/az-list/N/1");
const data = await resp.json();
```

**Response:**
```json
{
  "letter": "N",
  "page": 1,
  "totalPages": 4,
  "hasNextPage": true,
  "items": [
    {
      "name": "Naruto",
      "jname": "Naruto",
      "id": "naruto-355",
      "image": "https://img.flawlessfiles.com/...",
      "format": "TV",
      "duration": "23m",
      "sub": "220",
      "dub": "220",
      "totalEp": "220"
    }
  ],
  "availableLetters": ["A","B","C","...","Z","0"]
}
```

---

### `GET` Full A-Z List (All Pages) ⭐ New

Fetch **every page** for a given letter in one request. All pages are fetched in parallel and returned combined.

```
/api/az-list/all/:letter
```

| Parameter | Type   | Description                                                  | Required         |
|-----------|--------|--------------------------------------------------------------|------------------|
| `letter`  | string | A–Z letter, or `0` for numbers/symbols, or omit for all     | No               |

> ⚠️ Popular letters like `S` or `T` can have hundreds of titles. Use with care.

**Request:**
```javascript
// All anime starting with "B" across all pages
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/az-list/all/B");
const data = await resp.json();
```

**Response:**
```json
{
  "letter": "B",
  "totalPages": 3,
  "totalItems": 87,
  "items": [
    {
      "name": "Bleach",
      "jname": "Bleach",
      "id": "bleach-367",
      "image": "https://img.flawlessfiles.com/...",
      "format": "TV",
      "duration": "24m",
      "sub": "366",
      "dub": "366",
      "totalEp": "366"
    }
  ]
}
```

---

### `GET` Anime Info

```
/api/related/:id
```

| Parameter | Type   | Description   | Required |
|-----------|--------|---------------|----------|
| `id`      | string | Anime slug ID | Yes      |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/related/hunter-x-hunter-128");
const data = await resp.json();
```

**Response:**
```json
{
  "infoX": [
    {
      "name": "Hunter x Hunter",
      "jname": "Hunter x Hunter",
      "pganime": "PG-13",
      "quality": "HD",
      "epsub": "62",
      "epdub": "62",
      "totalep": "62",
      "format": "TV",
      "duration": "23m",
      "desc": "...",
      "id": "hunter-x-hunter-128",
      "image": "https://img.flawlessfiles.com/..."
    },
    {
      "japanese": "HUNTER×HUNTER",
      "aired": "Oct 16, 1999 to Mar 31, 2001",
      "premired": "Fall 1999",
      "statusAnime": "Finished Airing",
      "malscore": "8.4",
      "genre": ["Action", "Adventure", "Fantasy", "Shounen"],
      "studio": "Nippon Animation",
      "producer": ["Fuji TV", "Nippon Animation", "Viz Media"]
    }
  ],
  "mal_id": "136"
}
```

---

### `GET` Anime Schedule

```
/api/shedule/:date
```

| Parameter | Type   | Description                 | Required |
|-----------|--------|-----------------------------|----------|
| `date`    | string | Date in `yyyy-mm-dd` format | Yes      |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/shedule/2024-01-28");
const data = await resp.json();
```

**Response:**
```json
{
  "Sheduletoday": [
    {
      "name": "The Apothecary Diaries",
      "jname": "Kusuriya no Hitorigoto",
      "time": "00:15",
      "epshedule": "Episode 16"
    }
  ]
}
```

---

### `GET` Random Anime

```
/api/random
```

Returns a fully detailed random anime (same structure as `/api/related`). Not cached — always returns a different title.

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/random");
const data = await resp.json();
```

---

### `GET` Episode List

```
/api/episode/:id
```

| Parameter | Type   | Description   | Required |
|-----------|--------|---------------|----------|
| `id`      | string | Anime slug ID | Yes      |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/episode/hunter-x-hunter-128");
const data = await resp.json();
```

**Response:**
```json
{
  "episodetown": [
    {
      "order": "1",
      "name": "A Boy Setting Out for a Journey",
      "epId": "hunter-x-hunter-128?ep=3661"
    }
  ]
}
```

> 💡 The number after `ep=` is the **episode ID** used by `/api/server` and `/api/mega-embed`.

---

### `GET` Episode Servers

```
/api/server/:epId
```

| Parameter | Type   | Description                                | Required |
|-----------|--------|--------------------------------------------|----------|
| `epId`    | string | Episode ID (e.g. `ep=3662` or just `3662`) | Yes      |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/server/ep=3662");
const data = await resp.json();
```

**Response:**
```json
{
  "sub": [
    { "server": "vidstreaming", "id": "4", "srcId": "636137" },
    { "server": "megacloud",    "id": "1", "srcId": "411986" }
  ],
  "dub": [
    { "server": "vidstreaming", "id": "4", "srcId": "582275" },
    { "server": "megacloud",    "id": "1", "srcId": "2720"   }
  ]
}
```

---

### `GET` Video Source (MegaCloud)

```
/api/src-server/:srcId
```

Use the `srcId` from `/api/server`. The extractor auto-detects the server type and routes accordingly. MegaCloud decryption keys are fetched from an externally-maintained repo so they stay up-to-date automatically.

| Parameter | Type | Description                         | Required |
|-----------|------|-------------------------------------|----------|
| `srcId`   | int  | `srcId` from `/api/server` response | Yes      |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/src-server/2720");
const data = await resp.json();
```

**Response (HLS sources):**
```json
{
  "restres": {
    "sources": [
      { "url": "https://eno.tendoloads.com/...master.m3u8", "type": "hls" }
    ],
    "tracks": [],
    "intro": { "start": 0, "end": 0 },
    "outro": { "start": 0, "end": 0 },
    "referer": "https://megacloud.blog/"
  }
}
```

**Response (embed-only servers):**
```json
{
  "restres": {
    "sources": [],
    "tracks": [],
    "embedUrl": "https://megaplay.buzz/stream/s-2/136197/sub"
  }
}
```

> ℹ️ When `sources` is empty and `embedUrl` is present, use the `/api/mega-embed` endpoint or load the URL in an iframe.

---

### `GET` MegaPlay Embed URL

```
/api/mega-embed/:episodeId/:lang
```

The simplest way to get a working video player for any episode.  
Uses **megaplay.buzz** — mirrors the full AniWatch library and works even if the original source changes.

| Parameter   | Type   | Description                                    | Required |
|-------------|--------|------------------------------------------------|----------|
| `episodeId` | int    | The `ep=` number from the AniWatch episode URL | Yes      |
| `lang`      | string | `sub` or `dub`                                 | Yes      |

**How to find the episodeId:**  
From `/api/episode/:animeId`, each episode has an `epId` like `"hunter-x-hunter-128?ep=3661"`.  
The episodeId is the number after `ep=` → `3661`.

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/mega-embed/3661/sub");
const data = await resp.json();
```

**Response:**
```json
{
  "embedUrl": "https://megaplay.buzz/stream/s-2/3661/sub",
  "iframe": "<iframe src=\"https://megaplay.buzz/stream/s-2/3661/sub\" width=\"100%\" height=\"100%\" frameborder=\"0\" scrolling=\"no\" allowfullscreen></iframe>"
}
```

You can paste the `iframe` value directly into your HTML, or use `embedUrl` in a custom iframe component.

---

### `GET` Characters & Voice Actors (Single Page) ⭐ Updated

```
/api/character/list/:id?page=1
```

| Parameter | Type   | Description                              | Required         |
|-----------|--------|------------------------------------------|------------------|
| `id`      | string | Anime slug (e.g. `one-piece-100`) or numeric ID | Yes       |
| `page`    | int    | Page number (query param)                | No (default: 1)  |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/character/list/one-piece-100?page=1");
const data = await resp.json();
```

**Response:**
```json
{
  "results": [
    {
      "character": {
        "name": "Monkey D. Luffy",
        "poster": "https://img.flawlessfiles.com/...",
        "role": "Main"
      },
      "voiceActors": [
        {
          "name": "Mayumi Tanaka",
          "poster": "https://img.flawlessfiles.com/...",
          "language": "Japanese"
        },
        {
          "name": "Colleen Clinkenbeard",
          "poster": "https://img.flawlessfiles.com/...",
          "language": "English"
        }
      ]
    }
  ],
  "totalPages": 5,
  "page": 1
}
```

---

### `GET` All Characters & Voice Actors ⭐ New

Fetches **every page** of characters for an anime and returns them all in a single combined response. All pages are fetched in parallel.

```
/api/character/all/:id
```

| Parameter | Type   | Description                              | Required |
|-----------|--------|------------------------------------------|----------|
| `id`      | string | Anime slug (e.g. `one-piece-100`) or numeric ID | Yes |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/character/all/one-piece-100");
const data = await resp.json();
```

**Response:**
```json
{
  "animeId": "100",
  "totalPages": 5,
  "total": 214,
  "results": [
    {
      "character": {
        "name": "Monkey D. Luffy",
        "poster": "https://img.flawlessfiles.com/...",
        "role": "Main"
      },
      "voiceActors": [
        {
          "name": "Mayumi Tanaka",
          "poster": "https://img.flawlessfiles.com/...",
          "language": "Japanese"
        },
        {
          "name": "Colleen Clinkenbeard",
          "poster": "https://img.flawlessfiles.com/...",
          "language": "English"
        }
      ]
    }
  ]
}
```

---

### `GET` Search Characters ⭐ New

Search through all characters and voice actors for a given anime by name. Matches both character names and VA names (case-insensitive).

```
/api/character/search?id=:animeId&name=:query
```

| Parameter | Type   | Description                              | Required |
|-----------|--------|------------------------------------------|----------|
| `id`      | string | Anime slug or numeric ID                 | Yes      |
| `name`    | string | Character or voice actor name to search  | Yes      |

**Request:**
```javascript
const resp = await fetch("https://apiservice-production-585e.up.railway.app/api/character/search?id=one-piece-100&name=Nami");
const data = await resp.json();
```

**Response:**
```json
{
  "animeId": "100",
  "query": "Nami",
  "total": 1,
  "results": [
    {
      "character": {
        "name": "Nami",
        "poster": "https://img.flawlessfiles.com/...",
        "role": "Main"
      },
      "voiceActors": [
        {
          "name": "Akemi Okamura",
          "poster": "https://img.flawlessfiles.com/...",
          "language": "Japanese"
        }
      ]
    }
  ]
}
```

---

## Typical Playback Flows

### Flow A — MegaPlay (recommended, simplest)

```
1. GET /api/episode/:animeId           → get episode list, extract episodeId from ep=XXXXX
2. GET /api/mega-embed/:episodeId/sub  → get ready-to-use megaplay.buzz embed URL
3. Render the iframe on your page
```

### Flow B — Direct HLS (advanced)

```
1. GET /api/episode/:animeId     → get episode list + epId
2. GET /api/server/:epId         → get server list + srcId (use megacloud srcId)
3. GET /api/src-server/:srcId    → get HLS stream URL
4. Feed the .m3u8 URL into your video player (hls.js, Video.js, etc.)
```

---

## Caching

All endpoints cache responses in memory to reduce upstream load:

| Endpoint                  | Cache TTL  |
|---------------------------|------------|
| `/api/parse`              | 5 minutes  |
| `/api/search`             | 3 minutes  |
| `/api/genre`              | 5 minutes  |
| `/api/mix`                | 5 minutes  |
| `/api/az-list`            | 10 minutes |
| `/api/az-list/all`        | 30 minutes |
| `/api/related`            | 10 minutes |
| `/api/episode`            | 10 minutes |
| `/api/shedule`            | 1 hour     |
| `/api/server`             | 3 minutes  |
| `/api/src-server`         | 5 minutes  |
| `/api/character/list`     | 15 minutes |
| `/api/character/all`      | 15 minutes |
| `/api/character/search`   | 15 minutes (reuses `/all` cache) |
| `/api/random`             | No cache   |

Cached responses include a `"cached": true` field.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Scraping:** Axios + Cheerio
- **Decryption:** Node.js `crypto` (AES-256-CBC) + [MegacloudKeys](https://github.com/yogesh-hacker/MegacloudKeys) (auto-updating keys)
- **Video Host:** [megaplay.buzz](https://megaplay.buzz/api)
- **Hosting:** Railway
