# AgendaWeb Hostinger Deployment Runbook

This guide details the step-by-step production deployment for AgendaWeb on Hostinger shared cloud hosting.

---

## 1. Hosting Environment Prerequisites

- **PHP Version:** PHP 8.2 or 8.3 (Enabled via Hostinger hPanel ➔ Advanced ➔ PHP Configuration).
- **Required PHP Extensions:**
  - `pdo_mysql` (Database communication)
  - `dom` & `libxml` (XML & Schema.org HTML parsing)
  - `simplexml` (RSS/Atom ingestion)
  - `curl` (High-performance HTTP requests)
  - `mbstring` (Multibyte text manipulation)
- **Database:** MariaDB 10.6+ / MySQL 8.0+.

---

## 2. Database Provisioning

1. In Hostinger hPanel, navigate to **Databases ➔ Management**.
2. Create a new MariaDB database:
   - Database Name: `u123456789_agenda`
   - Username: `u123456789_admin`
   - Password: `[StrongSecretPassword]`
3. Open **phpMyAdmin**, select the newly created database, and import:
   - File: `Docs/Schema.sql`
4. Verify that tables `sources`, `events`, and `items` were created along with the initial Australian seed rows.

---

## 3. Directory Mapping & File Deployment

Map the repository folders to Hostinger's standard directory structure:

| Repository Path | Hostinger Server Path | Description |
| :--- | :--- | :--- |
| `Application/config/` | `/home/u123456789/config/` *(or inside Application)* | Environment configuration & credentials. |
| `Application/public/` | `/home/u123456789/public_html/` | Public web root served to visitors. |
| `Application/cron/` | `/home/u123456789/cron/` | Scrapers & ingestion jobs. |

### Web Server Configuration (`.htaccess`)
Place this in `public_html/.htaccess` to enable clean URLs and handle subdomain rewrites:

```apache
# Force HTTPS & UTF-8
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Venue Subdomain Routing: venue.agendaweb.app -> feed.php?venue=venue
RewriteCond %{HTTP_HOST} ^([a-zA-Z0-9_-]+)\.agendaweb\.app$ [NC]
RewriteCond %{HTTP_HOST} !^(www|api|domains)\.agendaweb\.app$ [NC]
RewriteRule ^$ /feed.php?venue=%1 [L,QSA]

# Prevent directory listings
Options -Indexes
```

---

## 4. Automating the Ingestion Engine (Cron Setup)

1. In hPanel, navigate to **Advanced ➔ Cron Jobs**.
2. Select **Custom** schedule:
   - **Type:** Every 30 minutes (`*/30 * * * *`).
   - **Command:**
     ```bash
     php /home/u123456789/cron/sync_sources.php > /dev/null 2>&1
     ```
3. Test manual run via SSH or browser to ensure seeds populate without memory or timeout errors.

---

## 5. Verification Checklist

- [ ] `https://agendaweb.app/` loads the PWA interface with logo and styling.
- [ ] `https://agendaweb.app/feed.php` outputs valid RSS 2.0 XML with `<ev:startdate>` tags.
- [ ] `https://agendaweb.app/calendar.php?venue=all` streams a RFC 5545 `.ics` payload.
- [ ] `https://agendaweb.app/api/extract.php?url=https://theconversation.com` returns JSON metadata.
- [ ] Offline caching works when inspecting Application tab in Chrome DevTools.
