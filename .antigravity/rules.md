# Antigravity Agent Rules: AgendaWeb

## Mission
Develop, test, and maintain AgendaWeb (`agendaweb.app`), an open-web, decentralized cultural calendar and editorial magazine reader for Australia.

## Project Structure
- `Application/`: All runtime web application code (PHP backend endpoints, PWA frontend HTML/CSS/JS, assets).
- `Docs/`: System architecture specs, brand guidelines, database schema, evolution notes.
- `.antigravity/`: Antigravity agent system instructions & constraints.

## Core Directives

1. **Zero Consumer Authentication:**
   - Never introduce login barriers, passwords, or tracking databases for consumers.
   - All favorites, custom feeds, reading queues, and settings must reside client-side in the browser's IndexedDB.

2. **Architecture Boundaries:**
   - **Backend:** Stateless PHP 8.x + MariaDB running on Hostinger. Avoid node/npm dependencies on the server.
   - **Frontend:** Local-first Progressive Web App (HTML5, Vanilla JS or lightweight reactive framework, CSS variables).
   - **Scrapers:** Ingest events using native `schema.org/Event` (JSON-LD) and standard public Australian RSS feeds (ABC, SBS, The Conversation, The Guardian AU).

3. **Calendar Standards:**
   - Support both single-event download (`calendar.php?id=X`) via RFC 5545 `.ics` and continuous live subscriptions (`webcal://`).
   - Feed outputs must include `<ev:startdate>`, `<ev:enddate>`, `<ev:location>`, and `.ics` enclosures.

4. **Dual-Feed Publishing & Anti-Spam Guardrails:**
   - Maintain a two-tier publishing model: Unlisted/Standalone feeds (open to all via direct link) vs. Public Curated Directory.
   - Public directory indexing requires verification: Custom domain CNAME/DNS TXT, approved `venue.agendaweb.app` subdomain, or commercial venue geocoding.
   - Never allow unverified private house parties to flood the public city directory.

5. **"Zero Extra Work" & Conflict Preservation:**
   - Prioritize automated background ingestion over manual form-filling.
   - Preserve manual edits: Scraper updates must respect `origin = 'manual'`, only updating rows where `origin = 'scraped'`.

6. **Payment Agnostic & Direct Deep-Linking:**
   - Take 0% cut on tickets. Always deep-link directly to the venue's checkout (Shopify, Moshtix, Oztix, Humanitix, Eventbrite) or artist tip jars (Stripe, Ko-fi).

7. **Clean Mode & User Agency:**
   - Support a "Clean Mode" toggle in the PWA that lets users turn off news/politics tabs to use AgendaWeb purely as a dedicated gig guide and event calendar.
   - Allow users to paste and save arbitrary RSS feeds into their local IndexedDB.

8. **Brand Integrity:**
   - Use only verified palette tokens:
     - **Amber Rust:** `#C85A32`
     - **Sage Green:** `#4A5D4E`
     - **Nightfall:** `#1B3B2B`
     - **Chalk:** `#F7F5F0`
     - **Oat:** `#E6E2D8`
   - Typography: `Playfair Display` or `Newsreader` for headings; `Inter` or `Plus Jakarta Sans` for body & UI.

9. **Git Versioning & Documentation Synchronization:**
   - All application code must reside strictly in `Application/`.
   - All documentation must reside strictly in `Docs/`.
   - Every meaningful set of changes must be version-controlled in Git with clear, descriptive commit messages.
   - Whenever changes are made to application code, architecture, or schemas, the impacted documentation in `Docs/` MUST be updated in the same version cycle.
