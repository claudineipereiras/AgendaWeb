# AgendaWeb Frontend & IndexedDB Specification

This document details the local-first client architecture for the AgendaWeb Progressive Web App (PWA).

---

## 1. Local-First Philosophy

In alignment with Directive #1 (*Zero Consumer Authentication*):
- No user accounts or personal profiles exist on the AgendaWeb server.
- The client browser acts as the primary sovereign database for all user actions:
  - Saved articles & links ("Read Later")
  - Starred gigs & calendar reminders
  - Custom user-added RSS feed subscriptions
  - Reader preferences ("Clean Mode" toggle, custom tab ordering)

---

## 2. IndexedDB Database Design

- **Database Name:** `AgendaWebDB`
- **Current Version:** `1`

```mermaid
classDiagram
    class AgendaWebDB {
        +read_later
        +starred_events
        +custom_feeds
        +user_settings
    }
    class ReadLaterItem {
        +string url (PK)
        +string title
        +string description
        +string image
        +string domain
        +string saved_at
    }
    class StarredEventItem {
        +int id (PK)
        +string title
        +string venue_name
        +string start_time
        +string ticket_url
        +string saved_at
    }
    class CustomFeedItem {
        +string feed_url (PK)
        +string title
        +string category
        +string added_at
    }
    class UserSettingItem {
        +string key (PK)
        +any value
    }
    AgendaWebDB --> ReadLaterItem
    AgendaWebDB --> StarredEventItem
    AgendaWebDB --> CustomFeedItem
    AgendaWebDB --> UserSettingItem
```

---

## 3. Object Store Schemas

### 3.1 `read_later`
Stores web links extracted via `/api/extract.php` or saved directly from the News/Culture tabs.

| Key | Type | Description |
| :--- | :--- | :--- |
| `url` *(KeyPath)* | `string` | Canonical link URL (unique identifier). |
| `title` | `string` | Article title. |
| `description` | `string` | Short snippet / excerpt. |
| `image` | `string` | OpenGraph hero image preview URL. |
| `domain` | `string` | Source site domain (e.g., `theconversation.com`). |
| `saved_at` | `string` | ISO 8601 timestamp (`2026-10-18T10:00:00Z`). |

**Indexes:**
- `idx_saved_at (saved_at)`: Reverse chronological sorting for the "Reads" tab.

---

### 3.2 `starred_events`
Stores user-bookmarked gigs and cultural events for offline reference and calendar tracking.

| Key | Type | Description |
| :--- | :--- | :--- |
| `id` *(KeyPath)* | `number` | Server event ID. |
| `title` | `string` | Gig or event title. |
| `venue_name` | `string` | Venue name. |
| `start_time` | `string` | Event start timestamp. |
| `ticket_url` | `string` | Direct ticketing URL. |
| `saved_at` | `string` | ISO 8601 timestamp. |

**Indexes:**
- `idx_start_time (start_time)`: Chronological sorting (upcoming first).

---

### 3.3 `custom_feeds`
Enables users to syndicate private or community RSS feeds into their broadsheet reader.

| Key | Type | Description |
| :--- | :--- | :--- |
| `feed_url` *(KeyPath)* | `string` | Public RSS/Atom URL. |
| `title` | `string` | Custom user or feed title. |
| `category` | `string` | Target category tab. |
| `added_at` | `string` | ISO 8601 timestamp. |

---

### 3.4 `user_settings`
Key-value store preserving user interface preferences across browser sessions.

| Key *(KeyPath)* | Default Value | Description |
| :--- | :--- | :--- |
| `clean_mode` | `false` | When `true`, disables news/politics tabs; runs as dedicated event gig guide. |
| `active_tab` | `'events'` | Last selected top-level tab. |
| `event_filter` | `'All'` | Last selected event category pill. |

---

## 4. OPML & JSON Data Portability

Users own their data. Under the Settings drawer:
1. **Export OPML:** Exports all subscribed feeds (`sources` + `custom_feeds`) into standard OPML format for NetNewsWire, Feedly, or Readwise.
2. **Export JSON:** Dumps all `starred_events` and `read_later` items into a single portable backup file.
3. **Clear Local Data:** One-click wipe of `AgendaWebDB` with zero leftover footprints.
