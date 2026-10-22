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

// Real Data Store - populated dynamically via live feeds and discoverEventsFromUrl
let MOCK_EVENTS = [];

let MOCK_SOURCES = [
  { id: 1, slug: "abc-just-in", name: "ABC News", type: "rss", url: "https://www.abc.net.au/news/feed/51120/rss.xml", category_tab: "news", is_active: 1, last_status: "active", http_code: 200, item_count: 0, last_error: null, last_polled_at: null },
  { id: 2, slug: "sbs-top-stories", name: "SBS News", type: "rss", url: "https://www.sbs.com.au/news/feed", category_tab: "news", is_active: 1, last_status: "active", http_code: 200, item_count: 0, last_error: null, last_polled_at: null },
  { id: 3, slug: "guardian-au-culture", name: "The Guardian AU Culture", type: "rss", url: "https://www.theguardian.com/au/culture/rss", category_tab: "blogs", is_active: 1, last_status: "active", http_code: 200, item_count: 0, last_error: null, last_polled_at: null },
  { id: 4, slug: "the-conversation-au", name: "The Conversation (AU)", type: "rss", url: "https://theconversation.com/au/politics/articles.atom", category_tab: "blogs", is_active: 1, last_status: "active", http_code: 200, item_count: 0, last_error: null, last_polled_at: null },
  { id: 5, slug: "trouble-mag", name: "Trouble Magazine", type: "rss", url: "https://www.troublemag.com/feed/", category_tab: "blogs", is_active: 1, last_status: "active", http_code: 200, item_count: 0, last_error: null, last_polled_at: null },
  { id: 6, slug: "bar-oussou", name: "Bar Oussou Brunswick", type: "scrape_event", url: "https://www.baroussou.com.au/gigs/", feed_url: "https://www.baroussou.com.au/wp-json/baroussou/v1/events", category_tab: "events", is_active: 1, last_status: "active", http_code: 200, item_count: 0, last_error: null, last_polled_at: null }
];

let MOCK_VENUES = [
  {
    id: 1,
    city_id: 1,
    slug: "bar-oussou",
    name: "Bar Oussou",
    address: "659 Sydney Rd, Brunswick VIC 3056",
    suburb: "Brunswick",
    state: "VIC",
    postcode: "3056",
    default_age_policy: "18+",
    website_url: "https://www.baroussou.com.au",
    feed_url: "https://www.baroussou.com.au/wp-json/baroussou/v1/events",
    source_id: 6,
    is_active: 1
  }
];

let MOCK_SUGGESTIONS = [];

// Tombstones to prevent re-ingestion of items deleted via Admin
const DELETED_EVENT_KEYS = new Set();
const DELETED_ITEM_LINKS = new Set();
const DELETED_SOURCE_URLS = new Set();

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
  news: [],
  blogs: []
};


// --- Live RSS & Atom Feed Ingestion Engine ---
function cleanCdata(str) {
  if (!str) return "";
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function stripHtml(html) {
  if (!html) return "";
  return cleanCdata(html)
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFeedXml(xmlStr) {
  const isAtom = xmlStr.includes("<feed") && xmlStr.includes("<entry");
  const channelTitleMatch = xmlStr.match(/<channel[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i) || xmlStr.match(/<feed[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
  const feedTitle = channelTitleMatch ? stripHtml(channelTitleMatch[1]) : "Live Feed";

  const itemRegex = isAtom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const items = [];
  let m;

  while ((m = itemRegex.exec(xmlStr)) !== null && items.length < 30) {
    const raw = m[1];

    const titleMatch = raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : "Untitled Dispatch";

    let link = "";
    const atomLinkMatch = raw.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i) || raw.match(/<link\b[^>]*href=["']([^"']+)["']/i);
    const rssLinkMatch = raw.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
    if (isAtom && atomLinkMatch) link = atomLinkMatch[1];
    else if (rssLinkMatch) link = cleanCdata(rssLinkMatch[1]);
    else if (atomLinkMatch) link = atomLinkMatch[1];

    const descMatch = raw.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i) || raw.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    const rawDesc = descMatch ? cleanCdata(descMatch[1]) : "";
    const summary = stripHtml(rawDesc).slice(0, 320);

    const contentMatch = raw.match(/<content:encoded\b[^>]*>([\s\S]*?)<\/content:encoded>/i) || raw.match(/<content\b[^>]*>([\s\S]*?)<\/content>/i);
    const fullContent = contentMatch ? cleanCdata(contentMatch[1]) : (rawDesc || `<p>${summary}</p>`);

    const dateMatch = raw.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i) || raw.match(/<updated\b[^>]*>([\s\S]*?)<\/updated>/i) || raw.match(/<published\b[^>]*>([\s\S]*?)<\/published>/i);
    let pubDate = new Date().toISOString();
    if (dateMatch) {
      const parsed = Date.parse(cleanCdata(dateMatch[1]));
      if (!isNaN(parsed)) pubDate = new Date(parsed).toISOString();
    }

    const catMatch = raw.match(/<category\b[^>]*term=["']([^"']+)["']/i) || raw.match(/<category\b[^>]*>([\s\S]*?)<\/category>/i);
    const category = catMatch ? stripHtml(catMatch[1]) : "General";

    let imageUrl = "";
    const enclosureImg = raw.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*type=["']image\//i) || raw.match(/<enclosure\b[^>]*type=["']image\/[^"']*["'][^>]*url=["']([^"']+)["']/i);
    const mediaImg = raw.match(/<media:content\b[^>]*url=["']([^"']+)["']/i) || raw.match(/<media:thumbnail\b[^>]*url=["']([^"']+)["']/i);
    const imgTag = raw.match(/<img\b[^>]*src=["']([^"']+)["']/i);

    if (enclosureImg) imageUrl = enclosureImg[1];
    else if (mediaImg) imageUrl = mediaImg[1];
    else if (imgTag) imageUrl = imgTag[1];

    items.push({
      title,
      link,
      summary,
      content: fullContent,
      category,
      image_url: imageUrl,
      published_at: pubDate.replace("T", " ").slice(0, 19)
    });
  }

  return { title: feedTitle, items };
}

let nextItemId = 1000;
async function syncRssSource(source) {
  if (source.type !== 'rss' || DELETED_SOURCE_URLS.has(source.url)) return source.item_count || 0;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AgendaWeb-Bot/1.0 (+https://agendaweb.app)'
      }
    });
    clearTimeout(timeout);

    source.http_code = res.status;
    if (!res.ok) {
      source.last_status = 'failed';
      source.last_error = `HTTP ${res.status} ${res.statusText}`;
      return 0;
    }

    const xml = await res.text();
    const parsed = parseFeedXml(xml);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (parsed.items.length > 0) {
      const tab = source.category_tab || 'blogs';
      if (!MOCK_ITEMS[tab]) MOCK_ITEMS[tab] = [];

      // Avoid duplicating items by link or re-ingesting items deleted by admin
      const existingLinks = new Set(MOCK_ITEMS[tab].map(i => i.link));
      const formatted = parsed.items
        .filter(item => !DELETED_ITEM_LINKS.has(item.link))
        .map(item => ({
          id: ++nextItemId,
          source_id: source.id,
          source_name: source.name,
          category_tab: tab,
          category: item.category || 'General',
          title: item.title,
          link: item.link,
          summary: item.summary,
          content: item.content,
          image_url: item.image_url || '',
          published_at: item.published_at || now
        }));

      const toAdd = formatted.filter(item => !existingLinks.has(item.link));
      MOCK_ITEMS[tab] = [...toAdd, ...MOCK_ITEMS[tab]];

      source.item_count = MOCK_ITEMS[tab].filter(i => i.source_id === source.id).length;
      source.last_status = 'updated';
      source.last_error = null;
      source.last_polled_at = now;
      return source.item_count;
    }

    source.last_status = 'active';
    source.last_polled_at = now;
    return 0;
  } catch (err) {
    source.last_status = 'failed';
    source.last_error = err.message || 'Network error';
    return 0;
  }
}

async function discoverEventsFromUrl(targetUrl) {
  const result = {
    targetUrl,
    pageTitle: '',
    discoveredFeed: null,
    detectedEvents: [],
    detectedVenueName: '',
    detectedAddress: '',
    detectedType: 'scrape_event',
    method: 'none',
    error: null
  };

  try {
    // Strategy 1: Direct Bar Oussou WordPress REST Events API
    if (targetUrl.includes('baroussou.com.au')) {
      try {
        const bRes = await fetch('https://www.baroussou.com.au/wp-json/baroussou/v1/events', {
          headers: { 'User-Agent': 'AgendaWeb-Bot/1.0 (+https://agendaweb.app; Melbourne Broadsheet)' }
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          const bItems = bData.items || [];
          const nowMs = Date.now() - 24 * 3600 * 1000;
          for (const item of bItems) {
            if (!item.eventDate) continue;
            const parts = item.eventDate.split('/');

            if (parts.length !== 3) continue;
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];

            const time = (item.eventTime && item.eventTime.trim().length >= 4) ? item.eventTime.trim() : '20:00';
            const d = new Date(`${year}-${month}-${day}T${time.length === 5 ? time : '20:00'}:00`);
            if (isNaN(d.getTime()) || d.getTime() < nowMs) continue;

            const isKoorie = (item.artistName || '').toLowerCase().includes('koorie');
            result.detectedEvents.push({
              title: item.artistName || 'Live Music at Bar Oussou',
              start_time: `${year}-${month}-${day} ${time.length === 5 ? time : '20:00'}:00`,

              end_time: null,
              category: item.eventCategory === 'recurring' ? 'Community' : 'Live Music',
              venue_name: 'Bar Oussou',
              address: '659 Sydney Rd, Brunswick VIC 3056',
              suburb: 'Brunswick',
              age_restriction: isKoorie ? 'all_ages' : '18+',
              min_age: isKoorie ? 0 : 18,
              is_family_friendly: isKoorie ? 1 : 0,
              ticket_url: item.slug ? `https://events.baroussou.com.au/${item.slug}` : targetUrl,
              image_url: item.posterImage || ''
            });
          }
          result.detectedEvents.sort((a,b) => a.start_time.localeCompare(b.start_time));
          result.pageTitle = 'Bar Oussou Brunswick | Live Music & Culture';
          result.detectedVenueName = 'Bar Oussou';
          result.detectedAddress = '659 Sydney Rd, Brunswick VIC 3056';
          result.method = 'WordPress REST API (Bar Oussou)';
          return result;
        }
      } catch (be) {}
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const webRes = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AgendaWeb-Bot/1.0 (+https://agendaweb.app; Melbourne Broadsheet)' }
    });
    clearTimeout(timeout);

    const html = await webRes.text();
    const pageTitleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    result.pageTitle = pageTitleMatch ? stripHtml(pageTitleMatch[1]) : '';

    // Check for alternate RSS/Atom links
    const rssMatch = html.match(/<link\b[^>]*rel=["']alternate["'][^>]*type=["']application\/(rss\+xml|atom\+xml)["'][^>]*href=["']([^"']+)["']/i)
      || html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*type=["']application\/(rss\+xml|atom\+xml)["']/i);
    if (rssMatch) {
      let feed = rssMatch[2] || rssMatch[1];
      try { feed = new URL(feed, targetUrl).href; } catch(e) {}
      result.discoveredFeed = feed;
    }

    // STRATEGY 2: Schema.org JSON-LD
    const jsonLdMatches = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of jsonLdMatches) {
      try {
        const data = JSON.parse(m[1].trim());
        const nodes = Array.isArray(data) ? data : (data['@graph'] || [data]);
        for (const node of nodes) {
          const type = node['@type'] || '';
          if (typeof type === 'string' && (type === 'Event' || type.endsWith('Event'))) {
            if (!node.name || !node.startDate) continue;
            const vName = node.location?.name || '';
            if (vName && !result.detectedVenueName) result.detectedVenueName = vName;
            const addr = typeof node.location?.address === 'object' ? (node.location.address.streetAddress || '') : (node.location?.address || '');
            if (addr && !result.detectedAddress) result.detectedAddress = addr;
            
            result.detectedEvents.push({
              title: String(node.name).trim(),
              start_time: node.startDate ? node.startDate.replace('T', ' ').slice(0, 19) : '',
              end_time: node.endDate ? node.endDate.replace('T', ' ').slice(0, 19) : null,
              category: type.replace('Event', '') || 'Live Music',
              venue_name: vName,
              address: addr,
              suburb: '',
              age_restriction: '18+',
              min_age: 18,
              is_family_friendly: 0,
              ticket_url: node.offers?.url || node.url || targetUrl,
              image_url: Array.isArray(node.image) ? node.image[0] : (node.image || '')
            });
          }
        }
      } catch(e) {}
    }

    if (result.detectedEvents.length > 0) {
      result.method = 'Schema.org JSON-LD';
    }

    // STRATEGY 3: Check Embedded Iframes
    if (result.detectedEvents.length === 0) {
      const iframeMatches = [...html.matchAll(/<iframe\b[^>]*src=["']([^"']+)["']/gi)];
      for (const ifm of iframeMatches) {
        let iframeSrc = ifm[1];
        if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
        if (!iframeSrc.startsWith('http')) {
          try { iframeSrc = new URL(iframeSrc, targetUrl).href; } catch(e) { continue; }
        }

        if (iframeSrc.includes('baroussou.com.au')) {
          return discoverEventsFromUrl('https://www.baroussou.com.au/gigs/');
        }

        if (/events|gig|ticket|humanitix|eventbrite|oztix|moshtix/i.test(iframeSrc)) {
          try {
            const ifRes = await fetch(iframeSrc, {
              headers: { 'User-Agent': 'AgendaWeb-Bot/1.0 (+https://agendaweb.app; Melbourne Broadsheet)' }
            });
            if (ifRes.ok) {
              const ifHtml = await ifRes.text();
              const ifJsonLd = ifHtml.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
              for (const jm of ifJsonLd) {
                try {
                  const jdata = JSON.parse(jm[1].trim());
                  const jnodes = Array.isArray(jdata) ? jdata : (jdata['@graph'] || [jdata]);
                  for (const jn of jnodes) {
                    if (jn['@type'] === 'Event' || (typeof jn['@type'] === 'string' && jn['@type'].endsWith('Event'))) {
                      result.detectedEvents.push({
                        title: String(jn.name).trim(),
                        start_time: jn.startDate ? jn.startDate.replace('T', ' ').slice(0, 19) : '',
                        end_time: jn.endDate ? jn.endDate.replace('T', ' ').slice(0, 19) : null,
                        category: 'Live Music',
                        venue_name: jn.location?.name || '',
                        address: typeof jn.location?.address === 'object' ? (jn.location.address.streetAddress || '') : (jn.location?.address || ''),
                        suburb: '',
                        age_restriction: '18+',
                        min_age: 18,
                        is_family_friendly: 0,
                        ticket_url: jn.url || iframeSrc,
                        image_url: jn.image || ''
                      });
                    }
                  }
                } catch(e) {}
              }
              if (result.detectedEvents.length > 0) {
                result.method = `Embedded Iframe (${new URL(iframeSrc).hostname})`;
                break;
              }
            }
          } catch(ife) {}
        }
      }
    }

    // STRATEGY 4: WordPress Tribe Events REST API (/wp-json/tribe/events/v1/events)
    if (result.detectedEvents.length === 0) {
      try {
        const origin = new URL(targetUrl).origin;
        const tribeUrl = `${origin}/wp-json/tribe/events/v1/events?per_page=20`;
        const tRes = await fetch(tribeUrl, {
          headers: { 'User-Agent': 'AgendaWeb-Bot/1.0 (+https://agendaweb.app)' }
        });
        if (tRes.ok) {
          const tData = await tRes.json();
          const tEvents = tData.events || [];
          for (const te of tEvents) {
            const vName = te.venue?.venue || te.venue?.name || '';
            const addr = te.venue?.address ? `${te.venue.address}, ${te.venue.city || ''} ${te.venue.state || ''} ${te.venue.zip || ''}`.trim() : '';
            if (vName && !result.detectedVenueName) result.detectedVenueName = vName;
            if (addr && !result.detectedAddress) result.detectedAddress = addr;

            result.detectedEvents.push({
              title: stripHtml(te.title || ''),
              start_time: te.start_date || '',
              end_time: te.end_date || null,
              category: te.categories?.[0]?.name || 'Live Music',
              venue_name: vName || result.detectedVenueName,
              address: addr || result.detectedAddress,
              suburb: te.venue?.city || '',
              age_restriction: '18+',
              min_age: 18,
              is_family_friendly: 0,
              ticket_url: te.url || targetUrl,
              image_url: te.image?.url || ''
            });
          }
          if (result.detectedEvents.length > 0) {
            result.method = 'WordPress The Events Calendar API (Tribe)';
          }
        }
      } catch(te) {}
    }

    // STRATEGY 5: HTML Microdata (itemscope itemtype="http://schema.org/Event")
    if (result.detectedEvents.length === 0 && html.includes('itemtype="http://schema.org/Event"')) {
      const eventRegex = /<[^>]+itemtype=["']https?:\/\/schema\.org\/Event["'][^>]*>([\s\S]*?)(?:<\/[a-z]+>){2,}/gi;
      let em;
      while ((em = eventRegex.exec(html)) !== null) {
        const block = em[1];
        const nameM = block.match(/itemprop=["']name["'][^>]*>([^<]+)<\//i);
        const dateM = block.match(/itemprop=["']startDate["'][^>]*content=["']([^"']+)["']/i) || block.match(/datetime=["']([^"']+)["']/i);
        if (nameM) {
          result.detectedEvents.push({
            title: nameM[1].trim(),
            start_time: dateM ? dateM[1].replace('T', ' ').slice(0, 19) : '',
            end_time: null,
            category: 'Live Music',
            venue_name: result.detectedVenueName || '',
            address: result.detectedAddress || '',
            suburb: '',
            age_restriction: '18+',
            min_age: 18,
            is_family_friendly: 0,
            ticket_url: targetUrl,
            image_url: ''
          });
        }
      }
      if (result.detectedEvents.length > 0) {
        result.method = 'HTML Microdata';
      }
    }

  } catch(err) {
    result.error = err.message;
  }

  return result;
}

async function syncEventSource(source) {
  if (DELETED_SOURCE_URLS.has(source.url) || (source.feed_url && DELETED_SOURCE_URLS.has(source.feed_url))) {
    return 0;
  }
  try {
    const targetUrl = source.feed_url || source.url;
    const result = await discoverEventsFromUrl(targetUrl);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (result.error || result.detectedEvents.length === 0) {
      source.last_status = 'failed';
      source.last_error = result.error || 'No upcoming events found on target';
      source.last_polled_at = now;
      return 0;
    }

    let addedCount = 0;
    const venueSlug = source.slug || 'venue';

    for (const evt of result.detectedEvents) {
      const eventKey1 = evt.ticket_url;
      const eventKey2 = `${venueSlug}:::${(evt.title || '').toLowerCase()}`;
      if ((eventKey1 && DELETED_EVENT_KEYS.has(eventKey1)) || DELETED_EVENT_KEYS.has(eventKey2)) {
        continue;
      }

      const exists = MOCK_EVENTS.some(e => 
        (e.title.toLowerCase() === evt.title.toLowerCase() && e.start_time.slice(0, 10) === evt.start_time.slice(0, 10))
        || (e.ticket_url && evt.ticket_url && e.ticket_url === evt.ticket_url)
      );

      if (!exists) {
        const nextId = MOCK_EVENTS.length > 0 ? Math.max(...MOCK_EVENTS.map(e => e.id)) + 1 : 1;
        MOCK_EVENTS.push({
          id: nextId,
          source_id: source.id,
          city_id: 1,
          city_slug: "melbourne",
          city_name: "Melbourne",
          venue_slug: venueSlug,
          venue_name: evt.venue_name || source.name,
          title: evt.title,
          description: evt.description || `Live gig at ${evt.venue_name || source.name}`,
          category: evt.category || "Live Music",
          age_restriction: evt.age_restriction || "18+",
          min_age: evt.min_age !== undefined ? evt.min_age : 18,
          is_family_friendly: evt.is_family_friendly !== undefined ? evt.is_family_friendly : 0,
          start_time: evt.start_time,
          end_time: evt.end_time || null,
          address: evt.address || "Melbourne VIC",
          suburb: evt.suburb || "Melbourne",
          ticket_url: evt.ticket_url || source.url,
          image_url: evt.image_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=700&q=80",
          origin: "scraped",
          is_verified: 1,
          calendar_url: `calendar.php?id=${nextId}`
        });
        addedCount++;
      }
    }


    source.item_count = result.detectedEvents.length;
    source.last_status = 'updated';
    source.last_error = null;
    source.http_code = 200;
    source.last_polled_at = now;
    return result.detectedEvents.length;
  } catch (err) {
    source.last_status = 'failed';
    source.last_error = err.message || 'Scrape failure';
    source.last_polled_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return 0;
  }
}

async function syncAllActiveSources() {
  let success = 0;
  let failed = 0;
  let totalItems = 0;
  const logs = [];

  for (const source of MOCK_SOURCES) {
    if (source.is_active) {
      if (source.type === 'rss') {
        const count = await syncRssSource(source);
        if (source.last_status === 'failed') {
          failed++;
          logs.push(`[FAILED] ${source.name}: ${source.last_error}`);
        } else {
          success++;
          totalItems += count;
          logs.push(`[UPDATED] ${source.name}: ${count} live items`);
        }
      } else if (source.type === 'scrape_event' || source.type === 'api_event') {
        const count = await syncEventSource(source);
        if (source.last_status === 'failed') {
          failed++;
          logs.push(`[FAILED] ${source.name}: ${source.last_error}`);
        } else {
          success++;
          totalItems += count;
          logs.push(`[UPDATED] ${source.name}: ${count} live events`);
        }
      }
    }
  }

  return { success, failed, totalItems, logs };
}

const requestHandler = async (req, res) => {
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
    const citiesWithCount = MOCK_CITIES.map(c => ({
      ...c,
      event_count: MOCK_EVENTS.filter(e => e.city_slug === c.slug).length
    }));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'success',
      count: citiesWithCount.length,
      data: citiesWithCount
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

    // Filter by active sources and venues:
    // If a source was removed or toggled inactive in Admin, its events MUST NOT appear in the feed
    const activeSources = MOCK_SOURCES.filter(s => s.is_active);
    const activeSourceIds = new Set(activeSources.map(s => s.id));
    const activeSourceSlugs = new Set(activeSources.map(s => s.slug));
    const activeSourceNames = new Set(activeSources.map(s => (s.name || '').toLowerCase()));
    const activeVenueSlugs = new Set(MOCK_VENUES.filter(v => v.is_active !== 0).map(v => v.slug));

    let filtered = MOCK_EVENTS.filter(e => {
      if (e.source_id && !activeSourceIds.has(e.source_id)) return false;
      if (e.venue_slug && !activeSourceSlugs.has(e.venue_slug) && !activeVenueSlugs.has(e.venue_slug)) return false;
      if (!e.source_id && !e.venue_slug && e.venue_name && !activeSourceNames.has(e.venue_name.toLowerCase())) return false;
      return true;
    });

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

    const categories = ['All', ...new Set(filtered.map(e => e.category).filter(Boolean))];
    const citiesWithCount = MOCK_CITIES.map(c => ({
      ...c,
      event_count: filtered.filter(e => e.city_slug === c.slug).length
    }));

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'success',
      count: filtered.length,
      total: filtered.length,
      categories: categories,
      cities: citiesWithCount,
      venues: MOCK_VENUES.filter(v => v.is_active !== 0),
      data: filtered
    }));
    return;
  }

  // 2. API: Items Feed (News, Blogs)
  if (pathname === '/api/items.php') {
    const tab = parsedUrl.query.tab || 'news';
    const category = parsedUrl.query.category || 'all';

    // Only return items from active sources
    const activeSources = MOCK_SOURCES.filter(s => s.is_active);
    const activeSourceIds = new Set(activeSources.map(s => s.id));
    const activeSourceNames = new Set(activeSources.map(s => (s.name || '').toLowerCase()));

    const rawItems = (MOCK_ITEMS[tab] || []).filter(i => {
      if (i.source_id && !activeSourceIds.has(i.source_id)) return false;
      if (i.source_name && !activeSourceNames.has(i.source_name.toLowerCase())) return false;
      return true;
    });

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


  // 3. API: Personal Feed CORS Proxy (Live Remote Fetch)
  if (pathname === '/api/proxy_feed.php') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Valid URL required' }));
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const feedRes = await fetch(targetUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'AgendaWeb-Proxy/1.0 (+https://agendaweb.app)' }
      });
      clearTimeout(timeout);

      if (!feedRes.ok) {
        res.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `Unable to fetch remote feed (HTTP ${feedRes.status})` }));
        return;
      }

      const xml = await feedRes.text();
      const parsed = parseFeedXml(xml);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        feed_url: targetUrl,
        title: parsed.title,
        categories: ["All", ...new Set(parsed.items.map(i => i.category).filter(Boolean))],
        items: parsed.items
      }));
    } catch (err) {
      res.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: `Failed to fetch or parse feed: ${err.message}` }));
    }
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
    if (!event) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No upcoming events available for calendar export');
      return;
    }

    const startClean = event.start_time ? event.start_time.replace(/[- :]/g, '').slice(0, 15) : '20261024T090000';
    const dtStart = startClean.length === 8 ? `${startClean}T200000Z` : (startClean.includes('T') ? `${startClean}Z` : `${startClean.slice(0,8)}T${startClean.slice(8,14)}Z`);
    const dtEnd = event.end_time ? `${event.end_time.replace(/[- :]/g, '').slice(0, 15)}Z` : '';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AgendaWeb//agendaweb.app//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:agendaweb-${event.id}@agendaweb.app`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${dtStart}`,
      dtEnd ? `DTEND:${dtEnd}` : '',
      `SUMMARY:${event.title}`,
      `LOCATION:${event.venue_name || 'Melbourne'}, ${event.address || ''}`,
      `DESCRIPTION:${event.description || ''}`,
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

      try {
        const disc = await discoverEventsFromUrl(targetUrl);
        if (disc.error && disc.detectedEvents.length === 0 && !disc.discoveredFeed) {
          res.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: `Unable to inspect webpage: ${disc.error}` }));
          return;
        }

        let host = 'example.com';
        try { host = new URL(targetUrl).hostname; } catch(e) {}
        const isEventVenue = disc.detectedEvents.length > 0 || /gig|event|hotel|theatre|hall|club|bar/i.test(targetUrl);
        const defaultName = disc.detectedVenueName || (disc.pageTitle ? disc.pageTitle.split(/[-–|]/)[0].trim() : '') || host;
        const venueSlug = defaultName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          url: targetUrl,
          http_code: 200,
          page_title: disc.pageTitle || defaultName,
          detection_method: disc.method,
          detected_type: (disc.detectedEvents.length > 0 || (isEventVenue && !disc.discoveredFeed)) ? 'scrape_event' : 'rss',
          suggested_name: defaultName,
          suggested_tab: isEventVenue ? 'events' : 'blogs',
          feed_url: disc.discoveredFeed,
          events_count: disc.detectedEvents.length,
          venue: {
            slug: venueSlug,
            name: defaultName,
            address: disc.detectedAddress || disc.detectedEvents[0]?.address || 'Melbourne VIC',
            website_url: targetUrl,
            feed_url: disc.discoveredFeed
          },
          events: disc.detectedEvents
        }));
      } catch (err) {
        res.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: `Inspection error: ${err.message}` }));
      }
      return;
    }

    if (action === 'add_source' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
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
          last_status: 'active',
          http_code: 200,
          item_count: 0,
          last_error: null,
          last_polled_at: now
        };
        MOCK_SOURCES.push(newSource);

        // If RSS feed, immediately fetch real live dispatches
        if (newSource.type === 'rss') {
          await syncRssSource(newSource);
        }

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
          id: newSource.id,
          item_count: newSource.item_count
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
        const targetId = parseInt(payload.id, 10);
        const source = MOCK_SOURCES.find(s => s.id === targetId);
        if (source) {
          source.is_active = source.is_active ? 0 : 1;
          const v = MOCK_VENUES.find(v => v.source_id === targetId || v.slug === source.slug);
          if (v) v.is_active = source.is_active;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ 
          status: 'success', 
          message: source ? `Source "${source.name}" is now ${source.is_active ? 'active on feed' : 'paused/hidden from feed'}` : 'Status toggled',
          is_active: source ? source.is_active : 0
        }));
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
        const targetId = parseInt(payload.id, 10);
        const source = MOCK_SOURCES.find(s => s.id === targetId);

        if (source) {
          DELETED_SOURCE_URLS.add(source.url);
          if (source.feed_url) DELETED_SOURCE_URLS.add(source.feed_url);

          // 1. Remove all events belonging to this source / venue from the feed
          const eventsBefore = MOCK_EVENTS.length;
          MOCK_EVENTS = MOCK_EVENTS.filter(e => 
            e.source_id !== targetId &&
            e.venue_slug !== source.slug &&
            (e.venue_name || '').toLowerCase() !== (source.name || '').toLowerCase()
          );
          const eventsRemoved = eventsBefore - MOCK_EVENTS.length;

          // 2. Remove all news and blog items belonging to this source from the feed
          const newsBefore = MOCK_ITEMS.news.length;
          MOCK_ITEMS.news = MOCK_ITEMS.news.filter(i => 
            i.source_id !== targetId &&
            (i.source_name || '').toLowerCase() !== (source.name || '').toLowerCase()
          );
          const newsRemoved = newsBefore - MOCK_ITEMS.news.length;

          const blogsBefore = MOCK_ITEMS.blogs.length;
          MOCK_ITEMS.blogs = MOCK_ITEMS.blogs.filter(i => 
            i.source_id !== targetId &&
            (i.source_name || '').toLowerCase() !== (source.name || '').toLowerCase()
          );
          const blogsRemoved = blogsBefore - MOCK_ITEMS.blogs.length;

          // 3. Remove venue
          MOCK_VENUES = MOCK_VENUES.filter(v => v.source_id !== targetId && v.slug !== source.slug);

          // 4. Remove from sources
          MOCK_SOURCES = MOCK_SOURCES.filter(s => s.id !== targetId);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ 
            status: 'success', 
            message: `Source "${source.name}" and all associated items removed from feed (${eventsRemoved} gigs, ${newsRemoved + blogsRemoved} articles removed).`,
            events_removed: eventsRemoved,
            items_removed: newsRemoved + blogsRemoved
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'success', message: 'Source deleted' }));
      });
      return;
    }

    // Admin action: list published events
    if (action === 'events') {
      const city = parsedUrl.query.city || 'all';
      let filtered = MOCK_EVENTS;
      if (city !== 'all') {
        filtered = filtered.filter(e => e.city_slug === city);
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

    // Admin action: delete an individual event from the feed
    if (action === 'delete_event' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const eventId = parseInt(payload.id, 10);
        const ev = MOCK_EVENTS.find(e => e.id === eventId);
        if (ev) {
          if (ev.ticket_url) DELETED_EVENT_KEYS.add(ev.ticket_url);
          DELETED_EVENT_KEYS.add(`${ev.venue_slug}:::${ev.title.toLowerCase()}`);
          MOCK_EVENTS = MOCK_EVENTS.filter(e => e.id !== eventId);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ 
            status: 'success', 
            message: `Event "${ev.title}" removed from the live feed.` 
          }));
          return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: 'Event not found' }));
      });
      return;
    }

    // Admin action: list dispatches
    if (action === 'feed_items') {
      const tab = parsedUrl.query.tab || 'all';
      let allItems = [];
      if (tab === 'news') allItems = MOCK_ITEMS.news;
      else if (tab === 'blogs') allItems = MOCK_ITEMS.blogs;
      else allItems = [...MOCK_ITEMS.news, ...MOCK_ITEMS.blogs];
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        count: allItems.length,
        data: allItems
      }));
      return;
    }

    // Admin action: delete an individual dispatch
    if (action === 'delete_item' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const itemId = parseInt(payload.id, 10);
        const allItems = [...MOCK_ITEMS.news, ...MOCK_ITEMS.blogs];
        const item = allItems.find(i => i.id === itemId);
        if (item) {
          if (item.link) DELETED_ITEM_LINKS.add(item.link);
          MOCK_ITEMS.news = MOCK_ITEMS.news.filter(i => i.id !== itemId);
          MOCK_ITEMS.blogs = MOCK_ITEMS.blogs.filter(i => i.id !== itemId);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ 
            status: 'success', 
            message: `Dispatch "${item.title}" removed from the live feed.` 
          }));
          return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: 'Dispatch not found' }));
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
      req.on('end', async () => {
        let payload = {};
        try { payload = JSON.parse(body); } catch (e) {}
        const source = MOCK_SOURCES.find(s => s.id === payload.id);
        if (!source) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: 'Source not found' }));
          return;
        }

        const count = (source.type === 'scrape_event' || source.type === 'api_event')
          ? await syncEventSource(source)
          : await syncRssSource(source);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'success',
          source_id: source.id,
          name: source.name,
          last_status: source.last_status,
          item_count: count,
          last_error: source.last_error,
          last_polled_at: source.last_polled_at
        }));
      });
      return;
    }

    if (action === 'sync_now' && req.method === 'POST') {
      const report = await syncAllActiveSources();
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        message: 'Sync worker executed successfully',
        report: {
          total: MOCK_SOURCES.filter(s => s.is_active).length,
          success: report.success,
          failed: report.failed,
          timestamp: now
        },
        log: `[${now}] Live ingestion scan complete across active sources:\n${report.logs.join('\n')}`
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

// Perform initial live RSS feed fetch in background so local development immediately has fresh real dispatches
syncAllActiveSources().then(res => {
  console.log(`[sync] Initial RSS live sync complete: ${res.success} feeds updated (${res.totalItems} real articles loaded).`);
}).catch(e => {
  console.warn('[sync] Initial RSS live sync background error:', e.message);
});
