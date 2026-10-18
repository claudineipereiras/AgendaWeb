# AgendaWeb API & Protocol Specification

This document details the interface contracts for all backend endpoints in AgendaWeb.

---

## 1. Overview & Conventions

- **Base URL:** `https://agendaweb.app` (or `http://localhost:8000` during local development)
- **Data Formats:**
  - REST/Client API: `application/json; charset=utf-8`
  - Syndication Feeds: `application/rss+xml; charset=utf-8`
  - Calendar Subscriptions: `text/calendar; charset=utf-8`
- **Authentication:** Zero consumer authentication. All client read endpoints are public, stateless, and unauthenticated.
- **CORS:** Enabled (`Access-Control-Allow-Origin: *`) for open web client consumption.

---

## 2. Public Client JSON API Endpoints

### 2.1 Get Events Feed
Retrieves upcoming cultural events, gigs, and exhibitions sorted chronologically by start date.

- **Endpoint:** `GET /api/events.php`
- **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `venue` | `string` | No | `all` | Filter by venue slug (e.g., `the-gasometer-hotel`), or `all`. |
  | `category` | `string` | No | `all` | Filter by category (e.g., `Live Music`, `Art`, `Community`, `all`). |
  | `limit` | `int` | No | `50` | Maximum items to return (1–100). |
  | `offset` | `int` | No | `0` | Pagination offset. |

- **Success Response (200 OK):**
```json
{
  "status": "success",
  "count": 1,
  "total": 42,
  "categories": ["All", "Live Music", "Art", "Community", "Free"],
  "data": [
    {
      "id": 1,
      "venue_slug": "the-gasometer-hotel",
      "venue_name": "The Gasometer Hotel",
      "title": "The Echoes — Album Launch",
      "description": "Melbourne indie rock outfit celebrating their debut LP release.",
      "category": "Live Music",
      "start_time": "2026-10-24 20:00:00",
      "end_time": "2026-10-24 23:30:00",
      "address": "484 Smith St, Collingwood VIC 3066",
      "ticket_url": "https://oztix.com.au/event/12345",
      "image_url": "https://example.com/posters/echoes.jpg",
      "origin": "scraped",
      "is_verified": 1,
      "calendar_url": "https://agendaweb.app/calendar.php?id=1"
    }
  ]
}
```

---

### 2.2 Get News, Cultural Dispatches & Blogs
Retrieves articles, news headlines, and independent blog posts ingested from Australian public sources.

- **Endpoint:** `GET /api/items.php`
- **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `tab` | `string` | No | `news` | Content category: `news`, `politics`, `culture`, `blogs`. |
  | `category` | `string` | No | `all` | Filter by auto-extracted subcategory or `all`. |
  | `limit` | `int` | No | `30` | Maximum items to return (1–50). |
  | `offset` | `int` | No | `0` | Pagination offset. |

- **Success Response (200 OK):**
```json
{
  "status": "success",
  "tab": "news",
  "count": 1,
  "categories": ["All", "Top Stories", "Regional Arts", "Music Reviews"],
  "data": [
    {
      "id": 105,
      "source_name": "ABC News",
      "category_tab": "news",
      "category": "Regional Arts",
      "title": "Community Arts Funding Expanded Across Regional Victoria",
      "link": "https://www.abc.net.au/news/2026-10-18/arts-funding-regional-vic/1000",
      "summary": "State government announces new grants targeting grassroots music venues and indie galleries...",
      "content": "<p>Full text article or essay from RSS content:encoded module for distraction-free reading...</p>",
      "image_url": "https://images.abc.net.au/news/arts-grant.jpg",
      "published_at": "2026-10-18 08:15:00"
    }
  ]
}
```

---

### 2.3 Personal Feed CORS Proxy
Safely proxies external user-added RSS/Atom feeds to bypass browser CORS restrictions for local IndexedDB personal feeds.

- **Endpoint:** `GET /api/proxy_feed.php`
- **Query Parameters:**
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `url` | `string` | Yes | Target RSS/Atom feed URL. |

- **Success Response (200 OK):**
```json
{
  "status": "success",
  "feed_url": "https://example.com/feed.xml",
  "title": "Melbourne Arts Review",
  "description": "Independent critique and exhibition reviews",
  "categories": ["All", "Essays", "Interviews", "Visual Arts"],
  "items": [
    {
      "title": "Spring Printmaking in Collingwood",
      "link": "https://example.com/spring-printmaking",
      "summary": "Spotlight on community presses...",
      "category": "Visual Arts",
      "image_url": "https://example.com/hero.jpg",
      "published_at": "2026-10-18T05:00:00Z"
    }
  ]
}
```

---

### 2.4 OpenGraph "Read Later" Extractor
Scrapes public URL metadata so the client can save bookmark preview cards into local IndexedDB.

- **Endpoint:** `GET /api/extract.php`
- **Query Parameters:**
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `url` | `string` | Yes | Target URL to extract OpenGraph/Twitter Card metadata from. |

- **Success Response (200 OK):**
```json
{
  "url": "https://theconversation.com/au/politics/article-1234",
  "title": "Understanding Australia's New Cultural Infrastructure Policy",
  "description": "An analysis of public funding shifts for live music and independent arts.",
  "image": "https://images.theconversation.com/files/1234/hero.jpg",
  "domain": "theconversation.com",
  "saved_at": "2026-10-18T10:00:00Z"
}
```

- **Error Responses:**
  - `400 Bad Request`: `{"error": "Valid URL required"}`
  - `422 Unprocessable Entity`: `{"error": "Unable to read target page"}`

---

### 2.5 Reader Suggestion Box (`/api/suggestions.php`)
Allows readers to submit recommendations, venue tips, and feed nominations via the in-app Help & Suggestion modal. Suggestions are stored directly in the Hostinger MySQL `suggestions` table.

- **Endpoint:** `POST /api/suggestions.php`
- **Request Body (`application/json`):**
  ```json
  {
    "name": "Jane Reader",
    "email": "jane@example.com",
    "category": "feed_nomination",
    "message": "Please consider adding The Northcote Theatre live music gig guide RSS feed!"
  }
  ```
- **Categories:** `feed_nomination`, `venue_tip`, `feature_idea`, `bug_report`, `other`
- **Success Response (201 Created):**
  ```json
  {
    "status": "success",
    "message": "Suggestion submitted successfully. Thank you!",
    "id": 14
  }
  ```

---

### 2.6 Curator Admin Management API (`/api/admin.php`)
Dedicated administration endpoint enabling the curator to manage curated sources, monitor ingestion stats, triage suggestions, and trigger sync. Protected by passkey (`X-Admin-Key` header or `?key=` query param).

- **Endpoint:** `GET|POST /api/admin.php`
- **Authentication:** `X-Admin-Key: <admin_key>`
- **Actions:**
  - `GET /api/admin.php?action=stats`: Returns platform metrics (active sources, total events, dispatches, pending suggestions).
  - `GET /api/admin.php?action=sources&channel=all`: Lists curated sources with filters (`events`, `news`, `blogs`).
  - `POST /api/admin.php?action=add_source`: Adds a new curated source feed (`name`, `channel_tab`, `feed_url`, `site_url`, `subcategories`).
  - `POST /api/admin.php?action=toggle_source`: Pauses or activates a curated feed (`id`, `is_active`).
  - `POST /api/admin.php?action=delete_source`: Removes a feed source.
  - `GET /api/admin.php?action=suggestions&status=new`: Retrieves reader suggestions filtered by status (`new`, `read`, `archived`).
  - `POST /api/admin.php?action=update_suggestion`: Changes suggestion status (`id`, `status`).
  - `POST /api/admin.php?action=delete_suggestion`: Deletes a suggestion item.
  - `POST /api/admin.php?action=sync_now`: Manually initiates `sync_sources.php` ingestion pass.

---

## 3. Syndication & Open Standards Protocols

### 3.1 Dual-Mode RSS 2.0 (`feed.php`)
Dual-purpose RSS 2.0 feed carrying standard RSS items extended with the Event Module (`ev:`).

- **Endpoint:** `GET /feed.php`
- **Query Parameters:**
  - `venue`: Venue slug (`the-gasometer-hotel`) or `all`.
  - `category`: Category filter (`Live Music`, `Art`, etc.) or `all`.
- **Response Headers:**
  - `Content-Type: application/rss+xml; charset=utf-8`
  - `Cache-Control: public, max-age=300`
- **Namespace Definitions:**
  ```xml
  <rss version="2.0"
       xmlns:ev="http://purl.org/rss/1.0/modules/event/"
       xmlns:atom="http://www.w3.org/2005/Atom">
  ```
- **Item Spec:**
  ```xml
  <item>
    <title>The Echoes — Album Launch</title>
    <link>https://oztix.com.au/event/12345</link>
    <pubDate>Sun, 18 Oct 2026 09:00:00 +1100</pubDate>
    <category>Live Music</category>
    <description><![CDATA[Melbourne indie rock outfit...]]></description>
    <ev:startdate>2026-10-24T20:00:00+11:00</ev:startdate>
    <ev:enddate>2026-10-24T23:30:00+11:00</ev:enddate>
    <ev:location>The Gasometer Hotel · 484 Smith St, Collingwood VIC</ev:location>
    <enclosure url="https://agendaweb.app/calendar.php?id=1" type="text/calendar" />
  </item>
  ```

---

### 3.2 Dynamic RFC 5545 iCalendar (`calendar.php`)
Generates valid iCalendar files for single-click event additions or persistent live calendar subscriptions (`webcal://`).

- **Endpoint:** `GET /calendar.php`
- **Modes:**
  1. **Single Event:** `GET /calendar.php?id={id}`
     - Sends: `Content-Disposition: attachment; filename="agendaweb-event-{id}.ics"`
     - Single `VEVENT` block.
  2. **Venue Subscription:** `GET /calendar.php?venue={slug|all}` (or via `webcal://`)
     - Sends: `Content-Disposition: attachment; filename="agendaweb-{venue}.ics"`
     - All upcoming events for the venue (up to 100 items).
- **Format:**
  ```text
  BEGIN:VCALENDAR
  VERSION:2.0
  PRODID:-//AgendaWeb//agendaweb.app//EN
  CALSCALE:GREGORIAN
  BEGIN:VEVENT
  UID:agendaweb-1@agendaweb.app
  DTSTAMP:20261018T100000Z
  DTSTART:20261024T090000Z
  DTEND:20261024T123000Z
  SUMMARY:The Echoes — Album Launch
  LOCATION:The Gasometer Hotel, 484 Smith St, Collingwood
  DESCRIPTION:Tickets: https://oztix.com.au/event/12345
  URL:https://oztix.com.au/event/12345
  END:VEVENT
  END:VCALENDAR
  ```

---

## 4. Embeddable Venue Widget (`widget.js`)

A zero-dependency client widget allowing independent venues to display their upcoming events directly on their own website without double-handling data.

- **Script Source:** `https://agendaweb.app/widget.js`
- **Target Container:** `<div class="agendaweb-widget" ...></div>` or `<div id="agendaweb-widget" ...></div>`
- **Configuration Attributes:**
  | Attribute | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `data-venue` | `string` | `'all'` | Target venue slug (e.g., `the-gasometer-hotel`). |
  | `data-limit` | `number` | `5` | Maximum number of upcoming events to render. |
  | `data-title` | `string` | `'Upcoming Gigs & Live Events'` | Header title displayed on top of the widget. |
  | `data-api` | `string` | Script origin | API base URL hosting `/api/events.php`. |

- **Integration Snippet:**
  ```html
  <div class="agendaweb-widget" 
       data-venue="the-gasometer-hotel" 
       data-limit="5">
  </div>
  <script src="https://agendaweb.app/widget.js" async></script>
  ```

---

## 5. Organizer Event RSS Syndication Guide (Future Feature)

Organizers and independent venues who manage their own blogs or CMS (WordPress, Ghost, Craft) can broadcast events to AgendaWeb by publishing a standard RSS 2.0 feed enhanced with the Event (`ev:`) module.

### Feed Specification
- **Content-Type:** `application/rss+xml; charset=utf-8`
- **Required Namespaces:** `xmlns:ev="http://purl.org/rss/1.0/modules/event/"`

### Sample Event RSS Template
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:ev="http://purl.org/rss/1.0/modules/event/">
  <channel>
    <title>The Gasometer Hotel — Live Gigs</title>
    <link>https://www.thegasometerhotel.com.au</link>
    <description>Live music, album launches, and band schedules</description>
    <language>en-AU</language>

    <item>
      <title>The Echoes — Album Launch</title>
      <link>https://oztix.com.au/event/12345</link>
      <pubDate>Sun, 18 Oct 2026 09:00:00 +1100</pubDate>
      <category>Live Music</category>
      <description><![CDATA[Melbourne indie rock outfit celebrating debut LP.]]></description>
      
      <!-- Event Module Metadata -->
      <ev:startdate>2026-10-24T20:00:00+11:00</ev:startdate>
      <ev:enddate>2026-10-24T23:30:00+11:00</ev:enddate>
      <ev:location>The Gasometer Hotel, 484 Smith St, Collingwood VIC</ev:location>
      
      <!-- Promotional Poster / Card Image -->
      <enclosure url="https://example.com/posters/echoes.jpg" type="image/jpeg" length="102400" />
    </item>
  </channel>
</rss>
```

