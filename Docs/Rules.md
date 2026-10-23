# Antigravity Agent Rules: AgendaWeb

## Mission
Develop, test, and maintain AgendaWeb (`agendaweb.app`), an open-web, decentralized cultural calendar and editorial magazine reader for Australia.

## Project Structure
- `Application/`: All runtime web application code (PHP backend endpoints, PWA frontend HTML/CSS/JS, assets, and local data persistence in `data/`).
- `Docs/`: System architecture specs, brand guidelines, database schema, evolution notes.
- `.antigravity/`: Antigravity agent system instructions & constraints.

## Core Directives

1. **Zero Consumer Authentication:**
   - Never introduce login barriers, passwords, or tracking databases for consumers.
   - All favorites, custom feeds, reading queues, and settings must reside client-side in the browser's IndexedDB.

2. **5-Tier Architectural Model:**
   - **Tier 1 (Curation & Admin Portal):** Manual curation gate. All public feeds (RSS/Atom, WordPress REST, JSON-LD) must be added, edited, updated, or removed via the Admin Portal (`/admin/`).
   - **Tier 2 (Venue Onboarding Review Gate):** Venue self-service onboarding (`/venues/`) automatically executes strategy detection and subdomain validation, but submits venues with `last_status = 'pending'`. Venues are held in review until approved by an administrator.
   - **Tier 3 (Strict Ingestion Engine):** The ingestion engine (`sync_sources.php` & `dev_server.js`) strictly polls and synchronizes approved, active sources. Pending or unverified submissions are never ingested.
   - **Tier 4 (Relational Storage Layer):** Relational MySQL 8.x schema (and local `Application/data/*.json` development mirror) with cascading foreign keys and tombstone blacklists preventing resurrected deletions.
   - **Tier 5 (Public Broadcast APIs & Syndication):** Unrestricted, open syndication endpoints (`/feed.php` dual RSS 2.0 + `ev:`, `/calendar.php` RFC 5545 iCal, `/api/events.php`, `/api/items.php`) supporting multi-city, venue, and category query parameters.

3. **Clean-Slate Initial State:**
   - Never reintroduce hardcoded dummy data or mock seeds into `Schema.sql`, `dev_server.js`, or the frontend code.
   - The application and database must initialize empty (`count: 0`), ready for authentic manual curation.

4. **Broadsheet UI Minimalism & Category Expander:**
   - Under the search bar in the Broadsheet UI, display only the **top 5 categories** as clean pills.
   - Do NOT display count numbers or badges inside the category pills.
   - The 6th pill must be an expandable **"More ▾"** toggle that reveals the remaining categories when tapped, collapsing back to **"Less ▴"**.

5. **Dual-Feed Publishing & Anti-Spam Guardrails:**
   - Maintain a two-tier publishing model: Unlisted/Standalone feeds (open to all via direct link) vs. Public Curated Directory.
   - Public directory indexing requires verification: Custom domain CNAME/DNS TXT, approved `venue.agendaweb.app` subdomain, or commercial venue geocoding.
   - Never allow unverified private house parties to flood the public city directory.

6. **"Zero Extra Work" & Conflict Preservation:**
   - Prioritize automated background ingestion over manual form-filling.
   - Preserve manual edits: Scraper updates must respect `origin = 'manual'`, only updating rows where `origin = 'scraped'`.

7. **Calendar Standards:**
   - Support both single-event download (`calendar.php?id=X`) via RFC 5545 `.ics` and continuous live subscriptions (`webcal://`).
   - Feed outputs must include `<ev:startdate>`, `<ev:enddate>`, `<ev:location>`, and `.ics` enclosures.

8. **Clean Mode & User Agency:**
   - Support a "Clean Mode" toggle in the PWA that lets users turn off news/politics tabs to use AgendaWeb purely as a dedicated gig guide and event calendar.
   - Allow users to paste and save arbitrary RSS feeds into their local IndexedDB.

9. **Brand Integrity:**
   - Use only verified palette tokens:
     - **Amber Rust:** `#C85A32`
     - **Sage Green:** `#4A5D4E`
     - **Nightfall:** `#1B3B2B`
     - **Chalk:** `#F7F5F0`
     - **Oat:** `#E6E2D8`
   - Typography: `Playfair Display` or `Newsreader` for headings; `Inter` or `Plus Jakarta Sans` for body & UI.

10. **Git Versioning & Documentation Synchronization:**
    - All application code must reside strictly in `Application/`.
    - All documentation must reside strictly in `Docs/`.
    - Every meaningful set of changes must be version-controlled in Git with clear, descriptive commit messages.
    - Whenever changes are made to application code, architecture, or schemas, the impacted documentation in `Docs/` MUST be updated in the same version cycle.
