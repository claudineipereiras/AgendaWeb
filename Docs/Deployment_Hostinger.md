# AgendaWeb Hostinger Deployment Runbook

This guide details the step-by-step production deployment for AgendaWeb on Hostinger shared or cloud hosting.

---

## 1. Hosting Environment Prerequisites

- **PHP Version:** PHP 8.2 or 8.3 (Enabled via Hostinger hPanel ➔ Advanced ➔ PHP Configuration).
- **Required PHP Extensions:**
  - `pdo_mysql` (Database communication)
  - `dom` & `libxml` (XML & Schema.org HTML parsing)
  - `simplexml` (RSS/Atom ingestion)
  - `curl` (High-performance HTTP requests)
  - `mbstring` (Multibyte text manipulation)
- **Database:** Hostinger MySQL 8.0+.
- **SSL Certificate:** Active Let's Encrypt SSL certificate (Free via Hostinger hPanel).

---

## 2. Database Provisioning

1. In Hostinger hPanel, navigate to **Databases ➔ Management**.
2. Create a new MySQL database:
   - **Database Name:** e.g., `u123456789_agenda`
   - **Username:** e.g., `u123456789_admin`
   - **Password:** `[StrongSecretPassword]`
3. Open **phpMyAdmin**, select the newly created database, and import:
   - **File:** `Docs/Schema.sql`
4. **Clean-Slate Verification:**
   - The tables `cities`, `sources`, `venues`, `events`, `items`, `suggestions`, `users`, and `user_sessions` are created with correct relational keys and indexes.
   - Initial reference data is populated for Australian cultural centers (`cities` table).
   - `sources`, `venues`, `events`, and `items` start **empty (clean slate)** — no dummy or mock feeds are seeded. You will add real feeds via the Admin Portal or Venue Onboarding.

---

## 3. Directory Mapping & File Deployment

Map the repository folders to Hostinger's standard directory structure:

| Repository Path | Hostinger Server Path | Description |
| :--- | :--- | :--- |
| `Application/` | `/home/u123456789/public_html/` | Public web root served directly to visitors. |
| `Application/config/config.local.php` | `/home/u123456789/public_html/config/config.local.php` | Production credentials (git-ignored override). |
| `Application/sync_sources.php` | `/home/u123456789/public_html/sync_sources.php` | Ingestion engine script triggered by cron. |

### 3.1 Deploying via Git or File Manager
1. Upload the contents of `Application/` directly into your Hostinger `public_html/` directory.
2. Ensure directory permissions:
   - Directories: `755`
   - Files: `644`

### 3.2 Setting Up Production Database Credentials
Create a file named `config.local.php` inside `public_html/config/`:

```php
<?php
// Hostinger Production Configuration Override
return [
    'db' => [
        'host'    => 'localhost',
        'name'    => 'u123456789_agenda',
        'user'    => 'u123456789_admin',
        'pass'    => 'YourActualSecretPasswordHere',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'env'       => 'production',
        'url'       => 'https://agendaweb.app',
        'timezone'  => 'Australia/Melbourne',
        'admin_key' => 'YourUniqueAdminApiKeyHere',
    ],
];
```

### 3.3 Web Server Configuration (`.htaccess`)
Ensure this `.htaccess` file is placed in `public_html/`:

```apache
# Force HTTPS & UTF-8
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Venue Subdomain Routing: venue.agendaweb.app -> feed.php?venue=venue
RewriteCond %{HTTP_HOST} ^([a-zA-Z0-9_-]+)\.agendaweb\.app$ [NC]
RewriteCond %{HTTP_HOST} !^(www|api|domains)\.agendaweb\.app$ [NC]
RewriteRule ^$ /feed.php?venue=%1 [L,QSA]

# Protect configuration & data directories from direct HTTP access
RewriteRule ^config/ - [F,L]
RewriteRule ^data/ - [F,L]
RewriteRule ^src/ - [F,L]

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
     php /home/u123456789/public_html/sync_sources.php > /dev/null 2>&1
     ```
3. Test a manual run via SSH or browser admin portal ("⚡ Run Sync Now") to verify clean execution.

---

## 5. Verification Checklist

- [ ] `https://agendaweb.app/` loads the PWA editorial broadsheet interface.
- [ ] `https://agendaweb.app/feed.php` outputs valid RSS 2.0 XML with `<ev:startdate>` and Dublin Core tags.
- [ ] `https://agendaweb.app/calendar.php?venue=all` streams a RFC 5545 `.ics` payload.
- [ ] `https://agendaweb.app/admin/` allows logging in with the configured `admin_key`.
- [ ] Admin "⚡ Add Curated Feed" stores source directly in MySQL database.
- [ ] Cron job executes without memory limits or timeout errors.
- [ ] Offline caching works via Service Worker (`sw.js`).
