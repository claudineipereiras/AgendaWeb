/**
 * AgendaWeb Main Application Controller
 * Local-first Broadsheet & Cultural Feed
 */

let currentTab = 'events';
let currentCategory = 'All';
let channelSettings = {
  show_news: false,
  show_blogs: false
};

// Fallback seed events with image support for offline / local static preview
const FALLBACK_EVENTS = [
  {
    id: 1,
    title: "The Echoes — Album Launch",
    venue_name: "The Gasometer Hotel",
    address: "484 Smith St, Collingwood VIC",
    category: "Live Music",
    start_time: "2026-10-24 20:00:00",
    description: "Indie rock outfit celebrating their debut LP release with special guests.",
    ticket_url: "https://oztix.com.au",
    image_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=700&q=80",
    calendar_url: "calendar.php?id=1"
  },
  {
    id: 2,
    title: "Contemporary Printmaking Biennial",
    venue_name: "Fitzroy Community Arts",
    address: "128 Gertrude St, Fitzroy VIC",
    category: "Art",
    start_time: "2026-10-25 10:00:00",
    description: "Showcasing emerging Australian printmakers, risograph posters, and zines.",
    ticket_url: "",
    image_url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=700&q=80",
    calendar_url: "calendar.php?id=2"
  },
  {
    id: 3,
    title: "Sunset Soundscapes: Ambient & Synth Showcase",
    venue_name: "The Corner Hotel",
    address: "57 Swan St, Richmond VIC",
    category: "Live Music",
    start_time: "2026-10-26 19:30:00",
    description: "An evening of analog synthesizers and ambient soundscapes featuring local producers.",
    ticket_url: "https://thecornerhotel.com",
    image_url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=700&q=80",
    calendar_url: "calendar.php?id=3"
  }
];

const FALLBACK_ITEMS = {
  news: [
    {
      id: 101,
      source_name: "ABC News",
      category: "Regional Arts",
      title: "Grassroots Music Venues Receive New State Infrastructure Funding",
      summary: "Victoria’s live music and indie venues receive dedicated grants to preserve historic neighborhood stages.",
      link: "https://www.abc.net.au/news",
      image_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=700&q=80",
      published_at: "2026-10-18 08:30:00"
    },
    {
      id: 102,
      source_name: "SBS News",
      category: "Community",
      title: "Multicultural Arts Festivals Expanded Across Regional Hubs",
      summary: "New community initiatives bring multicultural storytelling and food traditions to regional towns.",
      link: "https://www.sbs.com.au/news",
      image_url: "",
      published_at: "2026-10-18 07:15:00"
    }
  ],
  blogs: [
    {
      id: 201,
      source_name: "Trouble Magazine",
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
      category: "Essays",
      title: "Why Australia's Cultural Infrastructure Needs Decentralized Open Data",
      summary: "Public arts policy is shifting towards community-anchored hubs, open syndication, and digital sovereignty.",
      link: "https://theconversation.com/au",
      image_url: "",
      published_at: "2026-10-17 11:30:00"
    }
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  // Load Channel Preferences (Default: Clean mode = News & Blogs OFF)
  channelSettings = await window.agendaDB.getSetting('channel_settings', {
    show_news: false,
    show_blogs: false
  });
  applyChannelVisibility();

  // Load Personal Feeds count and Followed Lineup count
  await refreshPersonalFeedsUI();
  await refreshFollowedUI();

  // Initialize Storage Retention & Metrics
  await initRetentionSettings();

  // Initialize City Hub & Audience Filter
  await initCityAndAudienceUI();

  // Render initial tab
  await setTab('events');

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.log('ServiceWorker registration skipped:', err);
    });
  }
});

// Circle Check Mark Helpers (Mark as Read / Checked)
function renderCheckCircleSvg(isRead) {
  if (isRead) {
    return `
      <svg class="check-icon is-checked" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    `;
  }
  return `
    <svg class="check-icon is-unchecked" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="9 12 11.5 14.5 15.5 9.5" stroke-opacity="0.35"/>
    </svg>
  `;
}

async function toggleCardCheck(cardKey, event, btnElement) {
  if (event) event.stopPropagation();
  const isNowRead = await window.agendaDB.toggleCardRead(cardKey);
  const cardElement = btnElement ? btnElement.closest('.card') : document.querySelector(`[data-card-id="${cardKey}"]`);
  if (cardElement) {
    cardElement.classList.toggle('is-read', isNowRead);
  }
  if (btnElement) {
    btnElement.classList.toggle('is-read', isNowRead);
    btnElement.innerHTML = renderCheckCircleSvg(isNowRead);
    btnElement.title = isNowRead ? 'Mark as unread' : 'Mark as read';
  }
}

async function handleCardOpen(cardKey) {
  await window.agendaDB.markCardRead(cardKey, true);
  const cardElement = document.querySelector(`[data-card-id="${cardKey}"]`);
  if (cardElement) {
    cardElement.classList.add('is-read');
    const checkBtn = cardElement.querySelector('.card-check-btn');
    if (checkBtn) {
      checkBtn.classList.add('is-read');
      checkBtn.innerHTML = renderCheckCircleSvg(true);
      checkBtn.title = 'Mark as unread';
    }
  }
}

// Follow Venue / Artist / Organiser Handler (with RSS icon)
async function toggleFollow(entityName, type = 'venue', btnElement) {
  const isNowFollowed = await window.agendaDB.toggleFollowEntity(entityName, type);
  if (btnElement) {
    btnElement.classList.toggle('is-following', isNowFollowed);
    btnElement.title = isNowFollowed ? `Unfollow ${entityName}` : `Follow ${entityName}`;
    const span = btnElement.querySelector('span');
    if (span) span.textContent = isNowFollowed ? 'Following' : 'Follow';
  }
  await refreshFollowedUI();
  if (currentTab === 'following') {
    await renderFollowing(false);
  }
}

async function refreshFollowedUI() {
  const followed = await window.agendaDB.getFollowedEntities();
  const badge = document.getElementById('followed-count-badge');
  if (badge) {
    badge.textContent = `${followed.length} Followed`;
  }

  const listContainer = document.getElementById('followed-entities-list');
  if (listContainer) {
    if (followed.length === 0) {
      listContainer.innerHTML = '<p style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic;">No venues or artists followed yet. Tap the Follow button on any event card.</p>';
    } else {
      listContainer.innerHTML = followed.map(f => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid var(--color-oat); font-size:0.8rem;">
          <div>
            <strong>${escapeHtml(f.name)}</strong>
            <span style="font-size:0.7rem; color:var(--color-sage-green); margin-left:6px;">${escapeHtml(f.type || 'venue')}</span>
          </div>
          <button class="icon-btn" style="color:var(--color-amber-rust);" onclick="unfollowFromSettings('${escapeQuote(f.name)}')">✕</button>
        </div>
      `).join('');
    }
  }
}

async function unfollowFromSettings(name) {
  await window.agendaDB.toggleFollowEntity(name);
  await refreshFollowedUI();
  if (currentTab === 'following') {
    await renderFollowing();
  } else if (currentTab === 'events') {
    await renderEvents(false);
  }
}

// Tab Switcher
async function setTab(tabName) {
  currentTab = tabName;
  currentCategory = 'All';

  document.querySelectorAll('.tab-btn, .m3-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  await renderCurrentTab();
}

async function initCityAndAudienceUI() {
  const savedCity = await window.agendaDB.getSelectedCity();
  const cities = await window.agendaAPI.getCities();
  const matched = cities.find(c => c.slug === savedCity);
  const cityLabel = document.getElementById('current-city-label');
  if (cityLabel) cityLabel.textContent = matched ? matched.name : (savedCity === 'all' ? 'All Australia' : 'Melbourne');

  const savedAudience = await window.agendaDB.getAudienceFilter();
  document.querySelectorAll('.audience-btn, .m3-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.audience === savedAudience);
  });
}

// City Hub Modal & Switcher
async function openCityModal() {
  toggleCityModal();
  const grid = document.getElementById('city-grid-list');
  if (!grid) return;

  grid.innerHTML = '<div style="padding:10px; color:var(--color-text-muted);">Loading Australian cities...</div>';
  const cities = await window.agendaAPI.getCities();
  const currentCity = await window.agendaDB.getSelectedCity();

  grid.innerHTML = cities.map(c => `
    <div class="city-card ${c.slug === currentCity ? 'selected' : ''}" onclick="selectCity('${c.slug}', '${escapeQuote(c.name)}')">
      <div class="city-card-header">
        <span class="city-card-name">${escapeHtml(c.name)}</span>
        <span class="city-card-state">${escapeHtml(c.state)}</span>
      </div>
      <div class="city-card-count">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="vertical-align:-1px; margin-right:3px;">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        ${c.event_count || 'Active'} cultural events
      </div>
    </div>
  `).join('');
}

function toggleCityModal() {
  const modal = document.getElementById('city-modal');
  if (modal) modal.classList.toggle('active');
}

async function selectCity(citySlug, cityName) {
  await window.agendaDB.setSelectedCity(citySlug);
  const label = document.getElementById('current-city-label');
  if (label) label.textContent = cityName;
  toggleCityModal();

  if (currentTab === 'events') {
    await renderEvents(true);
  } else if (currentTab === 'following') {
    await renderFollowing(true);
  }
}

// Audience Filtering (All, 18+, All Ages, Kids & Family)
async function setAudienceFilter(audience, btnElement) {
  await window.agendaDB.setAudienceFilter(audience);
  document.querySelectorAll('.audience-btn, .m3-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.audience === audience);
  });
  if (currentTab === 'events') {
    await renderEvents(false);
  }
}

async function renderCurrentTab() {
  const container = document.getElementById('feed');
  container.innerHTML = '<div class="state-message">Loading cultural feed...</div>';

  const audienceBar = document.getElementById('audience-filter-bar');
  if (audienceBar) {
    audienceBar.style.display = (currentTab === 'events') ? 'flex' : 'none';
  }

  if (currentTab === 'events') {
    await renderEvents();
  } else if (currentTab === 'following') {
    await renderFollowing();
  } else if (currentTab === 'reads') {
    hideSubFilter();
    await renderReads();
  } else if (currentTab === 'personal') {
    await renderPersonalFeeds();
  } else {
    await renderItems(currentTab);
  }

  const searchInput = document.getElementById('feed-search');
  if (searchInput && searchInput.value) {
    handleFeedSearch(searchInput.value);
  }
}

// Subcategory Filter Rendering (Dynamic Auto-Grouping)
function renderSubFilterPills(categories) {
  const subFilter = document.getElementById('sub-filter');
  if (!subFilter) return;

  if (!categories || categories.length <= 1) {
    subFilter.style.display = 'none';
    return;
  }

  subFilter.style.display = 'flex';
  subFilter.innerHTML = categories.map(cat => `
    <button class="filter-pill ${cat === currentCategory ? 'active' : ''}" 
            onclick="setFilter('${escapeQuote(cat)}', this)">
      ${escapeHtml(cat)}
    </button>
  `).join('');
}

function hideSubFilter() {
  const subFilter = document.getElementById('sub-filter');
  if (subFilter) subFilter.style.display = 'none';
}

async function setFilter(category, btnElement) {
  currentCategory = category;
  document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  if (currentTab === 'events') {
    await renderEvents(false);
  } else if (currentTab === 'following') {
    await renderFollowing(false);
  } else if (currentTab === 'personal') {
    await renderPersonalFeeds(false);
  } else {
    await renderItems(currentTab, false);
  }
}

// Render Events Tab
async function renderEvents(refreshPills = true) {
  const container = document.getElementById('feed');
  const selectedCity = await window.agendaDB.getSelectedCity();
  const audience = await window.agendaDB.getAudienceFilter();

  const res = await window.agendaAPI.getEvents(currentCategory, 'all', selectedCity, audience);
  if (res.venues && res.venues.length > 0) {
    window.agendaVenues = res.venues;
  }
  let events = res.data;

  if (!events || events.length === 0) {
    events = (currentCategory === 'All')
      ? FALLBACK_EVENTS
      : FALLBACK_EVENTS.filter(e => e.category === currentCategory);
  }

  if (refreshPills) {
    const categories = res.categories && res.categories.length > 1
      ? res.categories
      : ['All', 'Live Music', 'Art', 'Community'];
    renderSubFilterPills(categories);
  }

  if (events.length === 0) {
    container.innerHTML = '<div class="state-message">No upcoming events found for this filter.</div>';
    return;
  }

  const html = await Promise.all(events.map(async (ev) => {
    const isStarred = await window.agendaDB.isEventStarred(ev.id);
    const isRead = await window.agendaDB.isCardRead(ev.id);
    const isFollowed = await window.agendaDB.isEntityFollowed(ev.venue_name);
    const dateStr = formatDate(ev.start_time);
    const starBtnClass = isStarred ? 'btn-secondary starred' : 'btn-secondary';
    const starBtnText = isStarred ? '★ Saved' : '★ Save';

    // Age restriction badge with Material Symbols vector icons
    let ageBadgeHtml = '';
    if (ev.age_restriction === '18+') {
      ageBadgeHtml = '<span class="badge-age badge-age-18"><svg class="badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12.3 2a10 10 0 0 0-1.9 19.8 10 10 0 0 0 11.5-11.5c-.2 0-.4.1-.6.1a10 10 0 0 1-9-8.4z"/></svg> 18+ Nightlife</span>';
    } else if (ev.age_restriction === 'all_ages') {
      ageBadgeHtml = '<span class="badge-age badge-age-aa"><svg class="badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/></svg> All Ages</span>';
    } else if (ev.age_restriction === 'kids_family' || ev.is_family_friendly) {
      ageBadgeHtml = '<span class="badge-age badge-age-kids"><svg class="badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="9" cy="4" r="2"/><path d="M9 7c-1.66 0-3 1.34-3 3v4h2v7h2v-7h2v-4c0-1.66-1.34-3-3-3z"/><circle cx="16" cy="9" r="1.5"/><path d="M16 11.5c-1.1 0-2 .9-2 2v2.5h1.2v5h1.6v-5H18v-2.5c0-1.1-.9-2-2-2z"/></svg> Kids & Family</span>';
    }

    // Suburb / City badge
    const suburbName = ev.suburb || (ev.city_name ? ev.city_name : '');
    const suburbBadgeHtml = suburbName ? `<span class="badge-suburb"><svg class="badge-icon" viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> ${escapeHtml(suburbName)}</span>` : '';

    return `
      <article class="card ${isRead ? 'is-read' : ''}" data-card-id="${ev.id}">
        ${ev.image_url ? `
          <div class="card-image-wrapper">
            <img src="${ev.image_url}" class="card-image" alt="${escapeHtml(ev.title)}" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>` : ''}
        <div class="card-meta">
          <div class="card-meta-left">
            <span>${dateStr}</span>
            <span class="card-meta-source">${escapeHtml(ev.category || 'Culture')}</span>
            ${suburbBadgeHtml}
            ${ageBadgeHtml}
          </div>
          <button class="card-check-btn ${isRead ? 'is-read' : ''}" 
                  onclick="toggleCardCheck('${ev.id}', event, this)" 
                  title="${isRead ? 'Mark as unread' : 'Mark as read'}">
            ${renderCheckCircleSvg(isRead)}
          </button>
        </div>
        <h2 class="card-title">
          <a href="#" onclick="openEventReaderModal(${JSON.stringify(ev).replace(/"/g, '&quot;')}); return false;">${escapeHtml(ev.title)}</a>
        </h2>
        <div class="card-location">
          <svg class="loc-pin" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:-2px; margin-right:3px; color:var(--color-racing-green);">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          ${escapeHtml(ev.venue_name)} · ${escapeHtml(ev.address || ev.suburb || '')}
        </div>
        ${ev.description ? `<p class="card-summary">${escapeHtml(ev.description)}</p>` : ''}
        <div class="card-actions">
          <div class="card-actions-left">
            <button class="btn btn-primary" onclick="openEventReaderModal(${JSON.stringify(ev).replace(/"/g, '&quot;')})">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <span>Read in Full</span>
            </button>
            <a href="calendar.php?id=${ev.id}" class="btn btn-outline" target="_blank" onclick="handleCardOpen('${ev.id}')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>Calendar</span>
            </a>
            <button class="btn ${starBtnClass}" onclick="toggleStar(${JSON.stringify(ev).replace(/"/g, '&quot;')}, this)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              <span>${starBtnText}</span>
            </button>
            ${ev.ticket_url ? `<a href="${ev.ticket_url}" class="btn btn-outline" target="_blank" rel="noopener" onclick="handleCardOpen('${ev.id}')">Tickets</a>` : ''}
          </div>
          <div class="card-actions-right">
            <button class="btn btn-follow ${isFollowed ? 'is-following' : ''}" 
                    onclick="toggleFollow('${escapeQuote(ev.venue_name)}', 'venue', this)" 
                    title="${isFollowed ? 'Unfollow ' + escapeHtml(ev.venue_name) : 'Follow ' + escapeHtml(ev.venue_name)}">
              <svg class="rss-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <circle cx="6.18" cy="17.82" r="2.18"/>
                <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z"/>
              </svg>
              <span>${isFollowed ? 'Following' : 'Follow'}</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }));

  container.innerHTML = html.join('');
}

// Render Following Tab (Grouped by Followed Venue / Organizer)
async function renderFollowing(refreshPills = true) {
  const container = document.getElementById('feed');
  const followedList = await window.agendaDB.getFollowedEntities();

  if (followedList.length === 0) {
    hideSubFilter();
    container.innerHTML = `
      <div class="state-message">
        <h3 style="font-size:1.05rem; margin-bottom:8px; color:var(--color-nightfall);">Your Following Lineup is Empty</h3>
        <p style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:14px; max-width:440px; margin-left:auto; margin-right:auto;">
          Follow your favorite venues, artists, and independent organisers by tapping the <strong>Follow [RSS]</strong> button on any gig card.
        </p>
        <button class="btn btn-primary" onclick="setTab('events')">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span>Browse All Events</span>
        </button>
      </div>
    `;
    return;
  }

  // Fetch all events
  const res = await window.agendaAPI.getEvents('All');
  if (res.venues && res.venues.length > 0) {
    window.agendaVenues = res.venues;
  }
  let events = res.data;
  if (!events || events.length === 0) {
    events = FALLBACK_EVENTS;
  }

  // Sub-filter pills: 'All Followed' + distinct followed venue names
  const venueOptions = ['All Followed', ...followedList.map(f => f.name)];
  if (refreshPills) {
    renderSubFilterPills(venueOptions);
  }

  // Header showing followed chips count
  let headerHtml = `
    <div class="following-header">
      <span class="following-header-label">Following (${followedList.length} Venues):</span>
      ${followedList.map(f => `
        <span class="following-chip">
          📍 ${escapeHtml(f.name)}
          <button class="following-chip-remove" onclick="unfollowFromSettings('${escapeQuote(f.name)}')">✕</button>
        </span>
      `).join('')}
    </div>
  `;

  // Determine which venues to show based on subfilter pill
  let activeVenues = followedList;
  if (currentCategory !== 'All' && currentCategory !== 'All Followed') {
    activeVenues = followedList.filter(f => f.name.toLowerCase() === currentCategory.toLowerCase());
  }

  // Group events by venue
  const groupsHtml = await Promise.all(activeVenues.map(async (f) => {
    const venueName = f.name;
    const venueEvents = events.filter(e => (e.venue_name || '').toLowerCase() === venueName.toLowerCase());

    // Lookup venue metadata
    const venueMeta = (window.agendaVenues || []).find(v => v.name.toLowerCase() === venueName.toLowerCase());
    const address = (venueMeta && venueMeta.address) ? venueMeta.address : (venueEvents[0]?.address || '');
    const hasFeed = (venueMeta && venueMeta.feed_url) || venueEvents.some(e => e.origin === 'scraped');

    let cardsHtml = '';
    if (venueEvents.length === 0) {
      cardsHtml = `<div class="venue-empty-notice">No upcoming gigs currently announced for this venue. Monitoring website feed for new dates.</div>`;
    } else {
      const renderedCards = await Promise.all(venueEvents.map(async (ev) => {
        const isStarred = await window.agendaDB.isEventStarred(ev.id);
        const isRead = await window.agendaDB.isCardRead(ev.id);
        const dateStr = formatDate(ev.start_time);
        const starBtnClass = isStarred ? 'btn-secondary starred' : 'btn-secondary';
        const starBtnText = isStarred ? '★ Saved' : '★ Save';

        return `
          <article class="card ${isRead ? 'is-read' : ''}" data-card-id="${ev.id}">
            ${ev.image_url ? `
              <div class="card-image-wrapper">
                <img src="${ev.image_url}" class="card-image" alt="${escapeHtml(ev.title)}" loading="lazy" onerror="this.parentElement.style.display='none'">
              </div>` : ''}
            <div class="card-meta">
              <div class="card-meta-left">
                <span>${dateStr}</span>
                <span class="card-meta-source">${escapeHtml(ev.category || 'Culture')}</span>
              </div>
              <button class="card-check-btn ${isRead ? 'is-read' : ''}" 
                      onclick="toggleCardCheck('${ev.id}', event, this)" 
                      title="${isRead ? 'Mark as unread' : 'Mark as read'}">
                ${renderCheckCircleSvg(isRead)}
              </button>
            </div>
            <h2 class="card-title">
              <a href="#" onclick="openEventReaderModal(${JSON.stringify(ev).replace(/"/g, '&quot;')}); return false;">${escapeHtml(ev.title)}</a>
            </h2>
            <div class="card-location">📍 ${escapeHtml(ev.venue_name)} · ${escapeHtml(ev.address || '')}</div>
            ${ev.description ? `<p class="card-summary">${escapeHtml(ev.description)}</p>` : ''}
            <div class="card-actions">
              <div class="card-actions-left">
                <button class="btn btn-primary" onclick="openEventReaderModal(${JSON.stringify(ev).replace(/"/g, '&quot;')})">📖 Read in Full</button>
                <a href="calendar.php?id=${ev.id}" class="btn btn-outline" target="_blank" onclick="handleCardOpen('${ev.id}')">📅 Add to Calendar</a>
                <button class="btn ${starBtnClass}" onclick="toggleStar(${JSON.stringify(ev).replace(/"/g, '&quot;')}, this)">
                  ${starBtnText}
                </button>
                ${ev.ticket_url ? `<a href="${ev.ticket_url}" class="btn btn-outline" target="_blank" rel="noopener" onclick="handleCardOpen('${ev.id}')">Tickets</a>` : ''}
              </div>
            </div>
          </article>
        `;
      }));
      cardsHtml = renderedCards.join('');
    }

    return `
      <section class="venue-group">
        <div class="venue-group-header">
          <div class="venue-group-title-wrap">
            <h3 class="venue-group-title">📍 ${escapeHtml(venueName)}</h3>
            ${address ? `<span class="venue-group-address">${escapeHtml(address)}</span>` : ''}
          </div>
          <div class="venue-group-meta">
            <span class="venue-group-count">${venueEvents.length} upcoming gig${venueEvents.length === 1 ? '' : 's'}</span>
            ${hasFeed ? `<span class="badge-rss-pill" title="Live syndication active">📡 Live RSS</span>` : ''}
            <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="unfollowFromSettings('${escapeQuote(venueName)}')">Unfollow</button>
          </div>
        </div>
        <div class="venue-group-cards">
          ${cardsHtml}
        </div>
      </section>
    `;
  }));

  container.innerHTML = headerHtml + groupsHtml.join('');
}

// Render Curated News / Blogs Tab
async function renderItems(tab, refreshPills = true) {
  const container = document.getElementById('feed');
  const res = await window.agendaAPI.getItems(tab, currentCategory);
  let items = res.data;

  if (!items || items.length === 0) {
    const fallback = FALLBACK_ITEMS[tab] || [];
    items = (currentCategory === 'All')
      ? fallback
      : fallback.filter(i => i.category === currentCategory);
  }

  if (refreshPills) {
    const categories = res.categories && res.categories.length > 1
      ? res.categories
      : Array.from(new Set(['All', ...items.map(i => i.category).filter(Boolean)]));
    renderSubFilterPills(categories);
  }

  if (items.length === 0) {
    container.innerHTML = `<div class="state-message">No ${tab} dispatches currently available for this category.</div>`;
    return;
  }

  const html = await Promise.all(items.map(async (item) => {
    const cardKey = item.link || String(item.id);
    const isRead = await window.agendaDB.isCardRead(cardKey);
    const dateStr = formatDate(item.published_at);

    return `
      <article class="card ${isRead ? 'is-read' : ''}" data-card-id="${cardKey}">
        ${item.image_url ? `
          <div class="card-image-wrapper">
            <img src="${item.image_url}" class="card-image" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>` : ''}
        <div class="card-meta">
          <div class="card-meta-left">
            <span>${dateStr}</span>
            <span class="card-meta-source">${escapeHtml(item.category || item.source_name || 'Dispatch')}</span>
          </div>
          <button class="card-check-btn ${isRead ? 'is-read' : ''}" 
                  onclick="toggleCardCheck('${cardKey}', event, this)" 
                  title="${isRead ? 'Mark as unread' : 'Mark as read'}">
            ${renderCheckCircleSvg(isRead)}
          </button>
        </div>
        <h2 class="card-title">
          <a href="${item.link}" target="_blank" rel="noopener" onclick="handleCardOpen('${cardKey}')">${escapeHtml(item.title)}</a>
        </h2>
        <p class="card-summary">${escapeHtml(item.summary || '')}</p>
        <div class="card-actions">
          <div class="card-actions-left">
            <button class="btn btn-primary" onclick="openReaderModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">📖 Full Text</button>
            <a href="${item.link}" class="btn btn-outline" target="_blank" rel="noopener" onclick="handleCardOpen('${cardKey}')">Source ↗</a>
            <button class="btn btn-outline" onclick="saveToReads('${item.link}', '${escapeQuote(item.title)}', '${escapeQuote(item.summary || '')}', '${escapeQuote(item.source_name || '')}', '${escapeQuote(item.image_url || '')}')">
              🔖 Read Later
            </button>
          </div>
        </div>
      </article>
    `;
  }));

  container.innerHTML = html.join('');
}

// Render Personal Custom Feeds Tab
async function renderPersonalFeeds(refreshPills = true) {
  const container = document.getElementById('feed');
  const customFeeds = await window.agendaDB.getCustomFeeds();

  if (customFeeds.length === 0) {
    hideSubFilter();
    container.innerHTML = `
      <div class="state-message">
        <p>You haven't added any personal RSS feeds yet.</p>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="openAddFeedModal()">+ Add Your First Feed</button>
      </div>
    `;
    return;
  }

  // Fetch all custom feeds concurrently via CORS proxy
  const feedPromises = customFeeds.map(f => window.agendaAPI.fetchCustomFeed(f.feed_url));
  const results = await Promise.all(feedPromises);

  let allItems = [];
  results.forEach((r, idx) => {
    const feedInfo = customFeeds[idx];
    if (r.items && Array.isArray(r.items)) {
      r.items.forEach(item => {
        allItems.push({
          ...item,
          feed_name: feedInfo.name,
          feed_category: feedInfo.category || 'Personal'
        });
      });
    }
  });

  // Extract automatic categories from feed items
  const autoCategories = ['All', ...new Set(allItems.map(i => i.category || i.feed_category).filter(Boolean))];

  if (refreshPills) {
    renderSubFilterPills(autoCategories);
  }

  let filtered = allItems;
  if (currentCategory !== 'All') {
    filtered = allItems.filter(i => (i.category === currentCategory || i.feed_category === currentCategory));
  }

  // Sort reverse chronological
  filtered.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  if (filtered.length === 0) {
    container.innerHTML = '<div class="state-message">No articles found in personal feeds for this filter.</div>';
    return;
  }

  const html = await Promise.all(filtered.map(async (item) => {
    const cardKey = item.link;
    const isRead = await window.agendaDB.isCardRead(cardKey);

    return `
      <article class="card ${isRead ? 'is-read' : ''}" data-card-id="${cardKey}">
        ${item.image_url ? `
          <div class="card-image-wrapper">
            <img src="${item.image_url}" class="card-image" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>` : ''}
        <div class="card-meta">
          <div class="card-meta-left">
            <span>${formatDate(item.published_at)}</span>
            <span class="card-meta-source">${escapeHtml(item.category || item.feed_name)}</span>
          </div>
          <button class="card-check-btn ${isRead ? 'is-read' : ''}" 
                  onclick="toggleCardCheck('${cardKey}', event, this)" 
                  title="${isRead ? 'Mark as unread' : 'Mark as read'}">
            ${renderCheckCircleSvg(isRead)}
          </button>
        </div>
        <h2 class="card-title">
          <a href="${item.link}" target="_blank" rel="noopener" onclick="handleCardOpen('${cardKey}')">${escapeHtml(item.title)}</a>
        </h2>
        <p class="card-summary">${escapeHtml(item.summary || '')}</p>
        <div class="card-actions">
          <div class="card-actions-left">
            <button class="btn btn-primary" onclick="openReaderModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">📖 Full Text</button>
            <a href="${item.link}" class="btn btn-outline" target="_blank" rel="noopener" onclick="handleCardOpen('${cardKey}')">Source ↗</a>
            <button class="btn btn-outline" onclick="saveToReads('${item.link}', '${escapeQuote(item.title)}', '${escapeQuote(item.summary || '')}', '${escapeQuote(item.feed_name)}', '${escapeQuote(item.image_url || '')}')">
              🔖 Read Later
            </button>
          </div>
        </div>
      </article>
    `;
  }));

  container.innerHTML = html.join('');
}

// Render Reads Tab (Offline Saved Gigs & Articles)
async function renderReads() {
  const container = document.getElementById('feed');
  const readLaterItems = await window.agendaDB.getReadItems();
  const starredEvents = await window.agendaDB.getStarredEvents();

  if (readLaterItems.length === 0 && starredEvents.length === 0) {
    container.innerHTML = `
      <div class="state-message">
        <p>Your private offline reading list and saved gigs are empty.</p>
        <p style="font-size:0.8rem; margin-top:8px;">Tap <strong>★ Save</strong> on events or <strong>🔖 Read Later</strong> on articles to store them here in IndexedDB.</p>
      </div>
    `;
    return;
  }

  let html = '';

  if (starredEvents.length > 0) {
    html += '<h3 style="font-size:0.95rem; margin-bottom:12px; color:var(--color-nightfall);">★ Saved Gigs</h3>';
    const eventCards = await Promise.all(starredEvents.map(async (ev) => {
      const isRead = await window.agendaDB.isCardRead(ev.id);
      const isFollowed = await window.agendaDB.isEntityFollowed(ev.venue_name);

      return `
        <article class="card ${isRead ? 'is-read' : ''}" data-card-id="${ev.id}">
          ${ev.image_url ? `
            <div class="card-image-wrapper">
              <img src="${ev.image_url}" class="card-image" alt="${escapeHtml(ev.title)}" loading="lazy" onerror="this.parentElement.style.display='none'">
            </div>` : ''}
          <div class="card-meta">
            <div class="card-meta-left">
              <span>${formatDate(ev.start_time)}</span>
            </div>
            <button class="card-check-btn ${isRead ? 'is-read' : ''}" 
                    onclick="toggleCardCheck('${ev.id}', event, this)" 
                    title="${isRead ? 'Mark as unread' : 'Mark as read'}">
              ${renderCheckCircleSvg(isRead)}
            </button>
          </div>
          <h2 class="card-title">
            <a href="#" onclick="openEventReaderModal(${JSON.stringify(ev).replace(/"/g, '&quot;')}); return false;">${escapeHtml(ev.title)}</a>
          </h2>
          <div class="card-location">📍 ${escapeHtml(ev.venue_name)}</div>
          <div class="card-actions">
            <div class="card-actions-left">
              <button class="btn btn-primary" onclick="openEventReaderModal(${JSON.stringify(ev).replace(/"/g, '&quot;')})">📖 Read in Full</button>
              <a href="calendar.php?id=${ev.id}" class="btn btn-outline" onclick="handleCardOpen('${ev.id}')">📅 Add to Calendar</a>
              <button class="btn btn-outline" onclick="removeStarred(${ev.id})">✕ Remove</button>
            </div>
            <div class="card-actions-right">
              <button class="btn btn-follow ${isFollowed ? 'is-following' : ''}" 
                      onclick="toggleFollow('${escapeQuote(ev.venue_name)}', 'venue', this)">
                <svg class="rss-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <circle cx="6.18" cy="17.82" r="2.18"/>
                  <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z"/>
                </svg>
                <span>${isFollowed ? 'Following' : 'Follow'}</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }));
    html += eventCards.join('');
  }

  if (readLaterItems.length > 0) {
    html += '<h3 style="font-size:0.95rem; margin:20px 0 12px 0; color:var(--color-nightfall);">🔖 Offline Reading Queue</h3>';
    const readCards = await Promise.all(readLaterItems.map(async (item) => {
      const cardKey = item.url;
      const isRead = await window.agendaDB.isCardRead(cardKey);

      return `
        <article class="card ${isRead ? 'is-read' : ''}" data-card-id="${cardKey}">
          ${item.image_url ? `
            <div class="card-image-wrapper">
              <img src="${item.image_url}" class="card-image" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.style.display='none'">
            </div>` : ''}
          <div class="card-meta">
            <div class="card-meta-left">
              <span>${escapeHtml(item.domain || 'External')}</span>
            </div>
            <button class="card-check-btn ${isRead ? 'is-read' : ''}" 
                    onclick="toggleCardCheck('${cardKey}', event, this)" 
                    title="${isRead ? 'Mark as unread' : 'Mark as read'}">
              ${renderCheckCircleSvg(isRead)}
            </button>
          </div>
          <h2 class="card-title">
            <a href="${item.url}" target="_blank" rel="noopener" onclick="handleCardOpen('${cardKey}')">${escapeHtml(item.title)}</a>
          </h2>
          <p class="card-summary">${escapeHtml(item.description || '')}</p>
          <div class="card-actions">
            <div class="card-actions-left">
              <a href="${item.url}" class="btn btn-primary" target="_blank" rel="noopener" onclick="handleCardOpen('${cardKey}')">Open Link ↗</a>
              <button class="btn btn-outline" onclick="removeRead('${item.url}')">✕ Remove</button>
            </div>
          </div>
        </article>
      `;
    }));
    html += readCards.join('');
  }

  container.innerHTML = html;
}

// User Actions
async function toggleStar(eventData, btn) {
  const isNowStarred = await window.agendaDB.toggleStarredEvent(eventData);
  btn.classList.toggle('starred', isNowStarred);
  btn.textContent = isNowStarred ? '★ Saved' : '★ Save';
}

async function removeStarred(id) {
  await window.agendaDB.toggleStarredEvent({ id });
  await renderReads();
}

async function saveToReads(url, title, description, domain, image_url = '') {
  await window.agendaDB.saveReadItem({ url, title, description, domain, image_url });
  alert('Saved to your private Reads queue in IndexedDB!');
}

async function removeRead(url) {
  await window.agendaDB.deleteReadItem(url);
  await renderReads();
}

// Settings Drawer Management
function toggleSettingsModal() {
  const modal = document.getElementById('settings-modal');
  modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
  if (modal.style.display === 'flex') {
    refreshPersonalFeedsUI();
    refreshStorageMetricsUI();
  }
}

async function toggleChannel(channelName, isChecked) {
  channelSettings[channelName] = isChecked;
  await window.agendaDB.setSetting('channel_settings', channelSettings);
  applyChannelVisibility();
}

function applyChannelVisibility() {
  const newsTab = document.getElementById('tab-btn-news');
  const blogsTab = document.getElementById('tab-btn-blogs');
  const checkNews = document.getElementById('channel-news-check');
  const checkBlogs = document.getElementById('channel-blogs-check');

  if (newsTab) newsTab.style.display = channelSettings.show_news ? 'inline-block' : 'none';
  if (blogsTab) blogsTab.style.display = channelSettings.show_blogs ? 'inline-block' : 'none';
  if (checkNews) checkNews.checked = channelSettings.show_news;
  if (checkBlogs) checkBlogs.checked = channelSettings.show_blogs;

  // If current active tab was hidden, revert to events
  if ((currentTab === 'news' && !channelSettings.show_news) || (currentTab === 'blogs' && !channelSettings.show_blogs)) {
    setTab('events');
  }
}

// Personal Feeds Manager
async function refreshPersonalFeedsUI() {
  const listEl = document.getElementById('personal-feeds-list');
  const personalTabBtn = document.getElementById('tab-btn-personal');
  const feeds = await window.agendaDB.getCustomFeeds();

  if (personalTabBtn) {
    personalTabBtn.style.display = feeds.length > 0 ? 'inline-block' : 'none';
  }

  if (!listEl) return;

  if (feeds.length === 0) {
    listEl.innerHTML = '<p style="font-size:0.8rem; color:var(--color-text-muted);">No custom feeds added yet.</p>';
    return;
  }

  listEl.innerHTML = feeds.map(f => `
    <div class="personal-feed-item">
      <div>
        <strong>${escapeHtml(f.name)}</strong>
        <span class="personal-feed-badge">${escapeHtml(f.category || 'Personal')}</span>
      </div>
      <button class="icon-btn" style="color:#C85A32;" onclick="removePersonalFeed('${escapeQuote(f.feed_url)}')">✕ Delete</button>
    </div>
  `).join('');
}

function openAddFeedModal() {
  document.getElementById('add-feed-modal').style.display = 'flex';
}

function closeAddFeedModal() {
  document.getElementById('add-feed-modal').style.display = 'none';
  document.getElementById('feed-name-input').value = '';
  document.getElementById('feed-url-input').value = '';
  document.getElementById('feed-cat-input').value = 'Personal';
}

async function handleAddFeedSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('feed-name-input').value.trim();
  const url = document.getElementById('feed-url-input').value.trim();
  const category = document.getElementById('feed-cat-input').value.trim() || 'Personal';

  if (!url) {
    alert('Please enter a valid RSS URL.');
    return;
  }

  await window.agendaDB.addCustomFeed({ name: name || 'Personal Feed', feed_url: url, category });
  closeAddFeedModal();
  await refreshPersonalFeedsUI();
  alert('Personal RSS feed added successfully!');
}

async function removePersonalFeed(url) {
  if (confirm('Remove this custom feed?')) {
    await window.agendaDB.deleteCustomFeed(url);
    await refreshPersonalFeedsUI();
    if (currentTab === 'personal') {
      await renderPersonalFeeds();
    }
  }
}

// Data Portability Handlers
async function handleExportBackup() {
  await window.agendaDB.exportBackup();
}

async function handleImportBackupFile(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      await window.agendaDB.importBackup(e.target.result);
      alert('Backup imported successfully! Reloading...');
      window.location.reload();
    } catch (err) {
      alert('Failed to import backup: ' + err.message);
    }
  };
  reader.readAsText(file);
}

async function handleExportOpml() {
  await window.agendaDB.exportOpml();
}

// Local Storage & Retention Settings Handlers
async function initRetentionSettings() {
  try {
    const settings = await window.agendaDB.getRetentionSettings();

    // 1. Highlight active sync window pill
    const pills = document.querySelectorAll('#sync-window-pills .retention-pill-btn');
    pills.forEach(btn => {
      const days = parseInt(btn.dataset.days, 10);
      btn.classList.toggle('active', days === settings.syncWindowDays);
    });

    // 2. Select active past retention radio button
    const radio = document.querySelector(`input[name="past_retention"][value="${settings.pastRetentionPolicy}"]`);
    if (radio) {
      radio.checked = true;
    }

    // 3. Purge past events according to retention policy
    await window.agendaDB.purgePastEvents();

    // 4. Update storage metrics
    await refreshStorageMetricsUI();
  } catch (err) {
    console.warn('Failed to initialize retention settings:', err);
  }
}

async function setSyncWindow(days, btn) {
  try {
    await window.agendaDB.saveRetentionSettings({ syncWindowDays: days });
    document.querySelectorAll('#sync-window-pills .retention-pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  } catch (err) {
    console.warn('Error setting sync window:', err);
  }
}

async function setPastRetention(policy) {
  try {
    await window.agendaDB.saveRetentionSettings({ pastRetentionPolicy: policy });
    const purged = await window.agendaDB.purgePastEvents();
    await refreshStorageMetricsUI();
  } catch (err) {
    console.warn('Error setting past retention:', err);
  }
}

async function refreshStorageMetricsUI() {
  try {
    const metrics = await window.agendaDB.getStorageMetrics();
    const usedEl = document.getElementById('metric-storage-used');
    const diaryEl = document.getElementById('metric-diary-count');
    const readsEl = document.getElementById('metric-reads-count');

    if (usedEl) usedEl.textContent = metrics.storageUsedText;
    if (diaryEl) diaryEl.textContent = `${metrics.starredCount} starred gigs`;
    if (readsEl) readsEl.textContent = `${metrics.readsCount} articles`;
  } catch (err) {
    console.warn('Error refreshing storage metrics:', err);
  }
}

async function handlePurgePastEvents() {
  try {
    const purged = await window.agendaDB.purgePastEvents();
    await refreshStorageMetricsUI();
    alert(`Clean complete: ${purged} expired entries pruned according to retention policy.`);
  } catch (err) {
    alert('Error cleaning past events: ' + err.message);
  }
}

// Instant Dynamic Feed Search (Title, Description, Venue, Suburb)
function handleFeedSearch(query) {
  const q = (query || '').toLowerCase().trim();
  const cards = document.querySelectorAll('#feed .card');
  const sections = document.querySelectorAll('#feed .grouped-section');
  let matchedCount = 0;

  cards.forEach(card => {
    if (!q) {
      card.style.display = '';
      matchedCount++;
      return;
    }
    const text = card.textContent.toLowerCase();
    const matches = text.includes(q);
    card.style.display = matches ? '' : 'none';
    if (matches) matchedCount++;
  });

  // For grouped views (e.g. Following lineup by venue)
  sections.forEach(sec => {
    if (!q) {
      sec.style.display = '';
      return;
    }
    const visibleCards = sec.querySelectorAll('.card:not([style*="display: none"])');
    sec.style.display = visibleCards.length > 0 ? '' : 'none';
  });

  // Display no match feedback if appropriate
  let noMatchEl = document.getElementById('search-no-match-msg');
  if (q && matchedCount === 0 && cards.length > 0) {
    if (!noMatchEl) {
      noMatchEl = document.createElement('div');
      noMatchEl.id = 'search-no-match-msg';
      noMatchEl.className = 'state-message';
      document.getElementById('feed').appendChild(noMatchEl);
    }
    noMatchEl.textContent = `No items found matching "${query}".`;
    noMatchEl.style.display = 'block';
  } else if (noMatchEl) {
    noMatchEl.style.display = 'none';
  }
}

function copyEmbedSnippet() {
  const code = `<div class="agendaweb-widget" data-venue="your-venue-slug" data-limit="5"></div>\n<script src="https://agendaweb.app/widget.js" async><\/script>`;
  navigator.clipboard.writeText(code).then(() => {
    alert('Widget code copied to clipboard!');
  });
}

// Helpers
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr.replace(' ', 'T'));
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

function escapeQuote(str) {
  return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function formatFullDateTime(startStr, endStr) {
  if (!startStr) return '';
  const d = new Date(startStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return startStr;
  const datePart = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (endStr) {
    const endD = new Date(endStr.replace(' ', 'T'));
    if (!isNaN(endD.getTime())) {
      const endTimePart = endD.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${datePart} · ${timePart} – ${endTimePart}`;
    }
  }
  return `${datePart} · ${timePart}`;
}

// Full-Text Broadsheet Reader Modal (Articles & Dispatches)
function openReaderModal(item) {
  const modal = document.getElementById('reader-modal');
  if (!modal) return;

  const cardKey = item.link || String(item.id);
  handleCardOpen(cardKey);

  document.getElementById('reader-source-cat').textContent = `${item.source_name || item.feed_name || 'Dispatch'} · ${item.category || 'General'}`;
  document.getElementById('reader-title').textContent = item.title;
  document.getElementById('reader-date').textContent = formatDate(item.published_at || new Date().toISOString());

  // Image
  const imgContainer = document.getElementById('reader-image-container');
  if (item.image_url) {
    imgContainer.innerHTML = `<img src="${item.image_url}" class="reader-image" alt="${escapeHtml(item.title)}">`;
  } else {
    imgContainer.innerHTML = '';
  }

  // Full Text Body: uses content (from <content:encoded>) or summary fallback
  const bodyEl = document.getElementById('reader-body');
  if (item.content) {
    bodyEl.innerHTML = item.content;
  } else if (item.summary) {
    bodyEl.innerHTML = `<p>${escapeHtml(item.summary)}</p>`;
  } else {
    bodyEl.innerHTML = `<p style="font-style:italic; color:var(--color-text-muted);">No text available. Click 'Open Source' to read on the publisher's site.</p>`;
  }

  // Action Buttons
  const saveBtn = document.getElementById('reader-save-btn');
  saveBtn.textContent = '🔖 Save to Reads';
  saveBtn.onclick = () => {
    saveToReads(item.link, item.title, item.summary || '', item.source_name || item.feed_name || '', item.image_url || '');
  };

  const sourceLink = document.getElementById('reader-source-link');
  sourceLink.style.display = 'inline-flex';
  sourceLink.textContent = 'Open Source ↗';
  sourceLink.href = item.link;

  const calBtn = document.getElementById('reader-cal-btn');
  if (calBtn) calBtn.style.display = 'none';

  modal.style.display = 'flex';
}

// Full Event Broadsheet Reader Modal (Venues & Gigs)
function openEventReaderModal(ev) {
  const modal = document.getElementById('reader-modal');
  if (!modal) return;

  const cardKey = String(ev.id);
  handleCardOpen(cardKey);

  // Set meta header
  document.getElementById('reader-source-cat').textContent = `📍 ${ev.venue_name || 'Venue'} · ${ev.category || 'Culture'}`;
  document.getElementById('reader-title').textContent = ev.title;

  const fullDateStr = formatFullDateTime(ev.start_time, ev.end_time);
  document.getElementById('reader-date').innerHTML = `
    <div style="font-weight:600; color:var(--color-nightfall);">📅 ${fullDateStr}</div>
    ${ev.address ? `<div style="font-size:0.84rem; color:var(--color-text-muted); margin-top:3px;">📍 ${escapeHtml(ev.address)}</div>` : ''}
  `;

  // Image
  const imgContainer = document.getElementById('reader-image-container');
  if (ev.image_url) {
    imgContainer.innerHTML = `<img src="${ev.image_url}" class="reader-image" alt="${escapeHtml(ev.title)}" loading="lazy">`;
  } else {
    imgContainer.innerHTML = '';
  }

  // Body content: details highlight box + formatted paragraphs
  const bodyEl = document.getElementById('reader-body');
  const rawDesc = ev.description || 'Full event details will be announced closer to the performance date.';
  const paragraphs = rawDesc.split(/\n\n+/).filter(p => p.trim().length > 0);
  const formattedHtml = paragraphs.length > 0
    ? paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`).join('')
    : `<p>${escapeHtml(rawDesc)}</p>`;

  bodyEl.innerHTML = `
    <div class="event-reader-highlight">
      <div class="event-reader-item"><strong>Venue:</strong> ${escapeHtml(ev.venue_name)}</div>
      ${ev.address ? `<div class="event-reader-item"><strong>Location:</strong> ${escapeHtml(ev.address)}</div>` : ''}
      <div class="event-reader-item"><strong>Schedule:</strong> ${fullDateStr}</div>
      <div class="event-reader-item"><strong>Category:</strong> ${escapeHtml(ev.category || 'Culture')}</div>
      ${ev.origin ? `<div class="event-reader-item"><strong>Source:</strong> Verified ${escapeHtml(ev.origin)} feed</div>` : ''}
    </div>
    <div class="event-reader-content">
      ${formattedHtml}
    </div>
  `;

  // Action Buttons
  const saveBtn = document.getElementById('reader-save-btn');
  saveBtn.textContent = '★ Save to Reads';
  saveBtn.onclick = () => {
    saveToReads(ev.ticket_url || `#event-${ev.id}`, ev.title, ev.description || '', ev.venue_name, ev.image_url || '');
  };

  const sourceLink = document.getElementById('reader-source-link');
  if (ev.ticket_url) {
    sourceLink.style.display = 'inline-flex';
    sourceLink.href = ev.ticket_url;
    sourceLink.textContent = '🎟 Get Tickets ↗';
  } else {
    sourceLink.style.display = 'none';
  }

  // Ensure calendar button exists
  let calBtn = document.getElementById('reader-cal-btn');
  if (!calBtn) {
    calBtn = document.createElement('a');
    calBtn.id = 'reader-cal-btn';
    calBtn.className = 'btn btn-primary';
    calBtn.target = '_blank';
    saveBtn.parentElement.insertBefore(calBtn, saveBtn);
  }
  calBtn.href = `calendar.php?id=${ev.id}`;
  calBtn.innerHTML = '📅 Add to Calendar';
  calBtn.style.display = 'inline-flex';

  modal.style.display = 'flex';
}

function closeReaderModal() {
  const modal = document.getElementById('reader-modal');
  if (modal) modal.style.display = 'none';
}

// Help & Suggestion Modal Handlers
function toggleHelpModal() {
  const modal = document.getElementById('help-modal');
  if (!modal) return;
  modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
  if (modal.style.display === 'flex') {
    // Reset suggestion form state
    const form = document.getElementById('suggestion-form');
    const successMsg = document.getElementById('suggestion-success-msg');
    const toggleBtn = document.getElementById('toggle-suggestion-form-btn');
    if (form) form.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = '+ Write Suggestion';
  }
}

function toggleSuggestionForm() {
  const form = document.getElementById('suggestion-form');
  const toggleBtn = document.getElementById('toggle-suggestion-form-btn');
  const successMsg = document.getElementById('suggestion-success-msg');
  if (!form) return;

  const isHidden = (form.style.display === 'none' || form.style.display === '');
  form.style.display = isHidden ? 'block' : 'none';
  if (toggleBtn) {
    toggleBtn.textContent = isHidden ? 'Hide Form' : '+ Write Suggestion';
  }
  if (successMsg) successMsg.style.display = 'none';
}

async function handleSuggestionSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('suggestion-submit-btn');
  const name = document.getElementById('suggestion-name').value.trim();
  const email = document.getElementById('suggestion-email').value.trim();
  const category = document.getElementById('suggestion-cat').value;
  const message = document.getElementById('suggestion-msg').value.trim();

  if (!message) {
    alert('Please write your suggestion message.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
  }

  try {
    const res = await fetch('api/suggestions.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, category, message })
    });
    const data = await res.json();

    if (res.ok && data.status === 'success') {
      document.getElementById('suggestion-form').reset();
      document.getElementById('suggestion-form').style.display = 'none';
      const successMsg = document.getElementById('suggestion-success-msg');
      if (successMsg) {
        successMsg.style.display = 'block';
        successMsg.textContent = '✓ ' + (data.message || 'Thank you! Your suggestion has been saved to the curator inbox.');
      }
      const toggleBtn = document.getElementById('toggle-suggestion-form-btn');
      if (toggleBtn) toggleBtn.textContent = '+ Write Another';
    } else {
      alert('Error: ' + (data.message || 'Unable to submit suggestion.'));
    }
  } catch (err) {
    alert('Failed to send suggestion: ' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Suggestion ↗';
    }
  }
}

/**
 * Hard Purge & Force Refresh
 * Clears Service Worker CacheStorage, unregisters active service workers,
 * and reloads the current page with a timestamp cache-buster.
 */
async function forceAppRefresh() {
  const triggerBtn = window.event && window.event.target ? window.event.target : null;
  if (triggerBtn) {
    triggerBtn.textContent = '⏳ Purging...';
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      console.log('CacheStorage purged:', keys);
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
      console.log('Service worker unregistered:', registrations.length);
    }
  } catch (err) {
    console.warn('Cache purge notice:', err);
  }

  const cleanPath = window.location.pathname;
  window.location.href = cleanPath + '?reload=' + Date.now();
}
