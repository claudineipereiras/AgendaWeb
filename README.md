# AgendaWeb — Your Cultural Web Feed

> Open-web, decentralized cultural calendar and editorial magazine reader for Australia.

## Directory Layout

```
AgendaWeb/
├── Application/              # All application source code
│   ├── assets/               # Production assets (logo.svg, icons)
│   ├── index.html            # Local-first PWA broadsheet client
│   ├── feed.php              # Dual RSS 2.0 + ev: event feed generator
│   ├── calendar.php          # RFC 5545 iCalendar (.ics & webcal://) generator
│   ├── extract.php           # OpenGraph / Twitter Card link scraper for "Read Later"
│   └── sync_sources.php      # Hostinger cron background ingestor (RSS & JSON-LD)
├── Docs/                     # All project documentation & specs
│   ├── Architecture.md       # System topology, protocols, and anti-spam specs
│   ├── Brand_Guidelines.md   # Design tokens, color palette, typography, logo geometry
│   ├── Rules.md              # System constraints and architectural directives
│   ├── Schema.sql            # MariaDB tables & Australian seed feeds
│   ├── Whole_Ideas.pdf       # Initial project evolution & design conversation transcript
│   ├── Idea_Gemini.txt       # Early folder structure notes
│   ├── Logo.svg              # Master vector mark
│   └── icon_Denifition.jpeg  # Visual brand guide mockup
├── .antigravity/             # Antigravity agent system configuration
│   └── rules.md              # Project boundaries for AI pair programming
└── .gitignore                # Git ignore configuration
```

## Core Principles

1. **Zero User Accounts:** Zero consumer login barriers, passwords, or tracking databases. All favorites, feeds, and reading lists live client-side in the browser's IndexedDB.
2. **Stateless PHP Backend:** Pure PHP 8.x + MariaDB designed for shared hosting (Hostinger) with zero Node.js/npm dependencies on the server.
3. **Open Standards:** Built on RSS 2.0 with the Event module (`ev:`), RFC 5545 iCalendar (`webcal://`), and `schema.org/Event` JSON-LD scraping.
4. **Editorial Broadsheet Aesthetic:** Distinctive color palette (Amber Rust `#C85A32`, Sage Green `#4A5D4E`, Nightfall `#1B3B2B`, Chalk `#F7F5F0`, Oat `#E6E2D8`).
5. **Decentralized & Direct:** 0% ticket fee cut, direct checkout links to venues, and embeddable venue widgets (`widget.js`).

## Version Control & Documentation Policy

- **Application code** strictly belongs inside `Application/`.
- **Documentation** strictly belongs inside `Docs/`.
- Every feature or modification is version-controlled via Git.
- When application code, data models, or endpoints change, corresponding documentation in `Docs/` must be updated concurrently in the same commit.
