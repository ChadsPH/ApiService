# ApiService — Anime API
An Express.js API for fetching anime data from Aniwatch.to (formerly Zoro.to).

**Base URL:** `https://apiservice-a0mh.onrender.com`

---

## Endpoints

### `GET` Home Page

```
/api/parse
```

**Request:**
```javascript
const resp = await fetch("https://apiservice-a0mh.onrender.com/api/parse");
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

| Parameter | Type   | Description          | Required |
|-----------|--------|----------------------|----------|
| `query`   | string | Anime title to search | Yes      |
| `page`    | int    | Page number           | Yes (default: 1) |

**Request:**
```javascript
const resp = await fetch("https://apiservice-a0mh.onrender.com/api/search/your%20name/1");
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

| Parameter    | Type   | Description     | Required |
|--------------|--------|-----------------|----------|
| `genre_name` | string | Genre name (e.g. `romance`, `action`) | Yes |
| `page`       | int    | Page number     | Yes (default: 1) |

**Request:**
```javascript
const resp = await fetch("https://apiservice-a0mh.onrender.com/api/genre/romance/1");
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

### `GET` Anime Schedule

```
/api/shedule/:date
```

| Parameter | Type   | Description              | Required |
|-----------|--------|--------------------------|----------|
| `date`    | string | Date in `yyyy-mm-dd` format | Yes   |

**Request:**
```javascript
const resp = await fetch("https://apiservice-a0mh.onrender.com/api/shedule/2024-01-28");
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

### `GET` Anime Info

```
/api/related/:id
```

| Parameter | Type   | Description   | Required |
|-----------|--------|---------------|----------|
| `id`      | string | Anime slug ID | Yes      |

**Request:**
```javascript
const resp = await fetch("https://apiservice-a0mh.onrender.com/api/related/hunter-x-hunter-128");
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
      "japanese": "HUNTER×HUNTER（ハンター×ハンター）",
      "aired": "Oct 16, 1999 to Mar 31, 2001",
      "premired": "Fall 1999",
      "statusAnime": "Finished Airing",
      "malscore": "8.4",
      "genre": ["Action", "Adventure", "Fantasy", "Shounen"],
      "studio": "Nippon Animation",
      "producer": ["Fuji TV", "Nippon Animation", "Viz Media"]
    },
    {
      "animechar": [
        {
          "name": "Freecss, Gon",
          "voice": "Takeuchi, Junko",
          "animeImg": "https://img.flawlessfiles.com/...",
          "animedesignation": "Main",
          "voicelang": "Japanese",
          "voiceImageX": "https://img.flawlessfiles.com/..."
        }
      ]
    }
  ],
  "mal_id": "136"
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
const resp = await fetch("https://apiservice-a0mh.onrender.com/api/mix/tv/1");
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

### `GET` Episode List

```
/api/episode/:id
```

| Parameter | Type   | Description   | Required |
|-----------|--------|---------------|----------|
| `id`      | string | Anime slug ID | Yes      |

**Request:**
```javascript
const resp = await fetch("https://apiservice-a0mh.onrender.com/api/episode/hunter-x-hunter-128");
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

---

### `GET` Episode Servers

```
/api/server/:epId
```

| Parameter | Type   | Description                         | Required |
|-----------|--------|-------------------------------------|----------|
| `epId`    | string | Episode ID from the episode list (e.g. `ep=3662`) | Yes |

**Request:**
```javascript
const resp = await fetch("https://apiservice-a0mh.onrender.com/api/server/ep=3662");
const data = await resp.json();
```

**Response:**
```json
{
  "sub": [
    { "server": "vidstreaming", "id": "4", "srcId": "636137" },
    { "server": "megacloud",    "id": "1", "srcId": "411986" },
    { "server": "streamsb",     "id": "5", "srcId": "830715" },
    { "server": "streamtape",   "id": "3", "srcId": "830716" }
  ],
  "dub": [
    { "server": "vidstreaming", "id": "4", "srcId": "582275" },
    { "server": "megacloud",    "id": "1", "srcId": "2720"   },
    { "server": "streamsb",     "id": "5", "srcId": "714095" },
    { "server": "streamtape",   "id": "3", "srcId": "736795" }
  ]
}
```

---

### `GET` Video Source (Stream URL)

```
/api/src-server/:srcId
```

Use `srcId` from the server list above. Only **megacloud** (`id: "1"`) is supported.

| Parameter | Type | Description                    | Required |
|-----------|------|--------------------------------|----------|
| `srcId`   | int  | `srcId` from `/api/server` response | Yes |

**Request:**
```javascript
const resp = await fetch("https://apiservice-a0mh.onrender.com/api/src-server/2720");
const data = await resp.json();
```

**Response:**
```json
{
  "restres": {
    "sources": [
      {
        "url": "https://eno.tendoloads.com/...master.m3u8",
        "type": "hls"
      }
    ],
    "tracks": [],
    "intro": { "start": 0, "end": 0 },
    "outro": { "start": 0, "end": 0 }
  }
}
```

> ℹ️ Responses are cached for 5 minutes. A `"cached": true` field will appear on cached responses.

---

## Typical Playback Flow

```
1. GET /api/episode/:animeId       → get episode list + epId
2. GET /api/server/:epId           → get server list + srcId (use megacloud srcId)
3. GET /api/src-server/:srcId      → get HLS stream URL
4. Feed the .m3u8 URL into your video player
```

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Scraping:** Axios + Cheerio
- **Decryption:** Node.js `crypto` (AES-256-CBC)
- **Hosting:** Render
