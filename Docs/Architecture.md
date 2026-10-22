# AgendaWeb Architecture Specification

## Slogan
YOUR CULTURAL WEB FEED

## Project Vision & Evolution
AgendaWeb (`agendaweb.app`) is the missing open protocol layer for real-world events and cultural dispatches—doing for live culture what podcasting (RSS) did for digital audio.

Unlike commercial platforms (Eventbrite, Humanitix, Meetup, Ticketmaster) that impose heavy onboarding funnels, KYC checks, user account walls, surveillance cookies, and 3%–10% ticket cut fees, AgendaWeb provides:
1. **Zero Consumer Authentication:** 100% open access for readers. No accounts, no passwords, no behavioral tracking. All user preferences, favorites, and reading queues are stored client-side in the browser's IndexedDB.
2. **"Zero Extra Work" Event Ingestion:** Solves the "yet another dashboard" fatigue. Instead of forcing busy venue bookers to type gigs into a new portal, AgendaWeb automatically ingests events directly from where venues already publish using standardized `schema.org/Event` (JSON-LD), native `.ics` calendar exports, and open RSS feeds.
3. **Decentralized Publishing & Syndication:** Supports open standards including RFC 5545 iCalendar (`.ics` and live `webcal://`), RSS 2.0 with the Event module (`ev:`), and embeddable venue widgets.

---

---

## System Topology & Architecture

```text
               [ Public Web Feeds & Venue Websites ]
               (RSS / Atom / WordPress REST / Schema.org JSON-LD / iCal)
                               │
               ┌───────────────┴───────────────┐
               │                               │
    [ Manual Admin Onboarding ]    [ Venue Self-Service Onboarding ]
     (Curator Admin Portal)         (/venues/ & /api/onboard_venue.php)
               │                               │
               │                    (Strategy Auto-Detect & Subdomain Check)
               │                               │
               │                               ▼
               │                  [ Pending Approval Gate ]
               │                  (Curator Review & Verification)
               │                               │
               └───────────────┬───────────────┘
                               │ (Only Approved & Active Sources)
                               ▼
               [ Automated Ingestion Engine ]
                (sync_sources.php / Hostinger Cron / Manual Sync)
                - Ingests only approved sources (is_active = 1, approved)
                - Respects tombstone registry (DELETED_KEYS)
                               │
                               ▼
               ┌────────────────────────────────┐
               │  Hostinger MySQL 8.x Database │
               │  - cities  (Australian Hubs)   │
               │  - sources (Approved Feeds)    │
               │  - venues  (Cultural Spaces)   │
               │  - events  (Verified Gigs)     │
               │  - items   (News & Essays)     │
               │  - users   (Curators & Admins) │
               └───────────────┬────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   [ /api/events.php ]  [ /feed.php ]       [ /calendar.php ]
   [ /api/items.php  ]  (RSS 2.0 + ev:      (RFC 5545 .ics &
   [ /api/cities.php ]   enclosures)         live webcal://)
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                               ▼
                [ Reader Broadsheet PWA ]
                - Clean Masthead & Geographic City Switcher
                - Audience Chips (All, 18+, AA, Kids/Family)
                - Clean Top 5 Category Bubbles + "More ▾" Expander
                - Seen-Card Eye Toggle & Broadsheet Reader
                - Zero tracking / IndexedDB Personal Stores
```

---

## Architectural Pillars

### 1. Curation & Admin Management Portal
The Curator Admin Portal (`/admin/` & `/api/admin.php`) acts as the editorial and operational control center:
* **Manual Feed Registration:** Curators can manually input public RSS/Atom feeds, WordPress REST API endpoints, and Schema.org JSON-LD sites with instant auto-detection and venue linkage.
* **Full CRUD Operations:** Curators have complete capability to **Add**, **Edit/Update** (`update_source`), **Pause/Toggle**, or **Delete** sources.
* **Immediate Cascading Feed Moderation:** Pausing or deleting a source instantly purges all associated events and dispatches from the public broadcast feeds.
* **Published Events Manager:** Direct per-event inspection, search, and immediate removal from live feeds.
* **Tombstone Registry:** Deleted entities receive in-memory and persistent tombstone markers (`DELETED_EVENT_KEYS`, `DELETED_ITEM_LINKS`, `DELETED_SOURCE_URLS`) guaranteeing that deleted content will never be resurrected on subsequent ingestion passes.

### 2. Venue Onboarding & Review Gate
* **Self-Service Verification:** Organizers can submit their venue website via `/venues/` and `/api/onboard_venue.php`.
* **Automated Strategy & Subdomain Detection:** The engine automatically inspects the target website, determines the optimal extraction strategy (Schema.org JSON-LD, WordPress REST, RSS, or iCal), and performs domain/subdomain verification.
* **Mandatory Review Gate:** All incoming venue submissions are staged with `is_active = 0` and `last_status = 'pending'`. They appear in the Admin Portal under **"⏳ Pending Approval"** and are **strictly barred from ingestion** until an editorial curator inspects and approves them.

### 3. Strict Ingestion Engine
* **Approved-Only Ingestion:** The ingestion worker (`sync_sources.php`) executes queries with strict constraints (`WHERE is_active = 1 AND (last_status != 'pending' OR last_status IS NULL)`).
* Only manually added and formally approved sources are processed.
* Prevents unvetted or low-quality scraped events from ever entering the database or public feed.

### 4. Unchanged Storage Layer
Maintains the existing normalized MySQL 8.x schema across `cities`, `sources`, `venues`, `events`, `items`, `suggestions`, `users`, and `user_sessions`.

### 5. Unchanged Public Broadcast APIs
* `/api/events.php`: Public events feed with city, category, age restriction, and text search filters.
* `/api/items.php`: Curated journalism and cultural essays.
* `/api/cities.php`: Supported Australian cultural cities directory.
* `/feed.php`: Dual-mode RSS 2.0 with `<ev:startdate>` and `.ics` enclosures.
* `/calendar.php`: RFC 5545 iCalendar (`.ics` and `webcal://`).

### 6. Clean Broadsheet UI (Client PWA)
* **Top 5 Category Bubbles:** To keep the visual presentation clean and clutter-free, category pills directly beneath the search bar display only the top 5 primary categories (e.g. `All`, `Live Music`, `Art`, `Community`, `Theatre`).
* **No Number Badges:** Bubbles do not show cluttering count numbers.
* **6th "More ▾" Bubble:** A dedicated 6th pill expands all available categories on demand, toggling to "Less ▴" to collapse back.

---

## Publishing Spectrum & Anti-Spam Architecture

To prevent private house parties and spam from cluttering the city calendar without adding consumer login walls, AgendaWeb enforces a two-tier publishing model:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          PUBLISHING SPECTRUM                           │
├───────────────────────────────────┬────────────────────────────────────┤
│    UNLISTED / STANDALONE FEEDS    │     PUBLIC DIRECTORY & SCANNER     │
│          (Open Protocol)          │     (Curated / Verified Layer)     │
│                                   │                                    │
│ - Anyone can generate a feed      │ - Appears in AgendaWeb City Explore│
│ - Only users with direct URL see  │ - Searchable across regional feeds │
│ - Does NOT appear in public city  │ - Requires: Verified domain,       │
│   discovery directory             │   business location, or admin      │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Verification & Trust Anchors
1. **Custom Domain & CNAME Verification:**
   - Established venues point a subdomain (e.g. `events.thegasometerhotel.com.au` CNAME `domains.agendaweb.app`) or place a DNS TXT record (`agendaweb-site-verification=...`).
   - Casual house party hosts will not configure DNS on custom domains, immediately filtering low-effort spam.
2. **Curated Subdomain Claims (`[venue].agendaweb.app`):**
   - Artists or independent organizers without a custom domain submit a lightweight one-time request with proof of cultural activity.
   - Admin approval generates a permanent publishing token. Subdomains act as sovereign cultural handles.
3. **Physical Venue Geocoding:**
   - Public directory events must anchor to a verified commercial/cultural address (cross-referenced with OpenStreetMap or Google Places). Residential addresses are flagged or restricted to unlisted status.
4. **Ticketing Provider Anchors:**
   - Links to recognized ticketing merchants (Oztix, Moshtix, Eventbrite, Humanitix, Bandcamp) receive automatic trust score elevation because merchant KYC is already completed.
5. **Official Email Domain Matching:**
   - Registrations matching the venue's domain (e.g. `bookings@thecornerhotel.com`) grant instant subdomain verification.

---

## Core Protocols & Endpoints

### 1. Dual-Mode RSS 2.0 Feed (`feed.php`)
- **MIME Type:** `application/rss+xml; charset=utf-8`
- **Namespaces:**
  - `xmlns:ev="http://purl.org/rss/1.0/modules/event/"`
  - `xmlns:atom="http://www.w3.org/2005/Atom"`
- **Event Elements:** `<ev:startdate>`, `<ev:enddate>`, `<ev:location>`
- **Calendar Enclosure:** `<enclosure url="https://agendaweb.app/calendar.php?id={id}" type="text/calendar" />`
- **Query Parameters:** `?venue={slug|all}&category={category}`

### 2. Live Calendar Protocol (`calendar.php`)
- **MIME Type:** `text/calendar; charset=utf-8`
- **Specification:** RFC 5545 (iCalendar)
- **Delivery Modes:**
  - **Single Event:** `GET /calendar.php?id={id}` (Direct `.ics` download for one-tap calendar addition)
  - **Live Subscription:** `webcal://agendaweb.app/calendar.php?venue={slug|all}` (Dynamic recurring calendar subscription auto-updating on Apple Calendar, Google Calendar, Outlook when gigs change or sell out)

### 3. OpenGraph "Read Later" Extractor (`api/extract.php`)
- **Endpoint:** `GET /api/extract.php?url={target_url}`
- **Extraction:** Scrapes `<meta property="og:*">`, `<meta name="twitter:*">`, and `<title>` using `DOMXPath` within a 64KB head window.
- **Output:** JSON containing `{url, title, description, image, domain, saved_at}`.
- **Client Storage:** Saved exclusively in the client's IndexedDB `read_later` object store.

### 4. Background Syncer & Ingestion Engine (`cron/sync_sources.php`)
- **Hostinger Cron:** Runs every 30 minutes (`php /path/to/cron/sync_sources.php > /dev/null 2>&1`).
- **Resilient Structured Scraping:**
  - Ingests native RSS 2.0 / Atom from ABC, SBS, The Conversation, and The Guardian AU.
  - Ingests `application/ld+json` (`schema.org/Event`, `MusicEvent`, `ComedyEvent`, `Festival`) from venue sites.
  - Bypasses brittle CSS selectors; immune to frontend redesigns because venues maintain JSON-LD for Google Search ranking.
- **Conflict Resolution (`origin` column):**
  - Scraped events marked `origin = 'scraped'`.
  - If a venue manager manually updates an event, the row transitions to `origin = 'manual'`, preventing future scraper runs from overwriting customized listings.

---

## Frontend Architecture (Local-First PWA)

### Broadsheet Information Architecture
The PWA presents a curated Australian cultural magazine divided into primary channels:

| Tab | Visibility | Content Source | Characteristics & Subcategories |
| :--- | :--- | :--- | :--- |
| **⚡ Events** | **Always Visible (Core)** | Hostinger MySQL Scraped & Verified Venues | Chronological gigs sorted by `<ev:startdate>` (today, tomorrow, weekend). Auto-grouped subcategories: *Live Music*, *Art & Fair*, *Community*, *Free*. Hero card image, circular read check, and bottom-right RSS follow button. |
| **📡 Following** | **Always Visible (Core)** | Client IndexedDB (`followed_entities`) + MySQL Events | Personalized gig guide featuring only events from followed venues, artists, and independent organisers. Dynamic subcategory pills and venue chips. |
| **🔖 Reads** | **Always Visible (Core)** | Client IndexedDB | Private offline queue: bookmarked events, custom personal RSS items, and "Read Later" articles. |
| **📰 News** | *Opt-in Toggle in Settings* | Hostinger MySQL Curated Sources | Real-time reporting from Australian public broadcasters. Subcategories automatically grouped from feed tags (e.g., *Top Stories*, *Regional*, *Policy*). |
| **✍️ Blogs** | *Opt-in Toggle in Settings* | Hostinger MySQL Curated Sources | Independent cultural zines, music reviews, and essays. Subcategories automatically grouped from feed tags (e.g., *Indie Culture*, *Visual Arts*, *Interviews*). |
| **📁 Personal** | *Dynamic (if custom feeds exist)* | Client IndexedDB via CORS Proxy | User-added personal RSS feeds grouped under custom category labels (defaults to *Personal*). |

### Automated Subcategory Grouping & Card Enhancements
- **Circular Checkmark Indicator (`read_cards`):** A clean circle with check inside indicates read/checked status. Cards automatically mark as read upon opening or clicking action buttons, or can be manually toggled.
- **Bottom-Right RSS Follow Button (`followed_entities`):** Each event card includes a follow button with the open RSS icon in the bottom-right corner, enabling users to curate their personalized **Following** channel.
- **Dynamic Subcategory Pills:** The client dynamically inspects the `<category>` tags embedded across active feed items and events, automatically rendering subcategory filter pills without manual database tag maintenance.
- **Responsive Card Image Support:** Cards render high-resolution hero preview images if an image URL is detected in the RSS `<enclosure>`, `<media:content>`, or Schema.org event object.

### Broadsheet Reader Modal & Full-Text RSS Ingestion
- **Distraction-Free Reader View:** Reading news or long-form essays no longer forces readers away to ad-cluttered websites. When an item contains `<content:encoded>` or `<content>` from its RSS feed, a **"📖 Full Text"** button opens a clean, typographic broadsheet reading modal directly within the app.
- **Content Storage:** Stored in Hostinger MySQL as `items.content MEDIUMTEXT` and passed via `GET /api/items.php`. The scraper sanitizes malicious script tags and frames while preserving clean prose formatting, blockquotes, and inline imagery.

### Help, Feedback & Reader Suggestion System
- **In-App Help Modal:** Positioned in the header next to Settings, providing readers with immediate information on the app version (`v0.5.0`), open cultural feed philosophy, and zero-tracking model.
- **Suggestion Inbox Form:** Readers can submit feed nominations, venue tips, and feedback via a built-in form hitting `POST /api/suggestions.php`, which saves into Hostinger MySQL's `suggestions` table.

### Settings Drawer, Portability & Organizer Tools
- **Channel Customization:** The default clean mode runs strictly with **Events**, **Following**, and **Reads**. Users can toggle on **Blogs & Articles** and **News** individually in Settings.
- **Personal RSS Feed Manager:** Users can click **"+ Add Feed"** in Settings to paste any external RSS URL and assign it to a category (defaults to `Personal`).
- **Followed Lineup Manager:** Users can view, inspect, and unfollow venues and artists directly within the Settings drawer.
- **Curator Admin Access:** Direct link to the curator portal (`/admin/`) with key-based authentication.
- **Publisher & Organizer Guides:**
  - *Schema.org Ingestion:* Instructions on embedding `schema.org/Event` JSON-LD.
  - *Event RSS Syndication:* Guide for venues on publishing their own RSS 2.0 with `<ev:startdate>` and image enclosures for automatic ingestion.
  - *Embed Widget:* Copy-paste snippet and configuration for `widget.js`.
- **Data Portability (Export & Import):** Users can export their entire configuration (bookmarks, reads, personal feeds, settings) as `agendaweb-backup.json` to store on phone or cloud, and restore it on any device with zero server login. OPML export is also supported for desktop feed readers.

---

## Curator Admin Manager (`/admin/`)

To provide the curator with centralized control over the curated directory without compromising reader privacy, AgendaWeb includes an isolated Admin Manager:

```text
┌─────────────────────────────────────────────────────────────┐
│                 CURATOR ADMIN MANAGER (/admin/)             │
│        (Secured via Hostinger X-Admin-Key Passphrase)       │
├──────────────────────────────┬──────────────────────────────┤
│     CURATED SUBSCRIPTIONS    │       SUGGESTION INBOX       │
│                              │                              │
│ - Filter by Channel (Events, │ - Triage incoming reader tips│
│   Blogs, News)               │ - Filter by status: new,     │
│ - Add new RSS/JSON-LD feeds  │   read, archived             │
│ - Pause/Activate sources     │ - Mark read, archive, delete │
│ - Instant "Run Sync Now"     │ - Direct reader feed vetting │
└──────────────────────────────┴──────────────────────────────┘
```

- **Authentication:** Validated on every API request via `X-Admin-Key` header matching `config['app']['admin_key']`.
- **Subscription Management:** Full CRUD over the `sources` table. Adding feeds auto-groups subcategories.
- **Suggestion Inbox Workflow:** Curator can quickly triage community suggestions, accept new feeds into `sources`, and manage inbox status.
- **Manual Ingestion Trigger:** Allows on-demand triggering of `sync_sources.php` directly from the browser with live run logs.

---

## Decentralized Network Effects & Federation

1. **Shared Bill Interlinking:**
   - When an artist or band performs at Venue A and later at Venue B, their tag automatically cross-references both venue feeds.
2. **Neighborhood / Regional Bundles:**
   - Feeds can federate into regional bundles (e.g., `melbourne-indie.agendaweb.app` aggregating 10+ local live music venues in Collingwood and Fitzroy).
   - The PWA aggregates and deduplicates events client-side based on `idx_venue_event_time`.
3. **Embeddable `widget.js`:**
   - Independent venues can embed a single script tag on their own homepage to display their upcoming gigs, streaming directly from their normalized AgendaWeb feed.
4. **Frictionless Direct Ticketing & Tips:**
   - Zero ticket merchant intermediary. The "Tickets" button deep-links directly to the venue's chosen checkout (Shopify, Moshtix, Oztix, Humanitix, Eventbrite).
   - Artists can append direct tip jar links (Stripe, Ko-fi) within their listing descriptions with 0% platform fee.