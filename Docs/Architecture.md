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

## System Topology & Data Flow

```text
               [ Australian Media & Venue Web ]
                │                             │
                │ (Public RSS/Atom)           │ (HTML with Schema.org JSON-LD / .ics)
                ▼                             ▼
       [ ABC, SBS, The Conversation, ]    [ Venue Websites, Gig Guides, ]
       [ Guardian AU Culture         ]    [ The Gasometer, Corner Hotel ]
                │                             │
                └──────────────┬──────────────┘
                               │
                               ▼
               [ cron/sync_sources.php Scraper ]
                  (Runs every 30m via Hostinger Cron)
                               │
                               ▼
               ┌────────────────────────────────┐
               │    MariaDB Database (Hostinger)│
               │  - sources (Feeds & Registry)  │
               │  - events  (Gigs, Exhibitions) │
               │  - items   (News, Articles)    │
               └───────────────┬────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  [ feed.php ]          [ calendar.php ]       [ widget.js ]
  (RSS 2.0 + ev:        (RFC 5545 .ics &       (Embeddable venue
   & .ics enclosure)     live webcal://)        calendar script)
         │                     │                     │
         │                     │                     ▼
         │                     │             [ Venue Websites ]
         ▼                     ▼            (Live auto-synced dates)
  [ Client PWA ]        [ Native Cal Apps ]
  (Broadsheet Reader)   (Apple, Google, Outlook)
         │
         ├──► [ IndexedDB Storage ] (Zero server accounts)
         │      - Starred Gigs & Custom Feeds
         │      - "Read Later" Queue (via api/extract.php)
         │      - Focus Profile ("Clean Mode" toggle)
         │
         └──► [ Direct Ticketing / Tip Jars ] (0% platform cut)
```

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
The PWA presents a curated Australian cultural magazine divided into 5 top-level channels:

| Tab | Content Source | Characteristics |
| :--- | :--- | :--- |
| **⚡ Events** | MariaDB Scraped & Verified Venues | Chronological gigs sorted by `<ev:startdate>` (today, tomorrow, weekend). Sub-filters: Live Music, Art & Fair, Community, Free. One-tap "Add to Calendar". |
| **📰 News** | ABC News, SBS News | Real-time public broadcaster dispatches. |
| **🏛 Politics** | ABC National, The Conversation AU | Civic policy analysis, verified journalism. |
| **🎨 Culture** | ABC Arts, The Guardian AU Culture | In-depth essays, arts coverage, music reviews. |
| **🔖 Reads** | Client IndexedDB | Private offline queue: bookmarked events, custom RSS items, and "Read Later" articles. |

### Clean Mode & Custom Feeds
- **"Clean Mode" Toggle:** Readers who want a distraction-free gig guide can toggle off News, Politics, and Culture tabs with a single setting in the drawer, transforming the PWA into a dedicated music and arts calendar.
- **Custom RSS Subscriptions:** Users can paste any external RSS/Atom feed URL (e.g. a local community paper or niche blog) directly into the app; feeds are saved and synced locally in IndexedDB without creating an account on the server.
- **OPML / JSON Export:** Users can export their entire subscription list and saved events to import into any external RSS or calendar client.

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