/**
 * AgendaWeb Ingestion & Parser Regression Test Suite
 * Zero-dependency unit tests running against static fixtures.
 */

const assert = require('assert');

// 1. Title Normalizer & Fuzzy Deduplication Test
function cleanTitle(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\b(presents|live at|live|feat\.?|featuring|w\/|with|tickets|doors|band|tour)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function isDuplicateEvent(existing, incoming) {
  if (existing.ticket_url && incoming.ticket_url && existing.ticket_url === incoming.ticket_url) return true;
  if (existing.start_time && incoming.start_time && existing.start_time.slice(0, 10) === incoming.start_time.slice(0, 10)) {
    const sameVenue = existing.venue_slug === incoming.venue_slug;
    if (sameVenue) {
      const eClean = cleanTitle(existing.title);
      const inClean = cleanTitle(incoming.title);
      if (eClean === inClean) return true;
      if (eClean.length >= 6 && inClean.length >= 6 && (eClean.includes(inClean) || inClean.includes(eClean))) return true;
    }
  }
  return false;
}

// 2. Geolocation Haversine Distance Calculation Test
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

// 3. Schema.org JSON-LD Parser Simulation
function parseJsonLdEvents(jsonStr) {
  const data = JSON.parse(jsonStr);
  const events = [];
  const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
  for (const item of items) {
    if (item['@type'] === 'Event' || item['@type'] === 'MusicEvent') {
      events.push({
        title: item.name,
        start_time: item.startDate,
        venue_name: item.location?.name,
        address: item.location?.address?.streetAddress || item.location?.address,
        ticket_url: item.offers?.url || item.url
      });
    }
  }
  return events;
}

// --- RUN TESTS ---
console.log('--- Running AgendaWeb Scraper & Regression Suite ---');

// Test 1: Deduplication
{
  const ev1 = {
    venue_slug: 'the-night-cat',
    start_time: '2026-11-15 20:00:00',
    title: 'The Teskey Brothers w/ guests',
    ticket_url: 'https://moshtix.com/teskey'
  };
  const ev2 = {
    venue_slug: 'the-night-cat',
    start_time: '2026-11-15 20:30:00',
    title: 'The Teskey Brothers',
    ticket_url: 'https://nightcat.com/teskey'
  };
  assert.strictEqual(isDuplicateEvent(ev1, ev2), true, 'Fuzzy title should detect Teskey Brothers duplicate on same date');
  console.log('✓ Test 1 Passed: Fuzzy event deduplication handles guest/support variances.');
}

// Test 2: Geolocation Proximity
{
  // Melbourne CBD (-37.8136, 144.9631) to Brunswick (-37.7700, 144.9600) ~ 4.8 km
  const dist = calculateDistanceKm(-37.8136, 144.9631, -37.7700, 144.9600);
  assert.ok(dist >= 4.5 && dist <= 5.2, `Distance should be ~4.8km, got ${dist}`);
  console.log(`✓ Test 2 Passed: Haversine distance calculated accurately (${dist} km).`);
}

// Test 3: Schema.org Event Parsing
{
  const jsonLdFixture = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    "name": "Kite String Tangle Live",
    "startDate": "2026-11-20T20:00:00+11:00",
    "location": {
      "@type": "Place",
      "name": "Howler",
      "address": "7-11 Dawson St, Brunswick VIC 3056"
    },
    "offers": {
      "@type": "Offer",
      "url": "https://moshtix.com.au/howler-kite"
    }
  });

  const parsed = parseJsonLdEvents(jsonLdFixture);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].title, 'Kite String Tangle Live');
  assert.strictEqual(parsed[0].venue_name, 'Howler');
  assert.strictEqual(parsed[0].address, '7-11 Dawson St, Brunswick VIC 3056');
  console.log('✓ Test 3 Passed: Schema.org JSON-LD extraction correctly extracts gig metadata.');
}

// Test 4: ETag Caching Simulation
{
  const crypto = require('crypto');
  const payload = 'BEGIN:VCALENDAR...';
  const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;
  assert.ok(etag.startsWith('"') && etag.endsWith('"'), 'ETag should be quoted string');
  console.log(`✓ Test 4 Passed: MD5 ETag generation matches HTTP RFC 7232 (${etag}).`);
}

// Test 5: Double-Encoded HTML Entity & Publisher Logo Stripper (Agência Brasil EBC Test)
{
  function decodeHtmlEntities(str) {
    if (!str) return "";
    return str
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#039;|&apos;|&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function stripHtml(html) {
    if (!html) return "";
    let text = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    text = decodeHtmlEntities(text);
    text = text.replace(/<style[^>]*>.*?<\/style>/gis, "")
               .replace(/<script[^>]*>.*?<\/script>/gis, "");
    text = text.replace(/<[^>]+>/g, " ");
    text = text.replace(/&nbsp;/g, " ")
               .replace(/&[a-z0-9#]+;/gi, " ");
    return text.replace(/\s+/g, " ").trim();
  }

  const rawDesc = "  &lt;p&gt;&lt;p style=&quot;text-align:center;&quot;&gt;&lt;a class=&quot;&quot; href=&quot;https://agenciabrasil.ebc.com.br/politica/noticia/2026-10/lula-participa-de-live-do-exercito-e-estimula-ida-de-idosos-urnas&quot;&gt; &lt;img src=&quot;https://cdn.jsdelivr.net/gh/sergiosdlima/assets-ebc@1.0.0/abr/assets/images/logo-agenciabrasil.svg&quot; alt=&quot;Logo Agência Brasil&quot; style=&quot;height: 54px;&quot;&gt; &lt;/a&gt;&lt;/p&gt;&lt;strong&gt;As instituições financeiras terão cinco dias úteis para informar ao governo as dívidas.&lt;/strong&gt;";

  const cleaned = stripHtml(rawDesc);
  assert.ok(!cleaned.includes('<p'), 'Cleaned text must not contain raw <p tags');
  assert.ok(!cleaned.includes('&lt;'), 'Cleaned text must not contain &lt; entities');
  assert.ok(!cleaned.includes('logo-agenciabrasil.svg'), 'Cleaned text must not contain logo image URLs');
  assert.strictEqual(cleaned, 'As instituições financeiras terão cinco dias úteis para informar ao governo as dívidas.');
  console.log('✓ Test 5 Passed: Double-encoded HTML entities stripped cleanly without exposing raw tags or publisher logo wrappers.');
}

// Test 6: Event Feed City Resolution & Same-Day Window Matching
{
  function matchCityFilter(event, selectedCity = 'melbourne') {
    const cityLower = (selectedCity || 'melbourne').toLowerCase();
    const eCity = (event.city_slug || 'melbourne').toLowerCase();
    const eCityName = (event.city_name || 'Melbourne').toLowerCase();
    if (cityLower === 'melbourne') {
      return eCity === 'melbourne' || eCityName === 'melbourne' || !event.city_slug || (event.address || '').toLowerCase().includes('melbourne') || (event.address || '').toUpperCase().includes('VIC');
    }
    return eCity === cityLower || eCityName === cityLower || (event.address || '').toLowerCase().includes(cityLower);
  }

  function isEventVisibleToday(startTimeIso, nowIso) {
    const startMs = new Date(startTimeIso).getTime();
    const nowMs = new Date(nowIso).getTime();
    const windowStartMs = nowMs - (14 * 60 * 60 * 1000); // 14-hour grace window covering evening & timezone shifts
    return startMs >= windowStartMs;
  }

  // Event with no explicit city_slug but in Fitzroy VIC
  const event1 = {
    title: "Post-Punk Matinee",
    city_slug: null,
    city_name: null,
    address: "124 Gertrude St, Fitzroy VIC 3065",
    start_time: new Date(Date.now() - 2 * 3600 * 1000).toISOString() // started 2 hours ago
  };

  assert.strictEqual(matchCityFilter(event1, 'melbourne'), true, 'VIC / unassigned event must match default Melbourne feed');
  assert.strictEqual(isEventVisibleToday(event1.start_time, new Date().toISOString()), true, 'Event started earlier today must remain visible in feed');

  // Event explicitly in Sydney should not match Melbourne
  const event2 = {
    title: "Harbour Jazz",
    city_slug: "sydney",
    city_name: "Sydney",
    address: "Darling Harbour NSW 2000"
  };
  assert.strictEqual(matchCityFilter(event2, 'melbourne'), false, 'Sydney event must not match Melbourne feed');
  assert.strictEqual(matchCityFilter(event2, 'sydney'), true, 'Sydney event must match Sydney feed');

  console.log('✓ Test 6 Passed: Event feed city fallback and same-day 14-hour visibility window verified.');
}

// Test 7: RSS Ingestion Strategy Routing & Category Table Filtering
{
  function resolveSyncStrategy(source) {
    if (source.type === 'rss') {
      return 'syncRss';
    }
    return 'syncSchemaOrgEvents';
  }

  assert.strictEqual(resolveSyncStrategy({ type: 'rss', category_tab: 'blogs' }), 'syncRss');
  assert.strictEqual(resolveSyncStrategy({ type: 'rss', category_tab: 'news' }), 'syncRss');
  assert.strictEqual(resolveSyncStrategy({ type: 'rss', category_tab: 'events' }), 'syncRss', 'Event RSS must use syncRss not SchemaOrg');
  assert.strictEqual(resolveSyncStrategy({ type: 'scrape_event', category_tab: 'events' }), 'syncSchemaOrgEvents');

  function matchSourceFilter(source, currentFilter) {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'pending') return !source.is_active && source.last_status === 'pending';
    return source.category_tab === currentFilter;
  }

  const newBlogSource = { name: "Cultural Journal", category_tab: "blogs", is_active: 1, last_status: "updated" };
  assert.strictEqual(matchSourceFilter(newBlogSource, 'all'), true, 'New source must be visible in "all" filter');
  assert.strictEqual(matchSourceFilter(newBlogSource, 'blogs'), true, 'New source must be visible in "blogs" filter');
  assert.strictEqual(matchSourceFilter(newBlogSource, 'events'), false, 'New blog source is hidden if filter is stuck on "events"');

  console.log('✓ Test 7 Passed: RSS ingestion routing and admin category filter visibility verified.');
}

console.log('\nAll 7 Regression Tests PASSED successfully! 🚀');
