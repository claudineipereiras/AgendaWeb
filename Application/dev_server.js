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

// Seed Mock Data with image support matching Docs/Schema.sql & Docs/API_Spec.md
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
    image_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=700&q=80",
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
    image_url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=700&q=80",
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
    image_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=700&q=80",
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
    image_url: "https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?auto=format&fit=crop&w=700&q=80",
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
      category: "Regional Arts",
      title: "Grassroots Music Venues Receive New State Infrastructure Funding",
      link: "https://www.abc.net.au/news",
      summary: "Victoria’s live music and indie venues receive dedicated grants to preserve historic neighborhood stages.",
      image_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=700&q=80",
      published_at: "2026-10-18 08:30:00"
    },
    {
      id: 102,
      source_name: "SBS News",
      category_tab: "news",
      category: "Community",
      title: "Multicultural Arts Festivals Expanded Across Regional Hubs",
      link: "https://www.sbs.com.au/news",
      summary: "New community initiatives bring multicultural storytelling and food traditions to regional towns.",
      image_url: "",
      published_at: "2026-10-18 07:15:00"
    }
  ],
  blogs: [
    {
      id: 201,
      source_name: "Trouble Magazine",
      category_tab: "blogs",
      category: "Indie Culture",
      title: "Australian Indie Music Resilience: Behind Collingwood's Gigs",
      summary: "An in-depth look into independent venues maintaining live stages amidst urban development and noise complaints.",
      link: "https://www.troublemag.com",
      image_url: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=700&q=80",
      published_at: "2026-10-17 14:00:00"
    },
    {
      id: 202,
      source_name: "The Conversation (AU)",
      category_tab: "blogs",
      category: "Essays",
      title: "Why Australia's Cultural Infrastructure Needs Decentralized Open Data",
      link: "https://theconversation.com/au",
      summary: "Public arts policy is shifting towards community-anchored hubs, open syndication, and digital sovereignty.",
      image_url: "",
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

    const categories = ['All', ...new Set(MOCK_EVENTS.map(e => e.category))];

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'success',
      count: filtered.length,
      total: MOCK_EVENTS.length,
      categories: categories,
      data: filtered
    }));
    return;
  }

  // 2. API: Items Feed (News, Blogs)
  if (pathname === '/api/items.php') {
    const tab = parsedUrl.query.tab || 'news';
    const category = parsedUrl.query.category || 'all';
    const rawItems = MOCK_ITEMS[tab] || [];

    let filtered = rawItems;
    if (category && category !== 'all' && category !== 'All') {
      filtered = filtered.filter(i => (i.category || '').toLowerCase() === category.toLowerCase());
    }

    const categories = ['All', ...new Set(rawItems.map(i => i.category).filter(Boolean))];

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'success',
      tab: tab,
      count: filtered.length,
      categories: categories,
      data: filtered
    }));
    return;
  }

  // 3. API: Personal Feed CORS Proxy
  if (pathname === '/api/proxy_feed.php') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Valid URL required' }));
      return;
    }

    // Mock parsed personal feed items
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'success',
      feed_url: targetUrl,
      title: "Sample Personal RSS Feed",
      categories: ["All", "Visual Arts", "Interviews"],
      items: [
        {
          title: "Melbourne Underground Zine Scene 2026",
          link: "https://example.com/zine-scene",
          summary: "Local risograph studios are banding together to form neighborhood micro-press collectives.",
          category: "Visual Arts",
          image_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=700&q=80",
          published_at: new Date().toISOString()
        }
      ]
    }));
    return;
  }

  // 4. API: OpenGraph Extractor
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

  // 5. Syndication: RFC 5545 iCalendar
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

  // 6. Syndication: RSS 2.0 with ev: Event Module
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

  // 7. Static File Serving
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
    console.log(`  - Blogs JSON API:  http://localhost:${port}/api/items.php?tab=blogs`);
    console.log(`  - Proxy Feed API:  http://localhost:${port}/api/proxy_feed.php?url=...`);
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
