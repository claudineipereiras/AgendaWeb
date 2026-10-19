#!/usr/bin/env node
/**
 * AgendaWeb Local Development Server (Zero-Dependency)
 * Serves the PWA broadsheet and simulates API/syndication endpoints.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORTS_TO_SERVE = process.env.PORT 
  ? [parseInt(process.env.PORT, 10)] 
  : [8001, 8000]; // Port 8001 is primary; Port 8000 is synchronized mirror
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

let MOCK_SOURCES = [
  { id: 1, slug: "abc-just-in", name: "ABC News", type: "rss", url: "https://www.abc.net.au/news/feed/51120/rss.xml", category_tab: "news", is_active: 1, last_status: "updated", http_code: 200, item_count: 24, last_error: null, last_polled_at: "2026-10-19 09:15:00" },
  { id: 2, slug: "sbs-top-stories", name: "SBS News", type: "rss", url: "https://www.sbs.com.au/news/feed", category_tab: "news", is_active: 1, last_status: "updated", http_code: 200, item_count: 18, last_error: null, last_polled_at: "2026-10-19 09:12:00" },
  { id: 3, slug: "trouble-mag", name: "Trouble Magazine", type: "rss", url: "https://www.troublemag.com/feed/", category_tab: "blogs", is_active: 1, last_status: "active", http_code: 200, item_count: 8, last_error: null, last_polled_at: "2026-10-18 14:00:00" },
  { id: 4, slug: "the-conversation-au", name: "The Conversation (AU)", type: "rss", url: "https://theconversation.com/au/politics/articles.atom", category_tab: "blogs", is_active: 1, last_status: "active", http_code: 200, item_count: 12, last_error: null, last_polled_at: "2026-10-18 11:30:00" },
  { id: 5, slug: "the-gasometer-hotel", name: "The Gasometer Hotel", type: "scrape_event", url: "https://www.thegasometerhotel.com.au/gigs", category_tab: "events", is_active: 1, last_status: "updated", http_code: 200, item_count: 5, last_error: null, last_polled_at: "2026-10-19 08:45:00" },
  { id: 6, slug: "the-corner-hotel", name: "The Corner Hotel", type: "scrape_event", url: "https://thecornerhotel.com/gigs", category_tab: "events", is_active: 1, last_status: "updated", http_code: 200, item_count: 7, last_error: null, last_polled_at: "2026-10-19 08:30:00" }
];

let MOCK_VENUES = [
  {
    id: 1,
    slug: "the-gasometer-hotel",
    name: "The Gasometer Hotel",
    address: "484 Smith St, Collingwood VIC 3066",
    website_url: "https://www.thegasometerhotel.com.au",
    feed_url: "https://www.thegasometerhotel.com.au/gigs",
    source_id: 5,
    is_active: 1
  },
  {
    id: 2,
    slug: "the-corner-hotel",
    name: "The Corner Hotel",
    address: "57 Swan St, Richmond VIC 3121",
    website_url: "https://thecornerhotel.com",
    feed_url: "https://thecornerhotel.com/gigs",
    source_id: 6,
    is_active: 1
  },
  {
    id: 3,
    slug: "fitzroy-community-arts",
    name: "Fitzroy Community Arts",
    address: "128 Gertrude St, Fitzroy VIC 3065",
    website_url: "https://fitzroyarts.org.au",
    feed_url: null,
    source_id: null,
    is_active: 1
  }
];

let MOCK_SUGGESTIONS = [
  { id: 1, name: "Liam K.", email: "liam@musicvic.com.au", category: "venue_feed", message: "Would love to see The Tote and Northcote Social Club gig feeds added to the live events calendar!", status: "new", created_at: "2026-10-18 14:22:10" },
  { id: 2, name: "Chloe S.", email: "chloe@example.com", category: "feature", message: "The offline reading queue in IndexedDB is brilliant. Could we have an option to export selected reading lists?", status: "read", created_at: "2026-10-17 19:40:05" }
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
      content: "<p>Victoria’s live music and indie venues are set to receive dedicated grants under a renewed state cultural infrastructure initiative designed to preserve historic neighborhood stages amidst rising inner-city commercial rents.</p><p>The package will support acoustic buffering, risograph event broadsheets, accessible stage ramps, and independent artist residencies across Collingwood, Fitzroy, and Ballarat.</p><p>Cultural advocates praised the grant framework for recognizing small grassroots gig rooms as essential public social infrastructure rather than mere commercial tenancies.</p>",
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
      content: "<p>A series of regional cultural celebrations will expand across regional hubs over the coming summer, bringing together traditional and contemporary artists, indigenous song cycles, and neighborhood food collectives.</p><p>Organizers emphasized the open-web syndication model, allowing regional residents to subscribe directly to festival schedules via RSS and iCal feeds without proprietary app downloads.</p>",
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
      content: "<p>Collingwood’s live circuit remains the lifeblood of Melbourne's independent music ecosystem. Walking down Johnston and Smith Streets on a Friday night, sound leaks from brick hotel basements, courtyard beer gardens, and second-floor print cooperatives.</p><p>In this long-form inquiry, venue owners reflect on sound attenuation engineering, community-backed leases, and why decentralized event syndication (like AgendaWeb) is breaking the algorithmic monopoly of social platforms.</p><p><em>'If people have to scroll an algorithm to find out who is playing down their street tonight, live culture loses,'</em> says one Fitzroy booker. <em>'Open feeds put the power back in the neighborhood.'</em></p>",
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
      content: "<p>For two decades, public cultural institutions and neighborhood arts collectives relied on proprietary American tech platforms to announce gatherings, exhibition openings, and civic debates. The cost has been high: surveillance tracking, algorithmic pay-to-reach barriers, and audience disenfranchisement.</p><p>By turning back to open web standards—RFC 5545 iCalendar, RSS 2.0 with the Event module, and local-first browser storage—cultural organizations regain their digital sovereignty.</p>",
      image_url: "",
      published_at: "2026-10-17 11:30:00"
    }
  ]
};

const requestHandler = (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');

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
      venues: MOCK_VENUES,
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

  // 7. API: Suggestions Submission
  if (pathname === '/api/suggestions.php') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const newSug = {
          id: MOCK_SUGGESTIONS.length + 1,
          name: payload.name || 'Anonymous',
          email: payload.email || '',
          category: payload.category || 'general',
          message: payload.message || '',
          status: 'new',
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
        };
        MOCK_SUGGESTIONS.unshift(newSug);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          message: 'Thank you! Your suggestion has been saved to the curator inbox.'
        }));
      });
      return;
    }
  }

  // 7.1 API: Public Venue Onboarding
  if (pathname === '/api/onboard_venue.php') {
    const action = parsedUrl.query.action || 'preview';
    if (action === 'preview') {
      const targetUrl = parsedUrl.query.url;
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: 'Valid website URL required' }));
        return;
      }
      let host = 'example.com';
      try { host = new URL(targetUrl).hostname; } catch(e) {}
      const venueName = host.replace(/^www\./, '').split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const venueSlug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        url: targetUrl,
        page_title: `${venueName} | Gigs & Live Events`,
        suggested_name: venueName,
        feed_url: null,
        events_count: 2,
        venue: {
          slug: venueSlug,
          name: venueName,
          address: "Melbourne VIC"
        },
        events: [
          {
            title: "Live Showcase & Emerging Artists",
            start_time: "2026-10-25 20:00:00",
            category: "Live Music",
            venue_name: venueName,
            address: "Melbourne VIC",
            ticket_url: targetUrl
          },
          {
            title: "Weekend Sound System Residency",
            start_time: "2026-10-27 21:00:00",
            category: "Live Music",
            venue_name: venueName,
            address: "Melbourne VIC",
            ticket_url: targetUrl
          }
        ]
      }));
      return;
    }

    if (action === 'submit' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}

        if (payload.website_hp) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'success', message: 'Submission received' }));
          return;
        }

        const venueName = payload.name || payload.venue_name || 'New Venue';
        const venueUrl = payload.url || payload.feed_url || '';
        const sourceSlug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const newSource = {
          id: MOCK_SOURCES.length + 1,
          slug: sourceSlug,
          name: venueName,
          type: 'scrape_event',
          url: venueUrl,
          category_tab: 'events',
          is_active: 0, // Awaiting curator approval
          last_status: 'pending',
          http_code: 200,
          item_count: 2,
          contact_email: payload.contact_email || null,
          submission_notes: `Self-service onboarding request. Polling: ${payload.polling_frequency || payload.polling_freq || '24h'}`,
          last_error: null,
          last_polled_at: null
        };
        MOCK_SOURCES.push(newSource);

        MOCK_VENUES.push({
          id: MOCK_VENUES.length + 1,
          slug: sourceSlug,
          name: venueName,
          address: payload.address || 'Melbourne VIC',
          website_url: venueUrl,
          feed_url: payload.feed_url || null,
          source_id: newSource.id,
          is_active: 0
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          message: `Venue '${venueName}' submitted successfully for review and broadcasting.`,
          id: newSource.id
        }));
      });
      return;
    }
  }

  // 8. API: Admin Operations
  if (pathname === '/api/admin.php') {
    const action = parsedUrl.query.action || 'stats';
    const providedKey = req.headers['x-admin-key'] || parsedUrl.query.key;
    const EXPECTED_KEY = 'agendaweb-admin-secret-2026';

    if (!providedKey || providedKey !== EXPECTED_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'error', message: 'Unauthorized: Invalid Admin Key' }));
      return;
    }

    if (action === 'stats') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        data: {
          total_sources: MOCK_SOURCES.length,
          active_sources: MOCK_SOURCES.filter(s => s.is_active).length,
          total_events: MOCK_EVENTS.length,
          total_items: (MOCK_ITEMS.news.length + MOCK_ITEMS.blogs.length),
          new_suggestions: MOCK_SUGGESTIONS.filter(s => s.status === 'new').length
        }
      }));
      return;
    }

    if (action === 'sources') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        count: MOCK_SOURCES.length,
        data: MOCK_SOURCES
      }));
      return;
    }

    if (action === 'scrape_preview') {
      const targetUrl = parsedUrl.query.url || '';
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: 'Valid website URL required' }));
        return;
      }

      let host = 'example.com';
      try { host = new URL(targetUrl).hostname; } catch(e) {}
      const isEventVenue = targetUrl.includes('gasometer') || targetUrl.includes('corner') || targetUrl.includes('tote') || targetUrl.includes('forum') || targetUrl.includes('gig') || targetUrl.includes('event');
      const venueName = host.replace(/^www\./, '').split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const venueSlug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const detectedEvents = [
        {
          title: "The Sunset Sessions — Live Quintet",
          start_time: "2026-10-25 20:00:00",
          end_time: "2026-10-25 23:00:00",
          category: "Live Music",
          venue_name: venueName,
          address: "Melbourne VIC",
          ticket_url: targetUrl,
          image_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=700&q=80"
        },
        {
          title: "Indie Album Launch & Special Guests",
          start_time: "2026-10-28 19:30:00",
          end_time: "2026-10-28 22:30:00",
          category: "Live Music",
          venue_name: venueName,
          address: "Melbourne VIC",
          ticket_url: targetUrl,
          image_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=700&q=80"
        }
      ];

      const detectedVenue = {
        slug: venueSlug,
        name: venueName,
        address: isEventVenue ? "484 Smith St, Collingwood VIC 3066" : "",
        website_url: targetUrl,
        feed_url: isEventVenue ? null : `${targetUrl.replace(/\/$/, '')}/feed.xml`
      };

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        url: targetUrl,
        http_code: 200,
        page_title: `${venueName} | Gigs & Live Events Calendar`,
        detected_type: isEventVenue ? 'scrape_event' : 'rss',
        suggested_name: venueName,
        suggested_tab: isEventVenue ? 'events' : 'blogs',
        feed_url: isEventVenue ? null : `${targetUrl.replace(/\/$/, '')}/feed.xml`,
        events_count: detectedEvents.length,
        venue: detectedVenue,
        events: detectedEvents
      }));
      return;
    }

    if (action === 'add_source' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const sourceSlug = (payload.name || 'source').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const newSource = {
          id: MOCK_SOURCES.length + 1,
          slug: sourceSlug,
          name: payload.name || 'New Source',
          type: payload.type || 'rss',
          url: payload.url || 'https://example.com/feed.xml',
          category_tab: payload.category_tab || 'blogs',
          is_active: 1,
          last_status: 'updated',
          http_code: 200,
          item_count: payload.type === 'scrape_event' ? 2 : 5,
          last_error: null,
          last_polled_at: now
        };
        MOCK_SOURCES.push(newSource);

        // Update / Insert into MOCK_VENUES if it is an event source
        if (payload.category_tab === 'events' || payload.type === 'scrape_event' || payload.venue_name) {
          const vSlug = sourceSlug;
          const vName = payload.venue_name || payload.name;
          const existing = MOCK_VENUES.find(v => v.slug === vSlug || v.name.toLowerCase() === vName.toLowerCase());
          if (existing) {
            existing.name = vName;
            existing.address = payload.address || existing.address;
            existing.website_url = payload.url || existing.website_url;
            existing.source_id = newSource.id;
          } else {
            MOCK_VENUES.push({
              id: MOCK_VENUES.length + 1,
              slug: vSlug,
              name: vName,
              address: payload.address || 'Melbourne VIC',
              website_url: payload.url,
              feed_url: payload.feed_url || null,
              source_id: newSource.id,
              is_active: 1
            });
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ 
          status: 'success', 
          message: 'Source and venue database updated successfully', 
          id: newSource.id 
        }));
      });
      return;
    }

    if (action === 'toggle_source' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const source = MOCK_SOURCES.find(s => s.id === payload.id);
        if (source) source.is_active = source.is_active ? 0 : 1;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'success', message: 'Source status toggled' }));
      });
      return;
    }

    if (action === 'approve_source' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const source = MOCK_SOURCES.find(s => s.id === payload.id);
        if (source) {
          source.is_active = 1;
          source.last_status = 'updated';
          source.item_count = source.item_count || 2;
          source.last_polled_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
          const v = MOCK_VENUES.find(v => v.source_id === source.id || v.slug === source.slug);
          if (v) v.is_active = 1;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ 
          status: 'success', 
          message: `Source approved and activated!`,
          item_count: source ? source.item_count : 2
        }));
      });
      return;
    }

    if (action === 'delete_source' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        MOCK_SOURCES = MOCK_SOURCES.filter(s => s.id !== payload.id);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'success', message: 'Source deleted' }));
      });
      return;
    }

    if (action === 'suggestions') {
      const statusFilter = parsedUrl.query.status || 'all';
      let filtered = MOCK_SUGGESTIONS;
      if (statusFilter !== 'all') {
        filtered = MOCK_SUGGESTIONS.filter(s => s.status === statusFilter);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        count: filtered.length,
        data: filtered
      }));
      return;
    }

    if (action === 'update_suggestion' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const sug = MOCK_SUGGESTIONS.find(s => s.id === payload.id);
        if (sug) sug.status = payload.status || 'read';
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'success', message: 'Suggestion updated' }));
      });
      return;
    }

    if (action === 'delete_suggestion' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        MOCK_SUGGESTIONS = MOCK_SUGGESTIONS.filter(s => s.id !== payload.id);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'success', message: 'Suggestion deleted' }));
      });
      return;
    }

    if (action === 'sync_single' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const source = MOCK_SOURCES.find(s => s.id === payload.id);
        if (!source) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Source not found' }));
          return;
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        source.last_polled_at = now;
        source.last_status = 'updated';
        source.http_code = 200;
        source.item_count = source.item_count || 5;

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          source_id: source.id,
          name: source.name,
          last_status: 'updated',
          item_count: source.item_count,
          last_polled_at: now
        }));
      });
      return;
    }

    if (action === 'sync_now' && req.method === 'POST') {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      MOCK_SOURCES.forEach(s => {
        if (s.is_active) {
          s.last_polled_at = now;
          s.last_status = 'updated';
          s.http_code = 200;
        }
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        message: 'Sync worker executed successfully',
        report: {
          total: MOCK_SOURCES.length,
          success: MOCK_SOURCES.filter(s => s.is_active).length,
          failed: 0,
          timestamp: now
        },
        log: `[${now}] Ingestion scan complete across ${MOCK_SOURCES.length} sources.\nAll active feeds updated. 0 errors.`
      }));
      return;
    }
  }

  // 9. Static File Serving (with /admin and /venues routing support)
  let cleanPath = pathname;
  if (cleanPath === '/' || cleanPath === '') {
    cleanPath = '/index.html';
  } else if (cleanPath === '/admin' || cleanPath === '/admin/') {
    cleanPath = '/admin/index.html';
  } else if (cleanPath === '/venues' || cleanPath === '/venues/') {
    cleanPath = '/venues/index.html';
  }

  let filePath = path.join(BASE_DIR, cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    fs.createReadStream(filePath).pipe(res);
  });
};

function startServer(port, isPrimary = false) {
  const srv = http.createServer(requestHandler);

  srv.listen(port, '0.0.0.0', () => {
    console.log(`\n✦ AgendaWeb Server is LIVE at: http://localhost:${port}${isPrimary ? ' (PRIMARY)' : ''}`);
    console.log(`  - Broadsheet PWA:  http://localhost:${port}/index.html`);
    console.log(`  - Admin Manager:   http://localhost:${port}/admin/index.html`);
    console.log(`  - Events JSON API: http://localhost:${port}/api/events.php`);
    console.log(`  - News JSON API:   http://localhost:${port}/api/items.php?tab=news`);
    console.log(`  - Blogs JSON API:  http://localhost:${port}/api/items.php?tab=blogs`);
    console.log(`  - Suggestion API:  http://localhost:${port}/api/suggestions.php`);
    console.log(`  - Admin JSON API:  http://localhost:${port}/api/admin.php`);
    console.log(`  - Proxy Feed API:  http://localhost:${port}/api/proxy_feed.php?url=...`);
    console.log(`  - RSS 2.0 Feed:    http://localhost:${port}/feed.php`);
    console.log(`  - iCal Export:     http://localhost:${port}/calendar.php?id=1\n`);
  });

  srv.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[dev_server] Port ${port} is already in use. Skipping port ${port}.`);
    } else {
      console.error(`[dev_server] Server error on port ${port}:`, err);
    }
  });

  return srv;
}

// Bind both primary port 8001 and port 8000 so all clients remain 100% updated
PORTS_TO_SERVE.forEach((p, idx) => startServer(p, idx === 0));
