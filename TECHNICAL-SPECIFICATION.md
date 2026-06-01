# Media Tracker — Technical Specification

**Version:** 2.0  
**Date:** June 2026  
**Author:** Chris Jordan  

---

## 1. System Overview

Media Tracker is a personal media collection management system that tracks Films/TV, Video Games, Books, and Board Games. It runs as a single HTML file hosted on AWS, accessible as a desktop app (Windows) and mobile app (iOS), with cloud synchronisation between devices.

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  Single HTML file with 4 srcdoc iframes             │
│  (Films/TV | Games | Books | Board Games)           │
│  Hosted on AWS S3 + CloudFront (HTTPS)              │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                  API GATEWAY                         │
│  HTTP API: media-tracker-api                        │
│  Routes: POST /save, GET /load, GET /bgg            │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│               LAMBDA FUNCTIONS                       │
│  media-tracker-save  (DynamoDB write)               │
│  media-tracker-load  (DynamoDB read)                │
│  media-tracker-bgg-proxy (BGG XML API proxy)        │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                  DYNAMODB                            │
│  Table: media-tracker-data                          │
│  Partition key: userId (String)                     │
│  Sort key: dataKey (String)                         │
│  Large items chunked at 350KB boundaries            │
└─────────────────────────────────────────────────────┘
```

### 1.2 External APIs

| API | Used By | Purpose | Auth |
|-----|---------|---------|------|
| TMDB v3 | Films/TV | Posters, metadata, cast, crew, ratings, certificates, screenshots, recommendations | Bearer token (hardcoded) |
| RAWG.io | Video Games | Covers, metadata, developer, publisher, Metacritic scores, screenshots, similar games | API key (hardcoded, user-overridable) |
| Open Library | Books | Covers, metadata, author, year, page count, ratings | None required |
| BGG XML API v2 | Board Games | Covers, metadata, designer, player count, weight, ratings (via Lambda proxy) | None required |

### 1.3 Hosting & Deployment

| Component | Service | Region |
|-----------|---------|--------|
| Static files | AWS S3 | eu-north-1 |
| CDN/HTTPS | AWS CloudFront | Global |
| API | AWS API Gateway | eu-north-1 |
| Functions | AWS Lambda | eu-north-1 |
| Database | AWS DynamoDB | eu-north-1 |
| Source control | GitHub | N/A |
| CI/CD | GitHub Actions | N/A |

**Deployment flow:** Push to GitHub main branch → GitHub Actions syncs files to S3 → CloudFront serves updated content (after invalidation or cache expiry).

---

## 2. Shell Application

The outer shell is a minimal HTML page containing:

- Fixed 46px header bar with tab buttons and utility buttons
- Four full-viewport srcdoc iframes (one per tracker)
- Tab switching (Films/TV, Games, Books, Board Games)
- Cloud sync functions (push/pull to DynamoDB)
- Export/Import functions (JSON file backup)
- PWA manifest for installability

### 2.1 Header Buttons

| Button | Function |
|--------|----------|
| 🎬 Films/TV | Switch to film tracker (gold accent #c8a400) |
| 🎮 Games | Switch to game tracker (green accent #2ecc71) |
| 📚 Books | Switch to book tracker (orange accent #e67e22) |
| 🎲 Board Games | Switch to board game tracker (purple accent #9b59b6) |
| ⬇ | Export all localStorage as JSON file |
| ⬆ | Import JSON file to localStorage |
| ☁↑ | Push localStorage to DynamoDB |
| ☁↓ | Pull from DynamoDB, overwrite localStorage, reload |

### 2.2 Cloud Sync

- **Push (☁↑):** Iterates all localStorage keys, sends each to DynamoDB via POST /save. Items larger than 350KB are split into chunks (DynamoDB 400KB item limit).
- **Pull (☁↓):** Fetches all items from DynamoDB via GET /load, reassembles chunked items, writes to localStorage, reloads page.
- **User ID:** Hardcoded as 'chris' (single-user system).

---

## 3. Film/TV Tracker

### 3.1 Storage Keys

| Key | Content |
|-----|---------|
| ft_films | Main data array (all films) |
| ft_posters | Poster images (id → URL) |
| ft_deleted | Array of deleted IDs |
| ft_deleted_titles | Array of normalised deleted titles |

### 3.2 Data Model (per film)

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique auto-incrementing ID |
| title | String | Display title |
| sortTitle | String | Lowercase, leading The/A/An stripped |
| year | Integer | Release year |
| mediaType | String | film, tv, comedy, music, documentary |
| category | String | Genre (Action, Thriller, etc.) |
| goatTier | Integer | 0-3 (0=not GOAT, 3=★★★ GOAT) |
| rating | String | amazing/good/meh/dislike/neveragain/empty |
| watched | Boolean | Has been watched |
| watchSoon | Boolean | Flagged for soon |
| watchHistory | Array | [{date, rating, moods[], notes, historical}] |
| moods | Array | Mood tags |
| notes | String | Free text |
| director | String | Comma-separated |
| cast | String | Comma-separated |
| imdbRating | String | e.g. "8.4" |
| imdbId | String | e.g. "tt0110912" |
| tmdbId | Integer | TMDB ID |
| runtime | Integer | Minutes |
| certificate | String | UK BBFC rating (U, PG, 12A, 15, 18) |
| posterWrong | Boolean | Flagged as wrong poster |
| posterConfirmed | Boolean | Confirmed correct |
| needsEstimate | Boolean | Needs watch estimate |

### 3.3 Media Types

- 🎬 Film
- 📺 TV
- 🎤 Comedy
- 🎵 Music
- 🔭 Documentary

### 3.4 Genre Categories

Action, Animation, Art Film, Bollywood, Comedy, Crime, Disaster, Documentary, Drama, Fantasy, Horror, Martial Arts, Musical, Revenge, Romance, Sci-Fi, Sexy, Sports, Superhero, Thriller, War, Western, World Cinema

### 3.5 Rating System

Five rating tiers plus three GOAT tiers (shared across all trackers):

1. ★★★ GOAT — All-Time Favourites (tier 3)
2. ★★ GOAT — Absolute Favourites (tier 2)
3. ★ GOAT — Favourites (tier 1)
4. Amazing
5. Good
6. Meh
7. Didn't Like
8. Never Again
9. Unrated (watched but no rating)
10. Unwatched

Ratings and GOAT tiers are on a single continuous scale — setting a rating removes GOAT status and vice versa.

### 3.6 Features

- Responsive CSS grid tiles with poster images
- Collapsible tier sections
- GOAT ★★★ split into "All-Time Favourite Films" and "All-Time Favourite TV & Comedy"
- Tile badges: GOAT banner, rating pill, watch count, ⚡ soon, IMDB score, 🏆 trophy (IMDB ≥ 8.5), press ratings (★★★★★), type badge, status dot
- Tile click modal with full metadata, action buttons, rating/genre/type selectors
- Fix modal (title, year, type, TMDB ID, hint, genre)
- Log Watch modal (date, rating, moods, notes, estimates)
- Details button (fetches description from TMDB)
- Similar button (fetches TMDB recommendations)
- Screenshot in tile modal (TMDB backdrop images)
- Ambiguity picker for close search results
- Filter toolbar: search, type, genre, decade, rating, flag, cover status, certificate, director, cast, sort
- Sort options: Tier, A-Z, Series, Year, Most Watched, IMDB Rating
- Action bar: Bulk Add, Suggest, Charts, Audit, Estimates, Soon, History, Reimport Covers, Fetch Certs, Duplicates, Delete
- Delete mode with bulk selection
- Background metadata fetch on startup
- Press ratings lookup (Empire/Total Film 5★)
- UK certificate fetching with US→UK mapping
- Viewing history with date filter (from 2026-05-28)
- Charts (Top 10 Directors, Top 10 Cast, By Decade)

### 3.7 TMDB Integration

- Search: /search/movie or /search/tv
- Detail: /movie/{id} or /tv/{id} with append_to_response=credits,external_ids,release_dates,content_ratings
- Images: /movie/{id}/images (backdrops for screenshots)
- Recommendations: /movie/{id}/recommendations
- Scoring: title match (+10), year match (+5), hint in credits (+8), vote average bonus
- Certificate: GB region first, US fallback with mapping (G→U, PG→PG, PG-13→12A, R→15, NC-17→18)

---

## 4. Video Game Tracker

### 4.1 Storage Keys

| Key | Content |
|-----|---------|
| gt_games | Main data array |
| gt_covers | Cover images (id → URL) |
| gt_deleted | Array of deleted IDs |
| gt_deleted_titles | Array of normalised deleted titles |
| gt_formats | User-added custom console formats |
| gt_rawg_key | User's RAWG API key override |

### 4.2 Data Model (per game)

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique ID |
| title | String | Display title |
| sortTitle | String | Normalised for sorting |
| year | Integer | Release year |
| platform | String | pc/console/handheld/mobile/vr/arcade |
| consoleFormat | String | e.g. PS5, Switch 2 |
| category | String | Genre |
| goatTier | Integer | 0-3 |
| rating | String | Rating value |
| played | Boolean | Has been played |
| completed | Boolean | Game completed |
| playSoon | Boolean | Flagged for soon |
| playHistory | Array | [{date, rating, vibes[], notes, historical}] |
| vibes | Array | Vibe tags |
| notes | String | Free text |
| developer | String | Comma-separated |
| publisher | String | Comma-separated |
| metaRating | String | Metacritic score |
| rawgId | Integer | RAWG game ID |
| coverWrong | Boolean | Flagged wrong |
| coverConfirmed | Boolean | Confirmed correct |

### 4.3 Platforms

💻 PC, 🎮 Console, 🕹️ Handheld, 📱 Mobile, 🥽 VR, 🕹 Arcade

### 4.4 Console Sub-Formats

PS1-PS5, PSP, PS Vita, Xbox, Xbox 360, Xbox One, Xbox Series X/S, Switch, Switch 2, N64, GameCube, Wii, Wii U, Game Boy, GBA, DS, 3DS, SNES, Mega Drive, Dreamcast, Saturn + user custom formats

### 4.5 Features

- Same rating/tile/modal system as films
- Play status: Unplayed / Played / Completed
- Metacritic score badge + 🏆 trophy (≥85)
- RAWG API for metadata and covers
- Screenshots from RAWG in tile modal
- Similar games (RAWG game-series + genre search)
- Recently Added sort (by ID within tier sections)

---

## 5. Book Tracker

### 5.1 Storage Keys

| Key | Content |
|-----|---------|
| bt_books | Main data array |
| bt_covers | Cover images (id → URL) |
| bt_deleted | Array of deleted IDs |

### 5.2 Data Model (per book)

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique ID |
| title | String | Display title |
| sortTitle | String | Normalised |
| year | Integer | Publication year |
| author | String | Author name(s) |
| category | String | Genre |
| bookType | String | novel/graphic/nonfiction/short |
| goatTier | Integer | 0-3 |
| rating | String | Rating value |
| read | Boolean | Has been read |
| readSoon | Boolean | Flagged for soon |
| readHistory | Array | [{date, notes}] |
| notes | String | Free text |
| pages | Integer | Page count |
| score | String | Open Library rating (out of 5) |
| olid | String | Open Library ID |
| bookClub | Boolean | Book club selection |
| bookClubNominee | Boolean | Book club nominee |
| audiobook | Boolean | Has audiobook version |
| coverConfirmed | Boolean | Confirmed correct |
| coverWrong | Boolean | Flagged wrong |

### 5.3 Book Types

- 📖 Novel
- 🎨 Graphic Novel
- 📘 Non-Fiction
- 📄 Short Stories

### 5.4 Genre Categories

**Fiction:** Literary Fiction, Science Fiction, Fantasy, Mystery, Thriller, Horror, Supernatural, Romance, Historical Fiction, Crime, Adventure, Dystopian, Satire, Classic, Gothic, Magical Realism, War, Political, Psychological, Coming of Age, Existential

**Non-Fiction:** Science, Economics, Biography, Memoir, History, Philosophy, True Crime, Self-Help, Travel, Sport, Politics, Nature, Technology, Business, Health, Music, Food, Art

**Graphic Novels:** Science Fiction, Fantasy, Horror, Supernatural, Crime, Adventure, Dystopian, Memoir, Biography, Satire, War, Psychological, Coming of Age

### 5.5 Features

- Open Library API for covers, metadata, and ratings
- ISBN lookup in Fix modal
- Score badge (Open Library rating)
- Fetch Scores button (bulk rating fetch)
- Book Club / Nominee / Audiobook tags with filter
- ★★★ GOAT split into Novels and Graphic Novels
- Type-specific genre lists in tile modal

---

## 6. Board Game Tracker

### 6.1 Storage Keys

| Key | Content |
|-----|---------|
| bg_games | Main data array |
| bg_covers | Cover images (id → URL) |

### 6.2 Data Model (per game)

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Unique ID |
| title | String | Display title |
| sortTitle | String | Normalised |
| year | Integer | Publication year |
| designer | String | Designer name(s) |
| category | String | Category |
| players | String | e.g. "2-4" |
| weight | Float | Complexity 1-5 |
| bggRating | String | BGG community rating |
| bggId | Integer | BoardGameGeek ID |
| goatTier | Integer | 0-3 |
| rating | String | Rating value |
| played | Boolean | Has been played |
| playHistory | Array | [{date}] |
| notes | String | Free text |
| coverConfirmed | Boolean | Confirmed correct |

### 6.3 Categories

Strategy, Euro, Worker Placement, Area Control, Deck Building, Engine Building, Cooperative, Legacy, War, Dungeon Crawler, Economic, Negotiation, Deduction, Abstract, Thematic, Campaign, Solo, Party Heavy, Civilization, Exploration

### 6.4 Features

- BGG API via Lambda proxy for metadata and covers
- BGG rating badge + 🏆 trophy (≥8.0)
- Manual Cover URL input field
- Help button with cover instructions
- Square tile aspect ratio (1:1)
- Player count filter
- Weight/complexity sort
- Fix modal with all fields

---

## 7. Shared Features (All Trackers)

### 7.1 Colour Scheme

| Element | Colour |
|---------|--------|
| Background | #0f0f0f |
| Card surface | #1a1a1a |
| Film accent | #c8a400 (gold) |
| Game accent | #2ecc71 (green) |
| Book accent | #e67e22 (orange) |
| Board Game accent | #9b59b6 (purple) |
| Amazing | #1d9e75 |
| Good | #378add |
| Meh | #555 |
| Didn't Like | #d85a30 |
| Never Again | #e24b4a |

### 7.2 Collapsible Sections

When sorted by Tier, items are grouped into labelled sections. Each section header is clickable to collapse/expand. Collapsed state persists during session.

### 7.3 Delete Mode

- Toggle button turns red when active
- Checkbox appears on every tile
- Select all visible (skips GOAT items)
- Inline confirmation (no browser confirm() — blocked in srcdoc iframes)
- Deleted titles stored to prevent re-merge from NEWLIST

### 7.4 Duplicate Finder

Scans for titles that match exactly (case-insensitive). Shows grouped results with metadata for comparison. "Keep" button deletes all others in the group.

### 7.5 Startup Sequence

1. Load from localStorage (or FULL_SEED if first run)
2. Run migrations (ensure all fields exist)
3. Update maxId
4. Merge NEWLIST (add new titles not in database or deleted list)
5. Save
6. Populate filters
7. Render grid
8. Background fetch (covers for items missing them)

---

## 8. Infrastructure Details

### 8.1 S3 Bucket

- **Name:** media-tracker-app-eggnog-915238109618-eu-north-1-an
- **Region:** eu-north-1
- **Static website hosting:** Enabled
- **Public access:** Enabled via bucket policy
- **Index document:** media-tracker.html

### 8.2 CloudFront Distribution

- **Domain:** d21se3p58mjg34.cloudfront.net
- **Origin:** S3 website endpoint (HTTP only)
- **Protocol:** HTTPS (redirect HTTP to HTTPS)
- **Cache invalidation:** Manual via `/*` path or bypass with `?v=N` query parameter

### 8.3 API Gateway

- **Name:** media-tracker-api
- **Type:** HTTP API
- **Invoke URL:** https://ditw97qgs2.execute-api.eu-north-1.amazonaws.com
- **Routes:**
  - POST /save → media-tracker-save Lambda
  - GET /load → media-tracker-load Lambda
  - GET /bgg → media-tracker-bgg-proxy Lambda
- **CORS:** Allow-Origin *, Allow-Methods GET/POST/OPTIONS

### 8.4 Lambda Functions

| Function | Runtime | Purpose |
|----------|---------|---------|
| media-tracker-save | Node.js 20.x | Write item to DynamoDB |
| media-tracker-load | Node.js 20.x | Query all items for userId |
| media-tracker-bgg-proxy | Node.js 20.x | Proxy requests to BGG XML API |

All functions have AmazonDynamoDBFullAccess policy attached.

### 8.5 DynamoDB Table

- **Name:** media-tracker-data
- **Partition key:** userId (String)
- **Sort key:** dataKey (String)
- **Capacity:** On-demand
- **Item structure:** {userId, dataKey, data (JSON string), updatedAt}
- **Large item handling:** Items >350KB split into chunks (dataKey__chunk_0, dataKey__chunk_1, etc.) with a count record (dataKey__chunks)

### 8.6 GitHub Repository

- **URL:** https://github.com/chrismjordan100-cloud/media-tracker
- **Branch:** main
- **CI/CD:** GitHub Actions workflow deploys to S3 on push
- **Secrets:** AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

---

## 9. Client Applications

### 9.1 Desktop App (Windows)

- Edge app mode shortcut on desktop
- Custom icon (Alien movie poster as .ico)
- Target: `msedge.exe --app=https://d21se3p58mjg34.cloudfront.net/media-tracker.html`
- No browser chrome (no URL bar, no tabs)

### 9.2 Mobile App (iOS)

- Safari "Add to Home Screen"
- URL: https://d21se3p58mjg34.cloudfront.net/media-tracker.html
- PWA manifest for app name and icon
- Responsive CSS: smaller tiles on mobile (80px min, 5 columns)

---

## 10. Data Sync Workflow

1. User makes changes on Device A
2. User clicks ☁↑ (push to cloud)
3. All localStorage keys sent to DynamoDB (large items chunked)
4. User opens Device B
5. User clicks ☁↓ (pull from cloud)
6. DynamoDB data written to localStorage, page reloads
7. Trackers display synced data

**Note:** Sync is manual (user-initiated). Last push wins — no conflict resolution.

---

## 11. Seed Data

| Tracker | FULL_SEED | NEWLIST |
|---------|-----------|---------|
| Films/TV | 35 films with ratings/metadata | ~100 titles (unwatched) |
| Video Games | 10 games with GOAT tiers | ~90 titles |
| Books | 100 greatest novels | Stephen King (49), Iain Banks (14), Mo Hayder (10), Roald Dahl (16), Graphic Novels (20), Non-Fiction (20), Book Club (17), + others |
| Board Games | 52 games with full metadata and BGG ratings | — |

---

## 12. Known Limitations

1. **BGG API requires Lambda proxy** — BGG blocks all cross-origin requests
2. **Cloud sync is manual** — no real-time sync or conflict resolution
3. **Single user** — userId hardcoded as 'chris'
4. **CloudFront caching** — changes require invalidation or ?v=N bypass
5. **DynamoDB 400KB limit** — large items must be chunked
6. **iOS Safari** — requires HTTPS (CloudFront) for proper functionality
7. **No offline support** — requires internet for API calls and cloud sync
8. **localStorage limits** — ~5-10MB per origin depending on browser

---

*End of specification.*
