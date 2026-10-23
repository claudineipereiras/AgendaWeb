# Changelog

All notable changes to the AgendaWeb project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.1] - 2026-10-23

### Added
- **Local Disk Database Persistence (`Application/data/*.json`):**
  - Dev server (`dev_server.js`) now persists all curated sources, venues, events, items, and tombstones directly to disk in `Application/data/`.
  - Ensures manually added feeds and edits survive server restarts and process reloads without relying on mock data.
- **Admin Source Edit Modal (`update_source`):**
  - Added "✏️ Edit" button and modal on source cards in `/admin/index.html`.
  - Enabled live editing of source name, category tab, and target URL via `api/admin.php?action=update_source`.
- **Syndication Query Parameter Filters (`feed.php`):**
  - RSS 2.0 / `ev:` syndication generator now supports `?city=`, `?venue=`, and `?category=` URL parameters.
  - Generates custom, targeted RSS feeds for any third-party RSS reader (e.g., NetNewsWire, Feedly, Inoreader).
  - Implemented IPv4 fallback for Node.js fetch to ensure reliable connectivity to Cloudflare-protected endpoints.

### Changed
- **Purge of Hardcoded Test Seeds:**
  - Removed all hardcoded test feeds from `Docs/Schema.sql` and `dev_server.js`.
  - Clean-slate architecture: application starts empty (`count: 0`), ingesting only authentic feeds manually added or approved by curators.
- **UI Category Pills Refinement:**
  - Streamlined category filter chips in `Application/index.html` and `app.js` to show top 5 categories without count badges.
  - Added a 6th "More ▾" expander chip that reveals all categories when tapped and toggles back to "Less ▴".
- **Documentation Overhaul:**
  - Updated `Docs/Deployment_Hostinger.md`, `Docs/Database_Schema.md`, `Docs/Rules.md`, `Docs/Architecture.md`, and `README.md` to reflect the 5-tier architecture, Hostinger directory mapping, and local persistence.

---

## [0.7.0] - 2026-10-22

### Added
- **Live Feed Moderation & Cascading Purge (`/api/admin.php`):**
  - Added **"🗓️ Published Events"** management tab to Curator Admin Manager with live search, venue/date tags, and one-click "✕ Remove from Feed".
  - Cascading Source Deletion & Deactivation: Toggling a source inactive or deleting it instantly hides or removes all associated events and dispatches from the public feeds (`/api/events.php` and `/api/items.php`).
  - Added `delete_event` and `delete_item` administrative actions with tombstone protection (`DELETED_EVENT_KEYS`, `DELETED_ITEM_LINKS`, `DELETED_SOURCE_URLS`) preventing deleted items from re-appearing during scheduled scraper runs.
- **Role-Based Admin Authentication (`/api/auth.php`):**
  - Session-based Bearer token authentication with password hashing (`password_hash`), user session tracking (`user_sessions`), and role authorization (`admin`, `editor`, `curator`).
  - Seamless fallback to `X-Admin-Key` for legacy automation.
- **Read Card Visibility Toggle (`👁️`):**
  - Added an eye toggle button in the application header alongside Help and Settings, enabling readers to hide or reveal cards marked as read/seen.
- **Branding & Visual Polish:**
  - Standardized branding to "AgendaWeb powered by TechSousa".

---

## [0.6.0] - 2026-10-21

### Added
- **Multi-City Cultural Directory (`/api/cities.php` & Migration `002`):**
  - Normalized database schema supporting Australian cultural centers: Melbourne, Sydney, Brisbane, Perth, Adelaide, Hobart.
  - Header geographic selector allowing instantaneous switching between cultural hubs with persistent local preferences.
- **Audience & Age Restriction Filters:**
  - Added `age_restriction` (`all_ages`, `18_plus`, `licensed_all_ages`) and `is_family_friendly` flags to events schema and API.
  - Material 3 tonal audience filter chips: All Audiences, 18+ Nightlife, All Ages, and Kids & Family.
- **Multi-Strategy Ingestion Engine (`sync_sources.php` & `dev_server.js`):**
  - Ingestion strategy architecture supporting RSS/Atom (`ev:`), Schema.org JSON-LD crawler, RFC 5545 iCalendar, and custom venue scrapers.
  - Live production ingestion strategy for Bar Oussou live music gig guide, pulling 100+ live upcoming gigs.
- **Purge of Dummy Data:**
  - Fully eliminated all mock fallback arrays (`FALLBACK_EVENTS`, `FALLBACK_ITEMS`) from frontend client (`app.js`) and backend server (`dev_server.js`). All feeds reflect 100% authentic live syndicated sources.

---

## [0.5.0] - 2026-10-19

### Added
- **Curator Admin Manager (`/admin/` & `/api/admin.php`):** Standalone management portal for the platform curator. Features:
  - Secure passkey login (`X-Admin-Key` header matching `config['app']['admin_key']`).
  - Real-time directory overview stats (active feeds, total events, articles, pending suggestions).
  - Curated feed subscription management across channels (`events`, `news`, `blogs`) with instant pause/active toggles, deletion, and new feed registration.
  - One-click "⚡ Run Sync Now" button to trigger scraper passes on demand with live execution feedback.
  - Complete Hostinger Cron configuration runbook.
- **Suggestion Inbox & Help Modal (`/api/suggestions.php`):**
  - Added Help button (`ℹ Help`) in the application header displaying app philosophy and version (`v0.5.0`).
  - Built-in reader suggestion form with category picker (`feed_nomination`, `venue_tip`, `feature_idea`, `bug_report`, `other`).
  - Stored in Hostinger MySQL `suggestions` table and directly triaged in the Curator Admin Manager (`new`, `read`, `archived`).
- **Full-Text Broadsheet Reader Modal (`items.content`):**
  - Ingests `<content:encoded>` and `<content>` modules from RSS feeds into Hostinger MySQL `items.content MEDIUMTEXT`.
  - Added **"📖 Full Text"** button on news, blog, and personal feed cards for distraction-free reading without navigating away to third-party ad-heavy websites.
- **UI Scaling & Typography Refinements:**
  - Scaled typography, navigation tabs, filter pills, and action icons by 25% for readability.
  - Increased card title size (1.45rem), summary size (1.1rem), circular checkmark icons (25px), and RSS icons (17px).
  - Removed "curated broadsheet" and "clean gig guide" text badges for a cleaner broadsheet layout.
  - Renamed Settings channel: "✍️ Independent Blogs & Essays" → "✍️ Blogs & Articles" (subtitle: "Curated blogs and cultural reviews").
  - Renamed Settings channel: "📰 Public Journalism & News" → "📰 News" (subtitle: "Public broadcasters").
  - Added direct link to Curator Admin Manager inside Settings drawer.

---

## [0.4.0] - 2026-10-18

### Added
- **Circular Checkmark Indicator (`read_cards`):** Circle with check inside indicating read/checked status on all cards. Automatically triggers when a card or action link is opened, with full manual toggle support.
- **Event Card Follow Button (with RSS icon):** Dedicated follow button placed in the bottom-right corner of event cards with open RSS iconography to follow venues, artists, and independent organisers.
- **Following Channel (`📡 Following`):** Top-level navigation tab displaying exclusively upcoming events from followed entities. Includes dynamic subcategory pills and interactive header chips with one-tap unfollow.
- **IndexedDB Schema v2 (`AgendaWebDB`):** Added `read_cards` and `followed_entities` stores with seamless database migration, plus backup export/import synchronization.
- **Settings Followed Lineup Manager:** Direct management list within the Settings drawer showing followed entities and quick removal.

---

## [0.3.0] - 2026-10-18

### Added
- 4-Channel Information Architecture: **Events**, **Reads**, **Blogs**, and **News** (Events + Reads default clean broadsheet).
- Automated Subcategory Grouping: Dynamic client extraction of `<category>` tags from feed items and events to auto-generate filter pills.
- Card Hero & Poster Image Support (`image_url` on cards and DB schemas).
- Personal Feeds Manager: "+ Add Feed" modal with custom grouping tags (`Personal` or custom).
- Personal Feed CORS Proxy endpoint (`/api/proxy_feed.php`).
- Settings Data Portability: Single-click JSON backup export/import and OPML export.
- Publisher & Organizer Guides in Settings (Schema.org JSON-LD, Event RSS syndication guide, and `widget.js` embed).

### Changed
- Standardized database specification to Hostinger MySQL 8.x across all documentation and schemas.

---

## [0.2.0] - 2026-10-18

### Added
- Centralized configuration system in `Application/config/config.php` with `.env.example` template.
- Thread-safe PDO `Database` singleton connection manager in `Application/src/Database.php`.
- Client JSON REST endpoints:
  - `GET /api/events.php`: Query upcoming cultural events with venue/category filtering and pagination.
  - `GET /api/items.php`: Query syndicated news, politics, and culture dispatches with pagination.
  - `GET /api/extract.php`: OpenGraph and Twitter card metadata extractor for link previewing.
- Modular frontend assets:
  - `Application/css/tokens.css`: Design tokens and typography variables.
  - `Application/css/style.css`: Broadsheet layout, responsive cards, and settings drawer modal.
  - `Application/js/db.js`: Native IndexedDB client repository (`AgendaWebDB`) supporting `read_later`, `starred_events`, and `user_settings`.
  - `Application/js/api.js`: Fetch client abstraction for JSON backend endpoints.
  - `Application/js/app.js`: Main client controller handling tab routing, category filters, and bookmarking.
  - `Application/manifest.webmanifest`: Progressive Web App metadata.
  - `Application/sw.js`: Service worker providing offline shell caching.
- Interactive "Clean Mode" toggle in settings drawer for instant switching between broadsheet news reader and dedicated gig guide.
- Complete documentation contracts:
  - `Docs/API_Spec.md`: REST and syndication protocol specification (including embeddable `widget.js`).
- Embeddable Venue Widget:
  - `Application/widget.js`: Standalone, zero-dependency calendar widget for venue homepages.
  - `Application/widget-demo.html`: Integration test page demonstrating third-party venue embedding.
  - `Docs/Database_Schema.md`: Hostinger MySQL (8.x) data dictionary and entity-relationship models.
  - `Docs/Frontend_IndexedDB.md`: Client-side offline storage specification.
  - `Docs/Deployment_Hostinger.md`: Production deployment runbook.

### Changed
- Refactored `Application/feed.php`, `Application/calendar.php`, and `Application/sync_sources.php` to use the unified `Database` singleton.
- Enforced manual edit protection (`origin = 'manual'`) in `sync_sources.php` scraper upsert.
- Decoupled `Application/index.html` from inline styles and scripts into modular components.

---

## [0.1.0] - 2026-10-18

### Added
- Initial project scaffolding from Gemini design session.
- Core PHP backend scripts: `feed.php`, `calendar.php`, `extract.php`, `sync_sources.php`.
- Broadsheet PWA frontend prototype in `index.html`.
- Production SVG mark (`assets/logo.svg`).
- System constraints & architectural rules (`Docs/Rules.md`, `.antigravity/rules.md`).
- Hostinger MySQL (8.x) initial database schema & Australian seed feeds (`Docs/Schema.sql`).
- Git repository initialization and commit history tracking.
