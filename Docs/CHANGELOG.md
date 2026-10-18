# Changelog

All notable changes to the AgendaWeb project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
