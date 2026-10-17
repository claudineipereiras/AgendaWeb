# Changelog

All notable changes to the AgendaWeb project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Complete API specification (`Docs/API_Spec.md`) covering JSON endpoints, RSS 2.0 with Event module (`ev:`), and RFC 5545 iCal.
- Database Schema & Data Dictionary (`Docs/Database_Schema.md`) with Entity-Relationship diagram and index analysis.
- Frontend IndexedDB Specification (`Docs/Frontend_IndexedDB.md`) detailing client-side stores (`read_later`, `starred_events`, `custom_feeds`, `user_settings`).
- Hostinger Deployment Runbook (`Docs/Deployment_Hostinger.md`) for production setup, `.htaccess` rewrites, and 30-minute cron automation.

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
