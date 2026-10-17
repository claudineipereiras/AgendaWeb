# Changelog

All notable changes to the AgendaWeb project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - `Docs/API_Spec.md`: REST and syndication protocol specification.
  - `Docs/Database_Schema.md`: MariaDB data dictionary and entity-relationship models.
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
- MariaDB initial database schema & Australian seed feeds (`Docs/Schema.sql`).
- Git repository initialization and commit history tracking.
