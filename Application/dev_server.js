#!/usr/bin/env node
/**
 * AgendaWeb Local Development Server (Zero-Dependency)
 * Serves the PWA broadsheet and simulates API/syndication endpoints.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

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

const MOCK_CITIES = [
  { id: 1, slug: "melbourne", name: "Melbourne", state: "VIC", country: "Australia", postcode_prefix: "3", latitude: -37.8136, longitude: 144.9631, event_count: 4 },
  { id: 2, slug: "sydney", name: "Sydney", state: "NSW", country: "Australia", postcode_prefix: "2", latitude: -33.8688, longitude: 151.2093, event_count: 2 },
  { id: 3, slug: "brisbane", name: "Brisbane", state: "QLD", country: "Australia", postcode_prefix: "4", latitude: -27.4698, longitude: 153.0251, event_count: 1 },
  { id: 4, slug: "perth", name: "Perth", state: "WA", country: "Australia", postcode_prefix: "6", latitude: -31.9505, longitude: 115.8605, event_count: 1 },
  { id: 5, slug: "adelaide", name: "Adelaide", state: "SA", country: "Australia", postcode_prefix: "5", latitude: -34.9285, longitude: 138.6007, event_count: 1 },
  { id: 6, slug: "hobart", name: "Hobart", state: "TAS", country: "Australia", postcode_prefix: "7", latitude: -42.8821, longitude: 147.3272, event_count: 1 }
];

// Seed Mock Data with image support matching Docs/Schema.sql & Docs/API_Spec.md
const MOCK_EVENTS = [
  {
    id: 1,
    city_id: 1,
    city_slug: "melbourne",
    city_name: "Melbourne",
    venue_slug: "the-gasometer-hotel",
    venue_name: "The Gasometer Hotel",
    title: "The Echoes — Album Launch",
    description: "Melbourne indie rock outfit celebrating their debut LP release with special guests. Licensed 18+ event.",
    category: "Live Music",
    age_restriction: "18+",
    min_age: 18,
    is_family_friendly: 0,
    start_time: "2026-10-24 20:00:00",
    end_time: "2026-10-24 23:30:00",
    address: "484 Smith St, Collingwood VIC 3066",
    suburb: "Collingwood",
    ticket_url: "https://oztix.com.au/event/12345",
    image_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=700&q=80",
    origin: "scraped",
    is_verified: 1,
    calendar_url: "calendar.php?id=1"
  },
  {
    id: 2,
    city_id: 1,
    city_slug: "melbourne",
    city_name: "Melbourne",
    venue_slug: "fitzroy-community-arts",
    venue_name: "Fitzroy Community Arts",
    title: "Contemporary Printmaking Biennial",
    description: "Showcasing emerging Australian printmakers, risograph posters, and indie zines. Open to all ages.",
    category: "Art",
    age_restriction: "all_ages",
    min_age: 0,
    is_family_friendly: 1,
    start_time: "2026-10-25 10:00:00",
    end_time: "2026-10-25 17:00:00",
    address: "128 Gertrude St, Fitzroy VIC 3065",
    suburb: "Fitzroy",
    ticket_url: "",
    image_url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=700&q=80",
    origin: "manual",
    is_verified: 1,
    calendar_url: "calendar.php?id=2"
  },
  {
    id: 3,
    city_id: 1,
    city_slug: "melbourne",
    city_name: "Melbourne",
    venue_slug: "the-corner-hotel",
    venue_name: "The Corner Hotel",
    title: "Sunset Soundscapes: Ambient & Synth Showcase",
    description: "An evening of analog synthesizers and ambient soundscapes featuring local producers. 18+ photo ID required.",
    category: "Live Music",
    age_restriction: "18+",
    min_age: 18,
    is_family_friendly: 0,
    start_time: "2026-10-26 19:30:00",
    end_time: "2026-10-26 23:00:00",
    address: "57 Swan St, Richmond VIC 3121",
    suburb: "Richmond",
    ticket_url: "https://thecornerhotel.com",
    image_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=700&q=80",
    origin: "scraped",
    is_verified: 1,
    calendar_url: "calendar.php?id=3"
  },
  {
    id: 4,
    city_id: 1,
    city_slug: "melbourne",
    city_name: "Melbourne",
    venue_slug: "collingwood-yards",
    venue_name: "Collingwood Yards",
    title: "Puppet Theatre & Shadow Craft Workshop",
    description: "Hands-on creative workshop for children, kids, and families. Construct your own cardboard silhouette puppet with live storytelling.",
    category: "Community",
    age_restriction: "kids_family",
    min_age: 0,
    is_family_friendly: 1,
    start_time: "2026-10-27 10:30:00",
    end_time: "2026-10-27 14:00:00",
    address: "35 Johnston St, Collingwood VIC 3066",
    suburb: "Collingwood",
    ticket_url: "",
    image_url: "https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?auto=format&fit=crop&w=700&q=80",
    origin: "manual",
    is_verified: 1,
    calendar_url: "calendar.php?id=4"
  },
  {
    id: 5,
    city_id: 2,
    city_slug: "sydney",
    city_name: "Sydney",
    venue_slug: "enmore-theatre",
    venue_name: "Enmore Theatre",
    title: "Newtown Noise: Post-Punk Collective",
    description: "Four Sydney underground acts take over the iconic Enmore stage for an electrifying night of live sound. 18+ licensed venue.",
    category: "Live Music",
    age_restriction: "18+",
    min_age: 18,
    is_family_friendly: 0,
    start_time: "2026-10-28 20:00:00",
    end_time: "2026-10-28 23:45:00",
    address: "118-132 Enmore Rd, Newtown NSW 2042",
    suburb: "Newtown",
    ticket_url: "https://enmoretheatre.com.au",
    image_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=700&q=80",
    origin: "scraped",
    is_verified: 1,
    calendar_url: "calendar.php?id=5"
  },
  {
    id: 6,
    city_id: 2,
    city_slug: "sydney",
    city_name: "Sydney",
    venue_slug: "enmore-theatre",
    venue_name: "Enmore Theatre",
    title: "Saturday Morning Family Matinee & Story Symphony",
    description: "An interactive musical tale designed for toddlers, kids, and parents with acoustic chamber instruments.",
    category: "Community",
    age_restriction: "kids_family",
    min_age: 0,
    is_family_friendly: 1,
    start_time: "2026-10-31 10:00:00",
    end_time: "2026-10-31 12:00:00",
    address: "118-132 Enmore Rd, Newtown NSW 2042",
    suburb: "Newtown",
    ticket_url: "https://enmoretheatre.com.au",
    image_url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=700&q=80",
    origin: "manual",
    is_verified: 1,
    calendar_url: "calendar.php?id=6"
  },
  {
    id: 7,
    city_id: 3,
    city_slug: "brisbane",
    city_name: "Brisbane",
    venue_slug: "brisbane-powerhouse",
    venue_name: "Brisbane Powerhouse",
    title: "Riverfront Jazz & Vinyl Fair",
    description: "Riverside open-air live acoustic sets, vinyl stalls, and indie food pop-ups. All ages welcome.",
    category: "Live Music",
    age_restriction: "all_ages",
    min_age: 0,
    is_family_friendly: 1,
    start_time: "2026-11-01 14:00:00",
    end_time: "2026-11-01 20:00:00",
    address: "119 Lamington St, New Farm QLD 4005",
    suburb: "New Farm",
    ticket_url: "https://brisbanepowerhouse.org",
    image_url: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=700&q=80",
    origin: "scraped",
    is_verified: 1,
    calendar_url: "calendar.php?id=7"
  },
  {
    id: 8,
    city_id: 4,
    city_slug: "perth",
    city_name: "Perth",
    venue_slug: "fremantle-arts-centre",
    venue_name: "Fremantle Arts Centre",
    title: "Maritime Sound Art Installation",
    description: "Immersive field recordings and sonic frequencies inspired by the Indian Ocean. Free entry for all ages.",
    category: "Art",
    age_restriction: "all_ages",
    min_age: 0,
    is_family_friendly: 1,
    start_time: "2026-11-02 11:00:00",
    end_time: "2026-11-02 17:00:00",
    address: "1 Finnerty St, Fremantle WA 6160",
    suburb: "Fremantle",
    ticket_url: "",
    image_url: "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=700&q=80",
    origin: "manual",
    is_verified: 1,
    calendar_url: "calendar.php?id=8"
  },
  {
    id: 9,
    city_id: 5,
    city_slug: "adelaide",
    city_name: "Adelaide",
    venue_slug: "lion-arts-factory",
    venue_name: "Lion Arts Factory",
    title: "West End Experimental Synth Lab",
    description: "Underground modular synth performances, audio-visual experiments, and cider bar. 18+ strictly.",
    category: "Live Music",
    age_restriction: "18+",
    min_age: 18,
    is_family_friendly: 0,
    start_time: "2026-11-05 20:30:00",
    end_time: "2026-11-06 01:00:00",
    address: "68 North Terrace, Adelaide SA 5000",
    suburb: "Adelaide",
    ticket_url: "",
    image_url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=700&q=80",
    origin: "scraped",
    is_verified: 1,
    calendar_url: "calendar.php?id=9"
  },
  {
    id: 10,
    city_id: 6,
    city_slug: "hobart",
    city_name: "Hobart",
    venue_slug: "the-odeon-theatre",
    venue_name: "The Odeon Theatre",
    title: "Tasmanian Winter Light & Shadow Show",
    description: "Large-scale projection mapping and live cello scores. All ages cultural gathering.",
    category: "Art",
    age_restriction: "all_ages",
    min_age: 0,
    is_family_friendly: 1,
    start_time: "2026-11-07 19:00:00",
    end_time: "2026-11-07 22:00:00",
    address: "167 Liverpool St, Hobart TAS 7000",
    suburb: "Hobart",
    ticket_url: "",
    image_url: "https://images.unsplash.com/photo-1499364615650-ec38552f4f34?auto=format&fit=crop&w=700&q=80",
    origin: "manual",
    is_verified: 1,
    calendar_url: "calendar.php?id=10"
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
    city_id: 1,
    slug: "the-gasometer-hotel",
    name: "The Gasometer Hotel",
    address: "484 Smith St, Collingwood VIC 3066",
    suburb: "Collingwood",
    state: "VIC",
    postcode: "3066",
    default_age_policy: "18+",
    website_url: "https://www.thegasometerhotel.com.au",
    feed_url: "https://www.thegasometerhotel.com.au/gigs",
    source_id: 5,
    is_active: 1
  },
  {
    id: 2,
    city_id: 1,
    slug: "the-corner-hotel",
    name: "The Corner Hotel",
    address: "57 Swan St, Richmond VIC 3121",
    suburb: "Richmond",
    state: "VIC",
    postcode: "3121",
    default_age_policy: "18+",
    website_url: "https://thecornerhotel.com",
    feed_url: "https://thecornerhotel.com/gigs",
    source_id: 6,
    is_active: 1
  },
  {
    id: 3,
    city_id: 1,
    slug: "fitzroy-community-arts",
    name: "Fitzroy Community Arts",
    address: "128 Gertrude St, Fitzroy VIC 3065",
    suburb: "Fitzroy",
    state: "VIC",
    postcode: "3065",
    default_age_policy: "all_ages",
    website_url: "https://fitzroyarts.org.au",
    feed_url: null,
    source_id: null,
    is_active: 1
  },
  {
    id: 4,
    city_id: 2,
    slug: "enmore-theatre",
    name: "Enmore Theatre",
    address: "118-132 Enmore Rd, Newtown NSW 2042",
    suburb: "Newtown",
    state: "NSW",
    postcode: "2042",
    default_age_policy: "mixed",
    website_url: "https://enmoretheatre.com.au",
    feed_url: null,
    source_id: null,
    is_active: 1
  },
  {
    id: 5,
    city_id: 3,
    slug: "brisbane-powerhouse",
    name: "Brisbane Powerhouse",
    address: "119 Lamington St, New Farm QLD 4005",
    suburb: "New Farm",
    state: "QLD",
    postcode: "4005",
    default_age_policy: "mixed",
    website_url: "https://brisbanepowerhouse.org",
    feed_url: null,
    source_id: null,
    is_active: 1
  }
];

let MOCK_SUGGESTIONS = [
  { id: 1, name: "Liam K.", email: "liam@musicvic.com.au", category: "venue_feed", message: "Would love to see The Tote and Northcote Social Club gig feeds added to the live events calendar!", status: "new", created_at: "2026-10-18 14:22:10" },
  { id: 2, name: "Chloe S.", email: "chloe@example.com", category: "feature", message: "The offline reading queue in IndexedDB is brilliant. Could we have an option to export selected reading lists?", status: "read", created_at: "2026-10-17 19:40:05" }
];

let MOCK_USERS = [
  {
    id: 1,
    name: "Claudinei Sousa",
    email: "admin@agendaweb.app",
    password: "AgendaAdmin2026!",
    role: "admin",
    is_active: 1,
    last_login_at: "2026-10-21 21:00:00",
    created_at: "2026-10-01 10:00:00",
    updated_at: "2026-10-21 21:00:00"
  },
  {
    id: 2,
    name: "Curation Manager",
    email: "curator@agendaweb.app",
    password: "CuratorPass2026!",
    role: "manager",
    is_active: 1,
    last_login_at: "2026-10-20 15:30:00",
    created_at: "2026-10-05 11:00:00",
    updated_at: "2026-10-20 15:30:00"
  }
];

let MOCK_SESSIONS = new Map(); // token -> { user_id, expires_at }

function authenticateUser(req, parsedUrl) {
  // 1. Check Bearer token or X-Admin-Token
  const authHeader = req.headers['authorization'] || '';
  let token = null;
  const match = authHeader.match(/Bearer\s+(\S+)/i);
  if (match) {
    token = match[1];
  } else if (req.headers['x-admin-token']) {
    token = req.headers['x-admin-token'];
  } else if (parsedUrl.query && parsedUrl.query.token) {
    token = parsedUrl.query.token;
  }

  if (token && MOCK_SESSIONS.has(token)) {
    const session = MOCK_SESSIONS.get(token);
    if (session.expires_at > Date.now()) {
      const user = MOCK_USERS.find(u => u.id === session.user_id && u.is_active === 1);
      if (user) return user;
    } else {
      MOCK_SESSIONS.delete(token);
    }
  }

  // 2. Fallback: master key bypass
  const providedKey = req.headers['x-admin-key'] || (parsedUrl.query && parsedUrl.query.key);
  if (providedKey && providedKey === 'agendaweb-admin-secret-2026') {
    return {
      id: 0,
      name: "System Superadmin",
      email: "admin@agendaweb.app",
      role: "admin",
      is_active: 1
    };
  }

  return null;
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, X-Admin-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. API: Cities Directory
  if (pathname === '/api/cities.php') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'success',
      count: MOCK_CITIES.length,
      data: MOCK_CITIES
    }));
    return;
  }

  // 1.1 API: Events Feed
  if (pathname === '/api/events.php') {
    const category = parsedUrl.query.category || 'all';
    const venue = parsedUrl.query.venue || 'all';
    const city = parsedUrl.query.city || 'all';
    const age = parsedUrl.query.age || 'all';
    const family = parsedUrl.query.family;

    let filtered = MOCK_EVENTS;
    if (city && city !== 'all') {
      filtered = filtered.filter(e => e.city_slug === city || (e.city_name || '').toLowerCase() === city.toLowerCase());
    }
    if (category && category !== 'all' && category !== 'All') {
      filtered = filtered.filter(e => e.category.toLowerCase() === category.toLowerCase());
    }
    if (venue && venue !== 'all') {
      filtered = filtered.filter(e => e.venue_slug === venue);
    }
    if (age && age !== 'all') {
      filtered = filtered.filter(e => e.age_restriction === age);
    }
    if (family === 'true' || family === '1') {
      filtered = filtered.filter(e => e.is_family_friendly === 1);
    }

    const categories = ['All', ...new Set(MOCK_EVENTS.map(e => e.category))];

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'success',
      count: filtered.length,
      total: MOCK_EVENTS.length,
      categories: categories,
      cities: MOCK_CITIES,
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

      const venueCitySlug = (targetUrl.includes('sydney') || targetUrl.includes('enmore')) ? 'sydney' 
        : (targetUrl.includes('brisbane') ? 'brisbane' : 'melbourne');
      const venueCityName = venueCitySlug === 'sydney' ? 'Sydney' : (venueCitySlug === 'brisbane' ? 'Brisbane' : 'Melbourne');
      const venueSuburb = venueCitySlug === 'sydney' ? 'Newtown' : (venueCitySlug === 'brisbane' ? 'New Farm' : 'Collingwood');
      const venueState = venueCitySlug === 'sydney' ? 'NSW' : (venueCitySlug === 'brisbane' ? 'QLD' : 'VIC');
      const venuePostcode = venueCitySlug === 'sydney' ? '2042' : (venueCitySlug === 'brisbane' ? '4005' : '3066');

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
          address: `${venueSuburb} ${venueState} ${venuePostcode}`,
          suburb: venueSuburb,
          state: venueState,
          postcode: venuePostcode,
          city_slug: venueCitySlug,
          city_name: venueCityName,
          default_age_policy: '18+'
        },
        events: [
          {
            title: "Live Showcase & Emerging Artists",
            start_time: "2026-10-25 20:00:00",
            category: "Live Music",
            venue_name: venueName,
            address: `${venueSuburb} ${venueState}`,
            suburb: venueSuburb,
            age: "18+",
            ticket_url: targetUrl
          },
          {
            title: "Sunday Acoustic & Coffee Matinee",
            start_time: "2026-10-27 11:00:00",
            category: "Live Music",
            venue_name: venueName,
            address: `${venueSuburb} ${venueState}`,
            suburb: venueSuburb,
            age: "kids_family",
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
        const citySlug = payload.city_slug || 'melbourne';
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
          submission_notes: `Self-service onboarding request. City: ${citySlug}. Age: ${payload.default_age_policy || 'mixed'}. Polling: ${payload.polling_frequency || payload.polling_freq || '24h'}`,
          last_error: null,
          last_polled_at: null
        };
        MOCK_SOURCES.push(newSource);

        MOCK_VENUES.push({
          id: MOCK_VENUES.length + 1,
          city_id: citySlug === 'sydney' ? 2 : (citySlug === 'brisbane' ? 3 : 1),
          slug: sourceSlug,
          name: venueName,
          address: payload.address || `${payload.suburb || 'Collingwood'} ${payload.state || 'VIC'}`,
          suburb: payload.suburb || 'Collingwood',
          state: payload.state || 'VIC',
          postcode: payload.postcode || '3066',
          default_age_policy: payload.default_age_policy || 'mixed',
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

  // 7.1 API: Auth Operations
  if (pathname === '/api/auth.php') {
    const action = parsedUrl.query.action || 'me';

    if (action === 'login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const email = (payload.email || '').trim().toLowerCase();
        const password = payload.password || '';

        if (!email || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Email and password are required.' }));
          return;
        }

        const user = MOCK_USERS.find(u => u.email.toLowerCase() === email && u.password === password);
        if (!user) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Invalid email or password.' }));
          return;
        }

        if (user.is_active !== 1) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Account is inactive. Please contact an administrator.' }));
          return;
        }

        const token = crypto.randomBytes(32).toString('hex');
        MOCK_SESSIONS.set(token, {
          user_id: user.id,
          expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000
        });

        user.last_login_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          token: token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        }));
      });
      return;
    }

    if (action === 'me') {
      const user = authenticateUser(req, parsedUrl);
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: 'Unauthorized: Please log in with your email and password' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }));
      return;
    }

    if (action === 'change_password' && req.method === 'POST') {
      const user = authenticateUser(req, parsedUrl);
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: 'Unauthorized: Please log in' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const currentPassword = payload.current_password || '';
        const newPassword = payload.new_password || '';

        if (!currentPassword || !newPassword) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Current password and new password are required.' }));
          return;
        }

        if (newPassword.length < 8) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'New password must be at least 8 characters long.' }));
          return;
        }

        // Verify current password
        const targetUser = MOCK_USERS.find(u => u.id === user.id);
        if (targetUser && targetUser.password !== currentPassword) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Incorrect current password.' }));
          return;
        }

        if (targetUser) {
          targetUser.password = newPassword;
          targetUser.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          message: 'Password updated successfully.'
        }));
      });
      return;
    }

    if (action === 'logout' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      let token = null;
      const match = authHeader.match(/Bearer\s+(\S+)/i);
      if (match) token = match[1];
      else if (req.headers['x-admin-token']) token = req.headers['x-admin-token'];
      else if (parsedUrl.query && parsedUrl.query.token) token = parsedUrl.query.token;

      if (token) {
        MOCK_SESSIONS.delete(token);
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'success', message: 'Logged out successfully.' }));
      return;
    }

    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'error', message: 'Unknown auth action.' }));
    return;
  }

  // 7.2 API: User & Team Management
  if (pathname === '/api/users.php') {
    const action = parsedUrl.query.action || 'list';
    const currentUser = authenticateUser(req, parsedUrl);

    if (!currentUser) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'error', message: 'Unauthorized: Please log in with your email and password' }));
      return;
    }

    if (currentUser.role !== 'admin') {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'error', message: 'Forbidden: Admin privilege required for this action' }));
      return;
    }

    if (action === 'list') {
      const safeUsers = MOCK_USERS.map(({ password, ...u }) => u);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        count: safeUsers.length,
        data: safeUsers
      }));
      return;
    }

    if (action === 'create' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const name = (payload.name || '').trim();
        const email = (payload.email || '').trim().toLowerCase();
        const password = payload.password || '';
        const role = (payload.role === 'admin') ? 'admin' : 'manager';

        if (!name || !email || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Name, email, and password are required.' }));
          return;
        }

        if (!email.includes('@') || !email.includes('.')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Invalid email address format.' }));
          return;
        }

        if (password.length < 8) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Password must be at least 8 characters long.' }));
          return;
        }

        if (MOCK_USERS.some(u => u.email.toLowerCase() === email)) {
          res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'A user with this email address already exists.' }));
          return;
        }

        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const newUser = {
          id: MOCK_USERS.length + 1,
          name,
          email,
          password,
          role,
          is_active: 1,
          last_login_at: null,
          created_at: now,
          updated_at: now
        };
        MOCK_USERS.push(newUser);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          message: `Team member '${name}' created successfully.`,
          id: newUser.id
        }));
      });
      return;
    }

    if (action === 'toggle_status' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const id = parseInt(payload.id, 10);

        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'User ID is required.' }));
          return;
        }

        if (id === currentUser.id) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'You cannot deactivate your own account.' }));
          return;
        }

        const target = MOCK_USERS.find(u => u.id === id);
        if (!target) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'User not found.' }));
          return;
        }

        target.is_active = target.is_active === 1 ? 0 : 1;
        target.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

        // Revoke active sessions if deactivated
        if (target.is_active === 0) {
          for (const [token, sess] of MOCK_SESSIONS.entries()) {
            if (sess.user_id === id) MOCK_SESSIONS.delete(token);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          message: `User '${target.name}' is now ${target.is_active === 1 ? 'Active' : 'Inactive'}`,
          is_active: target.is_active
        }));
      });
      return;
    }

    if (action === 'change_role' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const id = parseInt(payload.id, 10);
        const role = payload.role === 'admin' ? 'admin' : (payload.role === 'manager' ? 'manager' : null);

        if (!id || !role) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'User ID and valid role (admin or manager) are required.' }));
          return;
        }

        if (id === currentUser.id && role !== 'admin') {
          const adminCount = MOCK_USERS.filter(u => u.role === 'admin' && u.is_active === 1).length;
          if (adminCount <= 1) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ status: 'error', message: 'Cannot demote yourself: at least one active Admin must remain in the system.' }));
            return;
          }
        }

        const target = MOCK_USERS.find(u => u.id === id);
        if (target) {
          target.role = role;
          target.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          message: `Role updated to '${role}'.`
        }));
      });
      return;
    }

    if (action === 'reset_password' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const id = parseInt(payload.id, 10);
        const newPassword = payload.new_password || '';

        if (!id || newPassword.length < 8) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'User ID and new password (min 8 characters) are required.' }));
          return;
        }

        const target = MOCK_USERS.find(u => u.id === id);
        if (target) {
          target.password = newPassword;
          target.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
          for (const [token, sess] of MOCK_SESSIONS.entries()) {
            if (sess.user_id === id) MOCK_SESSIONS.delete(token);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          message: 'Password reset successfully for user.'
        }));
      });
      return;
    }

    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'error', message: `Unknown user action: ${action}` }));
    return;
  }

  // 8. API: Admin Operations
  if (pathname === '/api/admin.php') {
    const action = parsedUrl.query.action || 'stats';
    const currentUser = authenticateUser(req, parsedUrl);

    if (!currentUser) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'error', message: 'Unauthorized: Please log in with your email and password' }));
      return;
    }

    if (['sync_now', 'delete_source'].includes(action) && currentUser.role !== 'admin') {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'error', message: `Admin privilege required to perform '${action}'.` }));
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
