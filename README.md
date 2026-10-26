# AgendaWeb — Your Cultural Web Feed

> Open-web, decentralized cultural calendar and editorial broadsheet reader for Australia.

---

## 1. Project Directory Structure

```
AgendaWeb/
├── Application/                         # All core application source code
│   ├── admin/
│   │   └── index.html                   # Admin & Curator Portal (RBAC, source & event management, bulk operations)
│   ├── api/                             # REST & Ingestion API endpoints (PHP backend)
│   │   ├── admin.php                    # Source sync, moderation, deletion, bulk actions, and feed controls
│   │   ├── auth.php                     # Curator authentication, session management, and password updates
│   │   ├── cities.php                   # Multi-city directory with dynamic event counters
│   │   ├── events.php                   # Public cultural events feed with city, category & audience filtering
│   │   ├── extract.php                  # OpenGraph & metadata extractor for Read Later
│   │   ├── items.php                    # Curated news & blog dispatches feed with full-text article support
│   │   ├── onboard_venue.php            # Venue automated scanner & self-service onboarding
│   │   ├── proxy_feed.php               # CORS proxy for personal RSS/Atom subscriptions
│   │   ├── suggestions.php              # Reader suggestion inbox submission
│   │   └── users.php                    # Staff & role-based access management (Admins & Managers)
│   ├── assets/                          # SVG brand emblems, iconography, and logos
│   │   ├── icon.svg                     # Application PWA square icon
│   │   ├── logo.svg                     # AgendaWeb geometric masthead emblem
│   │   └── techsousa-logo.png           # TechSousa development attribution logo
│   ├── config/
│   │   ├── .env.example                 # Environment variables template
│   │   └── config.php                   # Database & application environment configuration
│   ├── css/
│   │   ├── style.css                    # Broadsheet editorial typography & responsive styles
│   │   └── tokens.css                   # Design tokens (Racing Green, Amber Rust, Chalk, Nightfall dark mode)
│   ├── js/
│   │   ├── api.js                       # Stateless client API connector with retry logic
│   │   ├── app.js                       # Broadsheet client controller (filters, rendering, state, proximity)
│   │   └── db.js                        # Client-side IndexedDB database (zero server tracking)
│   ├── src/                             # Backend PHP helper classes
│   │   ├── Auth.php                     # Authentication & role verification library
│   │   └── Database.php                 # PDO database singleton connection manager
│   ├── venues/
│   │   └── index.html                   # Venue Self-Service Portal & Strategy Scanner
│   ├── calendar.php                     # RFC 5545 iCalendar (.ics & webcal://) generator with 304 caching
│   ├── dev_server.js                    # Local development server with live RSS/REST ingestion
│   ├── feed.php                         # Dual RSS 2.0 + ev: Event module syndication generator with 304 caching
│   ├── index.html                       # Broadsheet PWA web application (reader-facing)
│   ├── manifest.webmanifest             # Progressive Web App manifest
│   ├── sw.js                            # Offline-first Service Worker with network fallback
│   ├── sync_sources.php                 # Background cron ingestor (Hostinger scheduled task)
│   ├── widget-demo.html                 # Live preview demo for embeddable venue widgets
│   └── widget.js                        # Zero-dependency embeddable venue calendar widget
├── Docs/                                # Comprehensive technical documentation (kept local)
│   ├── API_Spec.md                      # Complete REST and syndication API contracts
│   ├── Architecture.md                  # System topology, ingestion strategies, and protocols
│   ├── Brand_Guidelines.md              # Editorial color palette, geometry, and typography
│   ├── CHANGELOG.md                     # Version history and release notes
│   ├── Database_Schema.md               # Hostinger MySQL 8.x schema documentation
│   ├── Deployment_Hostinger.md          # Production deployment & Hostinger cron guide
│   ├── Frontend_IndexedDB.md            # Client-side local storage and retention guide
│   ├── Rules.md                         # Architecture constraints and design directives
│   └── Schema.sql                       # Production MySQL DDL and schema seeds
└── .gitignore                           # Git ignore rules
```

---

## 2. System Architecture & Component Interaction

```text
                                [ LIVE CULTURAL WEB ]
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │ (Public RSS/Atom Feeds)         │ (WordPress REST / JSON-LD)      │ (Venue Submissions)
         ▼                                 ▼                                 ▼
   [ News Sources ]               [ Venues ]                        [ Venue Onboarding ]
   • Syndicated RSS/Atom          • Cultural Venues & Stages        • venues/index.html
   • Public Editorial Feeds       • Schema.org JSON-LD              • Auto-detect strategy
   • Full-text Article Modules    • HTML Microdata & Tribe Events   • Domain verification
   • Cultural News & Blogs        • WordPress REST API Endpoints
         │                                 │
         └────────────────┬────────────────┘
                          ▼
             [ INGESTION ENGINE (dev_server.js / sync_sources.php) ]
              - Multi-strategy live ingestion (100% mock-free)
              - Automatic ISO date normalization & entity decoding
              - Circuit breaker backoff for resilient polling
              - Fuzzy event deduplication (guest/support variances)
              - Tombstone blacklist (prevents re-scraping deleted items)
                          │
                          ▼
            [ STORAGE LAYER (Hostinger MySQL 8.x / Local JSON Store) ]
              - cities:      Multi-city registry & coordinates
              - sources:     Active feeds, poll frequency, health & strategy
              - venues:      Cultural spaces, geolocations, contact records
              - events:      Gigs, exhibitions, age restrictions, ticket links
              - items:       News articles & cultural blogs with full text
              - users:       Admin & Manager role-based credentials (bcrypt)
              - suggestions: Reader tips and venue feed submissions
                          │
         ┌────────────────┴───────────────────────────────┐
         ▼                                               ▼
  [ PUBLIC BROADCAST APIs ]                       [ CURATION & ADMIN PORTAL ]
  • /api/events.php                               • /admin/index.html
    - Multi-city (Melbourne, Sydney, etc.)         - Role hierarchy (Admin & Manager)
    - Proximity radius (📍 Near Me 10km)           - Curated Subscriptions management
    - Audience ratings (All, 18+, AA, Kids)        - Published Events moderation
  • /api/items.php (News & Blogs)                  - Multi-select bulk actions (Pause, Delete)
  • /api/cities.php (Dynamic counters)             - Cascading deletion with tombstone creation
  • /feed.php (RSS 2.0 + ev: with 304 ETag)        - On-demand "⚡ Run Sync Now" with live logs
  • /calendar.php (RFC 5545 iCal & webcal://)      - Reader suggestions triage inbox
         │
         ▼
  [ CLIENT BROADSHEET PWA (index.html) ]
  • Zero user accounts or tracking
  • Adaptive theme: Swiss Editorial Cream / Nightfall Dark Mode
  • Centered editorial filter pills & audience chips
  • Top 5 dynamic category bubbles with "More ▾" expander
  • Hide seen cards toggle (eye icon)
  • Full-text distraction-free reader modal
  • Client-side IndexedDB: saved gigs, reading queue, followed venues
  • Embeddable venue widget integration (widget.js)
```

---

## 3. How Core Workflows Function

### A. Manual Curation & Venue Onboarding Review Gate
1. **Manual Curator Additions:** Curators manually register public RSS/Atom feeds, WordPress REST APIs, or Schema.org event pages directly in the Admin Portal ([`/admin/`](http://localhost:8001/admin/index.html)). These sources are active immediately.
2. **Venue Onboarding Review Gate:** Venues and organizers submit their websites via `/venues/index.html`. The engine auto-detects the extraction strategy (Schema.org JSON-LD, WordPress REST, or RSS) and checks domain verification. Submissions are staged in the **"⏳ Pending Approval"** queue and are **never ingested** until a curator approves them.
3. **Full Source Management:** Curators can **Add**, **Edit/Update** (name, URL, category, strategy, address), **Pause/Resume**, or **Delete** any source at any time, with multi-select bulk operations.

### B. Strict Ingestion Engine
1. **Approved-Only Ingestion:** The ingestion worker (`sync_sources.php`) queries exclusively:
   ```sql
   SELECT * FROM sources WHERE is_active = 1 AND (last_status != 'pending' OR last_status IS NULL);
   ```
2. **Cascading Removal & Tombstones:** Deleting a source or event immediately purges it from the live public feeds (`/api/events.php` and `/api/items.php`) and registers tombstone keys (`DELETED_EVENT_KEYS`, `DELETED_ITEM_LINKS`, `DELETED_SOURCE_URLS`) so deleted content is never resurrected on future scraper passes.
3. **Double-Encoded HTML Entity Sanitization:** Strips multi-pass encoded HTML and extracts high-resolution promotional artwork while filtering out publisher SVG logos and tracking pixels.

### C. Clean Reader Broadsheet Experience
1. **Top 5 Category Bubbles:** To keep the broadsheet uncluttered, category bubbles beneath the search bar display only the top 5 primary categories without number counts. A 6th **"More ▾"** bubble expands all categories on demand, toggling to **"Less ▴"** to collapse.
2. **Proximity "Near Me" Filtering:** When enabled, the PWA uses the browser's Geolocation API to calculate distances via the Haversine formula, filtering events within 10 km.
3. **Zero Registration:** Readers never create accounts or submit personal data to the server.
4. **Local Storage:** All bookmarks, followed venues, channel preferences, and seen-card states persist in the browser's local IndexedDB.
5. **Offline Resilience:** The Service Worker (`sw.js`) employs a Network-First strategy with offline cache fallback.

---

## 4. Local Development & Verification

Run the local server:
```bash
node Application/dev_server.js
```
The server binds to port `8001` (primary) and `8000` (mirror), persisting all curated sources, venues, events, and articles in `Application/data/*.json`.

Access points:
- **Broadsheet PWA:** `http://localhost:8001/index.html`
- **Admin Portal:** `http://localhost:8001/admin/index.html` (Credentials: `admin@agendaweb.app` / `AgendaAdmin2026!`)
- **Venue Portal:** `http://localhost:8001/venues/index.html`
- **Widget Demo:** `http://localhost:8001/widget-demo.html`
- **Events JSON API:** `http://localhost:8001/api/events.php?city=melbourne`
- **Syndication RSS/Atom:** `http://localhost:8001/feed.php?city=melbourne`
- **iCalendar Export:** `http://localhost:8001/calendar.php?venue=all`
- **News JSON API:** `http://localhost:8001/api/items.php?tab=news`


