# AgendaWeb Database Schema & Data Dictionary

This document specifies the Hostinger MySQL (8.x) relational database design for AgendaWeb.

---

## 1. Entity-Relationship Overview

```mermaid
erDiagram
    SOURCES ||--o{ ITEMS : "syndicates"
    SOURCES ||--o{ EVENTS : "originates"
    SOURCES ||--o| VENUES : "links"
    VENUES ||--o{ EVENTS : "hosts"

    SOURCES {
        int id PK
        string slug UK
        string name
        enum type
        string url
        enum category_tab
        boolean is_active
        datetime last_polled_at
    }

    VENUES {
        int id PK
        string slug UK
        string name
        string address
        string website_url
        string feed_url
        int source_id FK
        boolean is_active
        timestamp created_at
    }

    EVENTS {
        int id PK
        string venue_slug
        string title
        text description
        string category
        datetime start_time
        datetime end_time
        string venue_name
        string address
        string ticket_url
        string image_url
        enum origin
        boolean is_verified
        timestamp created_at
    }

    ITEMS {
        int id PK
        int source_id FK
        enum category_tab
        string category
        string title
        string link UK
        text summary
        string image_url
        datetime published_at
        timestamp created_at
    }
```

---

## 2. Table Specifications

### 2.1 `sources`
Maintains the registry of all external ingestion targets (RSS feeds and scrape targets).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT`, `PRIMARY KEY` | Unique source identifier. |
| `slug` | `VARCHAR(60)` | `UNIQUE`, `NOT NULL` | Human-readable identifier (e.g., `abc-news`, `trouble-mag`, `gasometer-hotel`). |
| `name` | `VARCHAR(120)` | `NOT NULL` | Display name of the publisher or venue. |
| `type` | `ENUM` | `'rss', 'scrape_event'` | Ingestion strategy: standard XML feed vs HTML JSON-LD scraping. |
| `url` | `VARCHAR(255)` | `NOT NULL` | Ingestion target endpoint (feed URL or venue gigs page). |
| `category_tab` | `ENUM` | `'events', 'news', 'politics', 'culture', 'blogs'` | Target magazine channel destination. |
| `is_active` | `TINYINT(1)` | `DEFAULT 1` | Soft toggle to pause polling without deletion. |
| `last_polled_at` | `DATETIME` | `NULL` | Timestamp of last ingestion check. |
| `last_status` | `ENUM` | `'active', 'updated', 'failed', 'stale', 'pending'` | Real-time scraper health state. |
| `http_code` | `SMALLINT` | `NULL` | Last HTTP response code from target site (e.g. 200, 404). |
| `last_error` | `VARCHAR(255)` | `NULL` | Diagnostic error message if ingestion failed. |
| `item_count` | `INT` | `DEFAULT 0` | Total events or articles extracted during last poll. |

**Indexes:**
- `INDEX (category_tab)`: Fast filtering by channel.
- `INDEX (is_active)`: Quick lookup of enabled sources for cron runners.
- `INDEX (last_status)`: Scraper health monitoring and failing feed alerts.

---

### 2.2 `venues`
Stores physical and cultural venues with their addresses, official websites, and syndication/feed links. Automatically populated/updated when event websites are auto-detected and scraped.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT`, `PRIMARY KEY` | Unique venue identifier. |
| `slug` | `VARCHAR(60)` | `UNIQUE`, `NOT NULL` | URL-safe slug identifying the venue (e.g. `the-gasometer-hotel`). |
| `name` | `VARCHAR(150)` | `NOT NULL` | Full display name of the venue or organizer. |
| `address` | `VARCHAR(255)` | `NULL` | Street address and postcode (e.g. `484 Smith St, Collingwood VIC 3066`). |
| `website_url` | `VARCHAR(255)` | `NULL` | Official website or gig guide page URL. |
| `feed_url` | `VARCHAR(255)` | `NULL` | RSS/Atom or iCal feed URL if provided by the venue. |
| `source_id` | `INT` | `NULL`, `FK` | Linked source ID in `sources` table. |
| `is_active` | `TINYINT(1)` | `DEFAULT 1` | Active venue status. |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Venue registration timestamp. |

**Indexes:**
- `INDEX (name)`: Venue search and alphabetical ordering.
- `INDEX (slug)`: Fast foreign key and slug lookup.

---

### 2.3 `events`
Stores parsed and verified cultural listings (music gigs, art exhibitions, screenings).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT`, `PRIMARY KEY` | Event ID used for permalinks and `.ics` generation. |
| `venue_slug` | `VARCHAR(60)` | `NOT NULL` | Maps event to venue identity or subdomain. |
| `title` | `VARCHAR(255)` | `NOT NULL` | Title of the event or performance. |
| `description` | `TEXT` | `NULL` | Sanitized text summary of the event. |
| `category` | `VARCHAR(60)` | `DEFAULT 'Culture'` | Genre/type (e.g., `Live Music`, `Art`, `Comedy`, `Festival`). Auto-grouped for subcategory filtering. |
| `start_time` | `DATETIME` | `NOT NULL` | Scheduled start date and time. |
| `end_time` | `DATETIME` | `NULL` | Optional end time (defaults to `+2 hours` if null). |
| `venue_name` | `VARCHAR(150)` | `NOT NULL` | Canonical venue or space name. |
| `address` | `VARCHAR(255)` | `NULL` | Physical address for geocoding and map orientation. |
| `ticket_url` | `VARCHAR(255)` | `NULL` | Deep-link directly to venue or ticketing partner checkout. |
| `image_url` | `VARCHAR(500)` | `NULL` | Promotional banner / poster image URL for card rendering. |
| `origin` | `ENUM` | `'scraped', 'manual'` | Source provenance (`manual` prevents scraper overwrites). |
| `is_verified` | `TINYINT(1)` | `DEFAULT 0` | Trust badge indicator (1 = verified venue/organizer). |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time. |

**Deduplication Constraint:**
- `UNIQUE KEY idx_venue_event_time (venue_slug, title(100), start_time)`: Prevents duplicate entries on repeated scraper runs while enabling safe `ON DUPLICATE KEY UPDATE`.

---

### 2.3 `items`
Stores news, commentary, and editorial dispatches from syndicated public media sources and independent cultural blogs.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT`, `PRIMARY KEY` | Unique item identifier. |
| `source_id` | `INT` | `FOREIGN KEY (sources.id)` | Source publisher reference (`ON DELETE CASCADE`). |
| `category_tab` | `ENUM` | `'news', 'politics', 'culture', 'blogs'` | Magazine tab placement. |
| `category` | `VARCHAR(60)` | `DEFAULT 'General'` | Subcategory extracted automatically from feed tags (`<category>`) or topic. |
| `title` | `VARCHAR(255)` | `NOT NULL` | Article headline. |
| `link` | `VARCHAR(255)` | `UNIQUE`, `NOT NULL` | Canonical article link (also acts as natural unique key). |
| `summary` | `TEXT` | `NULL` | Short summary / snippet (capped at 300 characters). |
| `content` | `MEDIUMTEXT` | `NULL` | Full-text article content / HTML extracted from `<content:encoded>` or `<content>`. |
| `image_url` | `VARCHAR(500)` | `NULL` | Hero preview image extracted from feed enclosure or `<media:content>`. |
| `published_at` | `DATETIME` | `NOT NULL` | Original publication date. |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Ingestion timestamp. |

**Indexes:**
- `INDEX (published_at)`: Reverse chronological sorting for news feeds.
- `INDEX (category_tab)`: Fast category tab queries.
- `INDEX (category)`: Dynamic subcategory grouping and filtering.

---

### 2.4 `suggestions`
Stores reader suggestions, feedback, and venue recommendations submitted via the Help modal.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT`, `PRIMARY KEY` | Suggestion identifier. |
| `name` | `VARCHAR(150)` | `NULL` | Sender name (optional). |
| `email` | `VARCHAR(150)` | `NULL` | Sender email (optional). |
| `category` | `VARCHAR(60)` | `NOT NULL DEFAULT 'general'` | Feedback category (`feature`, `venue_feed`, `bug`, `feedback`). |
| `message` | `TEXT` | `NOT NULL` | Suggestion text content. |
| `status` | `ENUM` | `'new', 'read', 'archived'` | Admin management status. |
| `created_at` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` | Submission timestamp. |

**Indexes:**
- `INDEX (status)`: Fast filtering in Admin Suggestion Inbox.
- `INDEX (created_at)`: Reverse chronological sorting.
