#!/usr/bin/env node
/**
 * AgendaWeb Local Development Server (Zero-Dependency)
 * Serves the PWA broadsheet and simulates API/syndication endpoints.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 8000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.ics': 'text/calendar; charset=utf-8'
};

// Seed Mock Data matching Docs/Schema.sql & Docs/API_Spec.md
const MOCK_EVENTS = [
  {
    id: 1,
    venue_slug: "the-gasometer-hotel",
    venue_name: "The Gasometer Hotel",
    title: "The Echoes — Album Launch",
    description: "Melbourne indie rock outfit celebrating their debut LP release with special guests.",
    category: "Live Music",
    start_time: "2026-10-24 20:00:00",
    end_time: "2026-10-24 23:30:00",
    address: "484 Smith St, Collingwood VIC 3066",
    ticket_url: "https://oztix.com.au/event/12345",
    origin: "scraped",
    is_verified: 1,
    calendar_url: "calendar.php?id=1"
  },
  {
    id: 2,
    venue_slug: "fitzroy-community-arts",
    venue_name: "Fitzroy Community Arts",
    title: "Contemporary Printmaking Biennial",
    description: "Showcasing emerging Australian printmakers, risograph posters, and indie zines.",
    category: "Art",
    start_time: "2026-10-25 10:00:00",
    end_time: "2026-10-25 17:00:00",
    address: "128 Gertrude St, Fitzroy VIC 3065",
    ticket_url: "",
    origin: "manual",
    is_verified: 1,
    calendar_url: "calendar.php?id=2"
  },
  {
    id: 3,
    venue_slug: "the-corner-hotel",
    venue_name: "The Corner Hotel",
    title: "Sunset Soundscapes: Ambient & Synth Showcase",
    description: "An evening of analog synthesizers and ambient soundscapes featuring local producers.",
    category: "Live Music",
    start_time: "2026-10-26 19:30:00",
    end_time: "2026-10-26 23:00:00",
    address: "57 Swan St, Richmond VIC 3121",
    ticket_url: "https://thecornerhotel.com",
    origin: "scraped",
    is_verified: 1,
    calendar_url: "calendar.php?id=3"
  },
  {
    id: 4,
    venue_slug: "collingwood-yards",
    venue_name: "Collingwood Yards",
    title: "Community Record Fair & Open Studios",
    description: "Vinyl crate digging, open artist studios, food trucks, and live radio broadcasts.",
    category: "Community",
    start_time: "2026-10-27 11:00:00",
    end_time: "2026-10-27 18:00:00",
    address: "35 Johnston St, Collingwood VIC 3066",
    ticket_url: "",
    origin: "manual",
    is_verified: 1,
    calendar_url: "calendar.php?id=4"
  }
];

const MOCK_ITEMS = {
  news: [
    {
      id: 101,
      source_name: "ABC News",
      category_tab: "news",
      title: "Grassroots Music Venues Receive New State Infrastructure Funding",
      link: "https://www.abc.net.au/news",
      summary: "Victoria’s live music and indie venues receive dedicated grants to preserve historic neighborhood stages.",
      published_at: "2026-10-18 08:30:00"
    },
    {
      id: 102,
      source_name: "SBS News",
      category_tab: "news",
      title: "Multicultural Arts Festivals Expanded Across Regional Hubs",
      link: "https://www.sbs.com.au/news",
      summary: "New community initiatives bring multicultural storytelling and food traditions to regional towns.",
      published_at: "2026-10-18 07:15:00"
    }
  ],
  politics: [
    {
      id: 201,
      source_name: "The Conversation (AU)",
      category_tab: "politics",
      title: "Why Australia's Cultural Infrastructure Needs Decentralized Open Data",
      link: "https://theconversation.com/au",
      summary: "Public arts policy is shifting towards community-anchored hubs, open syndication, and digital sovereignty.",
      published_at: "2026-10-18 07:45:00"
    },
    {
      id: 202,
      source_name: "ABC Politics",
      category_tab: "politics",
      title: "Civic Spaces and Public Gathering Laws Reviewed by Parliament",
      link: "https://www.abc.net.au/news",
      summary: "Lawmakers review zoning protections for cultural performance spaces in residential neighborhoods.",
      published_at: "2026-10-17 18:00:00"
    }
  ],
  culture: [
    {
      id: 301,
      source_name: "The Guardian (AU)",
      category_tab: "culture",
      title: "Australian Indie Music Resilience: Behind Collingwood's Gigs",
      link: "https://www.theguardian.com/au/culture",
      summary: "An in-depth look into independent venues maintaining live stages amidst urban development and noise complaints.",
      published_at: "2026-10-17 14:00:00"
    },
    {
      id: 302,
      source_name: "ABC Arts & Culture",
      category_tab: "culture",
      title: "The Renaissance of Independent Print: Zines and Broadsheets in 2026",
      link: "https://www.abc.net.au/news",
      summary: "Young writers and illustrators are turning away from algorithmic feeds toward tactile broadsheets.",
      published_at: "2026-10-17 11:30:00"
    }
  ]
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. API: Events Feed
  if (pathname === '/api/events.php') {
    const category = parsedUrl.query.category || 'all';
    const venue = parsedUrl.query.venue || 'all';

    let filtered = MOCK_EVENTS;
    if (category && category !== 'all' && category !== 'All') {
      filtered = filtered.filter(e => e.category.toLowerCase() === category.toLowerCase());
    }
    if (venue && venue !== 'all') {
      filtered = filtered.filter(e => e.venue_slug === venue);
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'success',
      count: filtered.length,
      total: MOCK_EVENTS.length,
      data: filtered
    }));
    return;
  }

  // 2. API: Items Feed (News, Politics, Culture)
  if (pathname === '/api/items.php') {
    const tab = parsedUrl.query.tab || 'news';
    const items = MOCK_ITEMS[tab] || [];

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'success',
      tab: tab,
      count: items.length,
      data: items
    }));
    return;
  }

  // 3. API: OpenGraph Extractor
  if (pathname === '/api/extract.php' || pathname === '/extract.php') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Valid URL required' }));
      return;
    }

    let domain = 'example.com';
    try {
      domain = new URL(targetUrl).hostname;
    } catch (e) {}

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      url: targetUrl,
      title: "Extracted Article: Cultural Dispatches",
      description: "An overview of Australian live music, arts funding, and independent journalism.",
      image: "assets/logo.svg",
      domain: domain,
      saved_at: new Date().toISOString()
    }));
    return;
  }

  // 4. Syndication: RFC 5545 iCalendar
  if (pathname === '/calendar.php') {
    const id = parseInt(parsedUrl.query.id, 10);
    const event = MOCK_EVENTS.find(e => e.id === id) || MOCK_EVENTS[0];

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AgendaWeb//agendaweb.app//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:agendaweb-${event.id}@agendaweb.app`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:20261024T090000Z`,
      `DTEND:20261024T123000Z`,
      `SUMMARY:${event.title}`,
      `LOCATION:${event.venue_name}, ${event.address}`,
      `DESCRIPTION:${event.description}`,
      event.ticket_url ? `URL:${event.ticket_url}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    res.writeHead(200, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="agendaweb-event-${event.id}.ics"`
    });
    res.end(icsContent);
    return;
  }

  // 5. Syndication: RSS 2.0 with ev: Event Module
  if (pathname === '/feed.php') {
    const rssItems = MOCK_EVENTS.map(e => `
    <item>
      <title>${e.title}</title>
      <link>${e.ticket_url || 'https://agendaweb.app'}</link>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <category>${e.category}</category>
      <description><![CDATA[${e.description}]]></description>
      <ev:startdate>${e.start_time.replace(' ', 'T')}+11:00</ev:startdate>
      <ev:location>${e.venue_name} · ${e.address}</ev:location>
      <enclosure url="https://agendaweb.app/calendar.php?id=${e.id}" type="text/calendar" />
    </item>`).join('');

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:ev="http://purl.org/rss/1.0/modules/event/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AgendaWeb — Melbourne Cultural Feed</title>
    <link>https://agendaweb.app</link>
    <description>YOUR CULTURAL WEB FEED</description>
    <language>en-AU</language>
    ${rssItems}
  </channel>
</rss>`;

    res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
    res.end(rssXml);
    return;
  }

  // 6. Static File Serving
  let filePath = path.join(BASE_DIR, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`\n✦ AgendaWeb Server is LIVE at: http://localhost:${port}`);
    console.log(`  - Broadsheet PWA:  http://localhost:${port}/index.html`);
    console.log(`  - Events JSON API: http://localhost:${port}/api/events.php`);
    console.log(`  - News JSON API:   http://localhost:${port}/api/items.php?tab=news`);
    console.log(`  - RSS 2.0 Feed:    http://localhost:${port}/feed.php`);
    console.log(`  - iCal Export:     http://localhost:${port}/calendar.php?id=1\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(DEFAULT_PORT);
