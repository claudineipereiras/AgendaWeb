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
// Real-feed mode: Fallback dummy items eliminated to ensure genuine live RSS/API syndication


function initTheme() {
  const saved = localStorage.getItem('agendaweb_theme');
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.setAttribute('data-theme', saved);
  }
  updateThemeIcon();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const isDark = current === 'dark' || (!current && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('agendaweb_theme', next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const current = document.documentElement.getAttribute('data-theme');
  const isDark = current === 'dark' || (!current && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const icon = document.getElementById('theme-toggle-icon');
  const label = document.getElementById('theme-toggle-label');
  if (icon) {
    icon.innerHTML = isDark 
      ? `<svg class="m3-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
      : `<svg class="m3-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
  if (label) {
    label.textContent = isDark ? 'Day' : 'Night';
  }
}

// Location Selector Mini Popover
function toggleLocationOption(e) {
  if (e) e.stopPropagation();
  const popup = document.getElementById('location-mini-popup');
  if (popup) {
    const isShowing = popup.style.display === 'block';
    popup.style.display = isShowing ? 'none' : 'block';
  }
}

// Close location mini popup on click outside
document.addEventListener('click', (e) => {
  const popup = document.getElementById('location-mini-popup');
  const btn = document.getElementById('header-location-btn');
  if (popup && popup.style.display === 'block') {
    if (!popup.contains(e.target) && !btn?.contains(e.target)) {
      popup.style.display = 'none';
    }
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  // Load Channel Preferences (Default: Clean mode = News & Blogs OFF)
  channelSettings = await window.agendaDB.getSetting('channel_settings', {
    show_news: false,
    show_blogs: false
  });
  applyChannelVisibility();

  // Load Personal Feeds count and Followed Lineup count
  await refreshPersonalFeedsUI();
  await refreshFollowedUI();

  // Refresh dynamic navigation tabs with user categories and drag & drop reordering
  await refreshNavigationTabs();

  // Initialize Storage Retention & Metrics
  await initRetentionSettings();

  // Initialize City Hub & Audience Filter
  await initCityAndAudienceUI();

  // Initialize Hide-Seen Preference
  updateHideSeenUI();

  // Register WebMCP Tools for In-Browser Agents
  initWebMcpTools();

  // Render initial tab
  await setTab('events');

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.log('ServiceWorker registration skipped:', err);
    });
  }
});

// WebMCP In-Browser Agent Tools Registration (Model Context Protocol in-browser)
function initWebMcpTools() {
  const tools = {
    search_events: {
      name: 'search_events',
      description: 'Search upcoming live music concerts, band lineups, and cultural events across Australia (Melbourne, Sydney, Brisbane, Perth, Adelaide, Hobart).',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Band name, artist, venue, or keyword search query' },
          city: { type: 'string', description: 'City slug (melbourne, sydney, brisbane, perth, adelaide, hobart, or all)', default: 'melbourne' },
          category: { type: 'string', description: 'Category filter (e.g. Live Music, Culture)', default: 'all' },
          audience: { type: 'string', enum: ['all', '18+', 'all_ages', 'kids_family'], default: 'all' }
        }
      },
      execute: async (params = {}) => {
        const res = await window.agendaAPI.getEvents(
          params.category || 'all',
          'all',
          params.city || 'all',
          params.audience || 'all'
        );
        let events = res.data || [];
        if (params.query) {
          const q = params.query.toLowerCase().trim();
          events = events.filter(e => 
            (e.title && e.title.toLowerCase().includes(q)) ||
            (e.venue_name && e.venue_name.toLowerCase().includes(q)) ||
            (e.description && e.description.toLowerCase().includes(q))
          );
        }
        return {
          count: events.length,
          events: events.slice(0, 20).map(e => ({
            id: e.id,
            title: e.title,
            venue: e.venue_name,
            start_time: e.start_time,
            category: e.category,
            age_restriction: e.age_restriction,
            ticket_url: e.ticket_url
          }))
        };
      }
    },
    get_venues: {
      name: 'get_venues',
      description: 'List independent live music venues and cultural spaces across Australia.',
      inputSchema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City slug filter (e.g. melbourne)' }
        }
      },
      execute: async (params = {}) => {
        const eventsRes = await window.agendaAPI.getEvents('all', 'all', params.city || 'all');
        return {
          venues: eventsRes.venues || []
        };
      }
    },
    get_calendar_feed: {
      name: 'get_calendar_feed',
      description: 'Get standard iCalendar (.ics) subscription URL for syncing events to personal calendar apps.',
      inputSchema: {
        type: 'object',
        properties: {
          venue: { type: 'string', description: 'Venue slug or all', default: 'all' }
        }
      },
      execute: async (params = {}) => {
        return {
          url: `https://agendaweb.app/calendar.php?venue=${encodeURIComponent(params.venue || 'all')}`,
          format: 'text/calendar'
        };
      }
    }
  };

  // 1. Standard navigator.modelContext WebMCP API
  if (typeof navigator !== 'undefined' && navigator.modelContext && typeof navigator.modelContext.registerTool === 'function') {
    try {
      for (const t of Object.values(tools)) {
        navigator.modelContext.registerTool(t);
      }
      console.log('✓ WebMCP tools registered with navigator.modelContext.');
    } catch (e) {
      console.warn('WebMCP registration skipped:', e);
    }
  }

  // 2. Global window object for in-browser agent accessibility
  window.agendaWebMCP = {
    tools,
    callTool: async (name, params) => {
      if (tools[name] && typeof tools[name].execute === 'function') {
        return await tools[name].execute(params);
      }
      throw new Error(`Tool "${name}" not found.`);
    }
  };
}

// Seen / Read State & Hide-Seen Toggle Controller
let isHideSeenActive = localStorage.getItem('agendaweb_hide_seen') === 'true';

function updateHideSeenUI() {
  const btn = document.getElementById('hide-seen-btn');
  const iconSpan = document.getElementById('hide-seen-icon');
  const labelSpan = document.getElementById('hide-seen-label');
  
  if (isHideSeenActive) {
    document.body.classList.add('hide-seen-active');
    if (btn) {
      btn.classList.add('is-active');
      btn.title = 'Showing unread cards only (tap to show seen cards)';
    }
    if (labelSpan) labelSpan.textContent = 'Hidden';
    if (iconSpan) {
      // Closed / Slashed Eye
      iconSpan.innerHTML = `
        <svg class="m3-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    }
  } else {
    document.body.classList.remove('hide-seen-active');
    if (btn) {
      btn.classList.remove('is-active');
      btn.title = 'Hide cards marked as seen';
    }
    if (labelSpan) labelSpan.textContent = 'Seen';
    if (iconSpan) {
      // Open Eye
      iconSpan.innerHTML = `
        <svg class="m3-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    }
  }
  updateHiddenSeenNotice();
}

function toggleHideSeenCards() {
  isHideSeenActive = !isHideSeenActive;
  localStorage.setItem('agendaweb_hide_seen', isHideSeenActive ? 'true' : 'false');
  updateHideSeenUI();
}

function updateHiddenSeenNotice() {
  const feed = document.getElementById('feed');
  if (!feed) return;
  const existingNotice = document.getElementById('hidden-seen-notice');
  if (existingNotice) existingNotice.remove();

  if (!isHideSeenActive) return;

  const cards = feed.querySelectorAll('.card');
  if (cards.length === 0) return;

  const readCards = feed.querySelectorAll('.card.is-read');
  if (readCards.length > 0 && readCards.length === cards.length) {
    const notice = document.createElement('div');
    notice.id = 'hidden-seen-notice';
    notice.className = 'state-message';
    notice.style.padding = '36px 20px';
    notice.style.textAlign = 'center';
    notice.style.maxWidth = '460px';
    notice.style.margin = '28px auto';
    notice.innerHTML = `
      <div style="width:48px; height:48px; border-radius:50%; background:rgba(27, 59, 43, 0.08); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:var(--color-racing-green);">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      </div>
      <h3 style="font-family:var(--font-serif); font-size:1.15rem; color:var(--color-nightfall); margin-bottom:6px;">All cards in this view are marked as seen</h3>
      <p style="font-size:0.85rem; color:var(--color-text-muted); line-height:1.5; margin-bottom:14px;">
        You've read all ${readCards.length} cards in this category. Tap below or the eye icon in the top bar to show them again.
      </p>
      <button class="btn btn-outline" onclick="toggleHideSeenCards()" style="font-size:0.82rem;">
        👁️ Show Seen Cards
      </button>
    `;
    feed.appendChild(notice);
  }
}

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
    btnElement.title = isNowRead ? 'Mark as unseen' : 'Mark as seen';
  }
  updateHiddenSeenNotice();
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
      checkBtn.title = 'Mark as unseen';
    }
  }
  updateHiddenSeenNotice();
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
  isCategoriesExpanded = false;

  document.querySelectorAll('.tab-btn, .m3-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const mainTabs = document.getElementById('main-tabs');
  if (mainTabs) {
    if (tabName === 'events') {
      mainTabs.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      const activeBtn = mainTabs.querySelector(`.m3-tab-btn[data-tab="${tabName}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    }
  }

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
  let sectionTitle = 'Content';
  if (currentTab === 'events') sectionTitle = 'Events';
  else if (currentTab === 'following') sectionTitle = 'Following';
  else if (currentTab === 'reads') sectionTitle = 'Reads';
  else if (currentTab.startsWith('group:')) sectionTitle = currentTab.slice(6);
  else if (currentTab === 'personal') sectionTitle = 'Personal';
  else sectionTitle = currentTab;

  container.innerHTML = `<div class="state-message">Loading ${escapeHtml(sectionTitle)} feed...</div>`;

  const audienceBar = document.getElementById('audience-filter-bar');
  if (audienceBar) {
    audienceBar.style.display = (currentTab === 'events') ? 'flex' : 'none';
  }

  if (currentTab === 'events') {
    await renderEvents();
  } else if (currentTab === 'following') {
    await renderFollowing();
  } else if (currentTab === 'reads') {
    await renderReads();
  } else if (currentTab.startsWith('group:')) {
    const groupName = currentTab.slice(6);
    await renderFeedGroup(groupName);
  } else if (currentTab === 'personal') {
    await renderFeedGroup('Personal');
  } else {
    await renderItems(currentTab);
  }

  const searchInput = document.getElementById('feed-search');
  if (searchInput && searchInput.value) {
    handleFeedSearch(searchInput.value);
  }
}

// Dynamic Navigation Tabs with User Category / Group Folders and Drag & Drop
async function refreshNavigationTabs() {
  const mainTabs = document.getElementById('main-tabs');
  if (!mainTabs) return;

  const customFeeds = await window.agendaDB.getCustomFeeds();

  // Group feeds by category/group folder (only folders with actual feeds)
  const groupNames = Array.from(new Set(customFeeds.map(f => (f.category || 'Personal').trim()).filter(Boolean)));

  // Base core tabs
  const defaultTabs = [
    {
      id: 'events',
      label: 'Events',
      iconSvg: `
        <svg class="tab-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>`
    },
    {
      id: 'following',
      label: 'Following',
      iconSvg: `
        <svg class="tab-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9"></path>
          <path d="M4 4a16 16 0 0 1 16 16"></path>
          <circle cx="5" cy="19" r="1"></circle>
        </svg>`
    },
    {
      id: 'reads',
      label: 'Reads',
      iconSvg: `
        <svg class="tab-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>`
    }
  ];

  // Append user category/group folders
  groupNames.forEach(grp => {
    defaultTabs.push({
      id: `group:${grp}`,
      label: grp,
      isGroup: true,
      groupName: grp,
      iconSvg: `
        <svg class="tab-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>`
    });
  });

  // Restore saved drag-and-drop order from localStorage
  let savedOrder = [];
  try {
    savedOrder = JSON.parse(localStorage.getItem('agenda_main_tabs_order') || '[]');
  } catch (e) {}

  if (Array.isArray(savedOrder) && savedOrder.length > 0) {
    defaultTabs.sort((a, b) => {
      const idxA = savedOrder.indexOf(a.id);
      const idxB = savedOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }

  mainTabs.innerHTML = defaultTabs.map(t => `
    <button class="m3-tab-btn ${currentTab === t.id ? 'active' : ''}" 
            data-tab="${escapeHtml(t.id)}" 
            draggable="true" 
            onclick="setTab('${escapeQuote(t.id)}')">
      ${t.iconSvg}
      <span>${escapeHtml(t.label)}</span>
    </button>
  `).join('');

  initTabDragAndDrop();
  initTabTouchReorder();
}

// Drag and Drop Tab Reordering
function saveTabsOrder() {
  const mainTabs = document.getElementById('main-tabs');
  if (!mainTabs) return;
  const order = Array.from(mainTabs.querySelectorAll('.m3-tab-btn')).map(b => b.dataset.tab);
  localStorage.setItem('agenda_main_tabs_order', JSON.stringify(order));
}

function initTabDragAndDrop() {
  const mainTabs = document.getElementById('main-tabs');
  if (!mainTabs) return;

  let draggedTab = null;

  mainTabs.querySelectorAll('.m3-tab-btn').forEach(btn => {
    btn.setAttribute('draggable', 'true');

    btn.ondragstart = (e) => {
      draggedTab = btn;
      btn.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', btn.dataset.tab);
    };

    btn.ondragend = () => {
      btn.classList.remove('is-dragging');
      mainTabs.querySelectorAll('.m3-tab-btn').forEach(b => {
        b.classList.remove('drag-over-left', 'drag-over-right');
      });
      saveTabsOrder();
    };

    btn.ondragover = (e) => {
      e.preventDefault();
      if (!draggedTab || draggedTab === btn) return;
      e.dataTransfer.dropEffect = 'move';

      const rect = btn.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (e.clientX < midX) {
        btn.classList.add('drag-over-left');
        btn.classList.remove('drag-over-right');
      } else {
        btn.classList.add('drag-over-right');
        btn.classList.remove('drag-over-left');
      }
    };

    btn.ondragleave = () => {
      btn.classList.remove('drag-over-left', 'drag-over-right');
    };

    btn.ondrop = (e) => {
      e.preventDefault();
      if (!draggedTab || draggedTab === btn) return;

      const rect = btn.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (e.clientX < midX) {
        mainTabs.insertBefore(draggedTab, btn);
      } else {
        mainTabs.insertBefore(draggedTab, btn.nextSibling);
      }
      mainTabs.querySelectorAll('.m3-tab-btn').forEach(b => {
        b.classList.remove('drag-over-left', 'drag-over-right');
      });
      saveTabsOrder();
    };
  });
}

function initTabTouchReorder() {
  const mainTabs = document.getElementById('main-tabs');
  if (!mainTabs || mainTabs.dataset.touchBound) return;
  mainTabs.dataset.touchBound = 'true';

  let touchTab = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let isDraggingTouch = false;
  let touchHoldTimer = null;

  mainTabs.addEventListener('touchstart', (e) => {
    const tab = e.target.closest('.m3-tab-btn');
    if (!tab) return;
    touchTab = tab;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDraggingTouch = false;

    touchHoldTimer = setTimeout(() => {
      isDraggingTouch = true;
      if (touchTab) touchTab.classList.add('is-dragging');
    }, 280);
  }, { passive: true });

  mainTabs.addEventListener('touchmove', (e) => {
    if (!touchTab) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);

    if (!isDraggingTouch && (dx > 8 || dy > 8)) {
      clearTimeout(touchHoldTimer);
    }

    if (isDraggingTouch) {
      if (e.cancelable) e.preventDefault();
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const elem = document.elementFromPoint(clientX, clientY);
      const targetTab = elem?.closest('.m3-tab-btn');
      if (targetTab && targetTab !== touchTab && targetTab.parentNode === mainTabs) {
        const rect = targetTab.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (clientX < midX) {
          mainTabs.insertBefore(touchTab, targetTab);
        } else {
          mainTabs.insertBefore(touchTab, targetTab.nextSibling);
        }
      }
    }
  }, { passive: false });

  const endTouch = () => {
    clearTimeout(touchHoldTimer);
    if (isDraggingTouch && touchTab) {
      touchTab.classList.remove('is-dragging');
      saveTabsOrder();
    }
    touchTab = null;
    isDraggingTouch = false;
  };

  mainTabs.addEventListener('touchend', endTouch, { passive: true });
  mainTabs.addEventListener('touchcancel', endTouch, { passive: true });
}

// Subcategory Filter Rendering (Dynamic Auto-Grouping with Top 8 + More Expander)
let isCategoriesExpanded = false;
let currentCategoriesList = [];

function toggleExpandCategories() {
  isCategoriesExpanded = !isCategoriesExpanded;
  renderSubFilterPills(currentCategoriesList, false);
}

function renderSubFilterPills(categories, updateStoredList = true) {
  const subFilter = document.getElementById('sub-filter');
  if (!subFilter) return;

  if (updateStoredList) {
    currentCategoriesList = categories || [];
    // Ensure active category is visible if set beyond threshold
    const activeIndex = currentCategoriesList.findIndex(c => (c || '').toLowerCase() === (currentCategory || '').toLowerCase());
    if (activeIndex >= 8) {
      isCategoriesExpanded = true;
    }
  }

  // Strip any numbers/counts from category names for a clean aesthetic
  const cleanCategories = (currentCategoriesList || [])
    .map(c => typeof c === 'string' ? c.replace(/\s*\(\d+\)$/, '').trim() : c)
    .filter(Boolean);

  if (!cleanCategories || cleanCategories.length <= 1) {
    subFilter.style.display = 'none';
    return;
  }

  subFilter.style.display = 'flex';

  const isPillActive = (cat) => {
    const cLower = (cat || '').toLowerCase().trim();
    const curLower = (currentCategory || '').toLowerCase().trim();
    if (cLower === curLower) return true;
    if ((cLower === 'all' || cLower === 'all followed') && (curLower === 'all' || curLower === 'all followed')) return true;
    return false;
  };

  // 1. If 8 or fewer categories, show all without 'More' button
  if (cleanCategories.length <= 8) {
    subFilter.innerHTML = cleanCategories.map(cat => `
      <button class="filter-pill ${isPillActive(cat) ? 'active' : ''}" 
              data-category="${escapeHtml(cat)}"
              onclick="setFilter(this.dataset.category, this)">
        ${escapeHtml(cat)}
      </button>
    `).join('');
    return;
  }

  // 2. More than 8 categories: Collapsed state (Top 8 + 'More ▾')
  if (!isCategoriesExpanded) {
    let top8 = cleanCategories.slice(0, 8);
    // If current category is active but not in top 8, include it in top 8
    if (currentCategory && currentCategory !== 'All' && currentCategory !== 'All Followed' && !top8.some(c => isPillActive(c))) {
      const activeMatch = cleanCategories.find(c => isPillActive(c));
      if (activeMatch) {
        top8[7] = activeMatch;
      }
    }

    const pillsHtml = top8.map(cat => `
      <button class="filter-pill ${isPillActive(cat) ? 'active' : ''}" 
              data-category="${escapeHtml(cat)}"
              onclick="setFilter(this.dataset.category, this)">
        ${escapeHtml(cat)}
      </button>
    `).join('');
    const moreBtnHtml = `
      <button class="filter-pill more-pill" onclick="toggleExpandCategories()" title="Show all feeds/categories">
        More ▾
      </button>
    `;
    subFilter.innerHTML = pillsHtml + moreBtnHtml;
  } else {
    // 3. Expanded state (All categories + 'Less ▴')
    const pillsHtml = cleanCategories.map(cat => `
      <button class="filter-pill ${isPillActive(cat) ? 'active' : ''}" 
              data-category="${escapeHtml(cat)}"
              onclick="setFilter(this.dataset.category, this)">
        ${escapeHtml(cat)}
      </button>
    `).join('');
    const lessBtnHtml = `
      <button class="filter-pill more-pill active" onclick="toggleExpandCategories()" title="Show fewer feeds/categories">
        Less ▴
      </button>
    `;
    subFilter.innerHTML = pillsHtml + lessBtnHtml;
  }
}

function hideSubFilter() {
  const subFilter = document.getElementById('sub-filter');
  if (subFilter) subFilter.style.display = 'none';
}

async function setFilter(category, btnElement) {
  currentCategory = category || 'All';
  document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  if (currentTab === 'events') {
    await renderEvents(false);
  } else if (currentTab === 'following') {
    await renderFollowing(false);
  } else if (currentTab === 'reads') {
    await renderReads(false);
  } else if (currentTab.startsWith('group:')) {
    const groupName = currentTab.slice(6);
    await renderFeedGroup(groupName, false);
  } else if (currentTab === 'personal') {
    await renderFeedGroup('Personal', false);
  } else {
    await renderItems(currentTab, false);
  }
}

// Date Parser for Editorial Date Tile
function parseEventDateParts(startTimeStr) {
  if (!startTimeStr) return { month: 'TBA', day: '--', dayName: '', time: '' };
  try {
    const d = new Date(startTimeStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return { month: 'TBA', day: '--', dayName: '', time: '' };
    const month = d.toLocaleDateString('en-AU', { month: 'short' }).toUpperCase();
    const day = d.getDate();
    const dayName = d.toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase();
    const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    return { month, day, dayName, time };
  } catch (e) {
    return { month: 'TBA', day: '--', dayName: '', time: '' };
  }
}

// Distance calculation (Haversine formula in KM)
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

window.userLocation = null;
window.nearMeActive = false;

async function toggleNearMe(btnElement) {
  if (window.nearMeActive) {
    window.nearMeActive = false;
    if (btnElement) {
      btnElement.classList.remove('active');
      const label = document.getElementById('proximity-chip-label');
      if (label) label.textContent = 'Near Me';
    }
    renderEvents(false);
    return;
  }

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  const label = document.getElementById('proximity-chip-label');
  if (label) label.textContent = 'Locating...';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      window.userLocation = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      };
      window.nearMeActive = true;
      if (btnElement) btnElement.classList.add('active');
      if (label) label.textContent = 'Near Me (10km)';
      renderEvents(false);
    },
    (err) => {
      if (label) label.textContent = 'Near Me';
      alert('Location access denied or unavailable: ' + err.message);
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ==========================================
// UNIFIED CARD MODEL RENDERERS ACROSS ALL VIEWS
// ==========================================

// Build Unified Event Card HTML (Category removed from top of event card)
async function renderEventCardHtml(ev, idx = 0, options = {}) {
  const isStarred = await window.agendaDB.isEventStarred(ev.id);
  const isRead = await window.agendaDB.isCardRead(ev.id);
  const isFollowed = await window.agendaDB.isEntityFollowed(ev.venue_name);
  const dateParts = parseEventDateParts(ev.start_time);
  const starBtnClass = isStarred ? 'btn-secondary starred' : 'btn-secondary';
  const starBtnText = isStarred ? 'Saved' : 'Save';

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
  const distanceBadgeHtml = ev.distance_km !== undefined && ev.distance_km !== null ? `<span class="badge-distance">📍 ${ev.distance_km} km</span>` : '';

  // Modern Image Loading Priority: Top 2 images get fetchpriority="high", rest use loading="lazy"
  const imgPriorityAttr = idx < 2 ? 'fetchpriority="high"' : 'loading="lazy"';

  return `
    <article class="card ${isRead ? 'is-read' : ''}" data-card-id="${ev.id}">
      ${ev.image_url ? `
        <div class="card-image-wrapper">
          <img src="${ev.image_url}" class="card-image" alt="${escapeHtml(ev.title)}" ${imgPriorityAttr} onerror="this.parentElement.style.display='none'">
        </div>` : ''}

      <div class="card-header-row">
        <div class="card-date-tile" title="${dateParts.dayName} ${dateParts.day} ${dateParts.month}">
          <span class="date-month">${dateParts.month}</span>
          <span class="date-day">${dateParts.day}</span>
          <span class="date-dayname">${dateParts.dayName}</span>
        </div>

        <div class="card-header-content">
          <div class="card-meta">
            <div class="card-meta-left">
              ${suburbBadgeHtml}
              ${distanceBadgeHtml}
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
            ${escapeHtml(ev.venue_name || '')}${ev.address || ev.suburb ? ` · ${escapeHtml(ev.address || ev.suburb)}` : ''}${dateParts.time ? ` · ${dateParts.time}` : ''}
          </div>
        </div>
      </div>

      ${ev.description ? `<p class="card-summary">${escapeHtml(ev.description)}</p>` : ''}

      <div class="card-actions">
        <div class="card-actions-left">
          ${ev.ticket_url ? `
            <a href="${ev.ticket_url}" class="btn btn-primary" target="_blank" rel="noopener" onclick="handleCardOpen('${ev.id}')">
              <span>Tickets ↗</span>
            </a>
            <button class="btn btn-outline" onclick="openEventReaderModal(${JSON.stringify(ev).replace(/"/g, '&quot;')})">
              <span>Details</span>
            </button>
          ` : `
            <button class="btn btn-primary" onclick="openEventReaderModal(${JSON.stringify(ev).replace(/"/g, '&quot;')})">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <span>Read in Full</span>
            </button>
          `}
          ${options.inReads ? `
            <button class="btn btn-outline" onclick="removeStarred(${ev.id})">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span>Remove</span>
            </button>
          ` : `
            <button class="btn ${starBtnClass}" onclick="toggleStar(${JSON.stringify(ev).replace(/"/g, '&quot;')}, this)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              <span>${starBtnText}</span>
            </button>
          `}
        </div>

        <div class="card-actions-right">
          <a href="calendar.php?id=${ev.id}" class="btn-icon-action" target="_blank" title="Add to Calendar (.ics)" onclick="handleCardOpen('${ev.id}')">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </a>
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
}

// Build Unified Article / Dispatch Card HTML (Exact same layout & model as events)
async function renderArticleCardHtml(item, idx = 0, options = {}) {
  const cardKey = item.link || item.url || String(item.id);
  const isRead = await window.agendaDB.isCardRead(cardKey);
  const dateParts = parseEventDateParts(item.published_at || item.pubDate || item.date || item.saved_at);
  const sourceName = item.feed_name || item.source_name || item.domain || 'Feed';
  const imgPriorityAttr = idx < 2 ? 'fetchpriority="high"' : 'loading="lazy"';
  const summaryText = cleanCardSummary(item.summary || item.description || '');

  return `
    <article class="card ${isRead ? 'is-read' : ''}" data-card-id="${cardKey}">
      ${item.image_url ? `
        <div class="card-image-wrapper">
          <img src="${item.image_url}" class="card-image" alt="${escapeHtml(item.title)}" ${imgPriorityAttr} onerror="this.parentElement.style.display='none'">
        </div>` : ''}

      <div class="card-header-row">
        <div class="card-date-tile" title="${dateParts.dayName} ${dateParts.day} ${dateParts.month}">
          <span class="date-month">${dateParts.month}</span>
          <span class="date-day">${dateParts.day}</span>
          <span class="date-dayname">${dateParts.dayName}</span>
        </div>

        <div class="card-header-content">
          <div class="card-meta">
            <div class="card-meta-left">
              <span class="badge-suburb">
                <svg class="badge-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 11a9 9 0 0 1 9 9"></path>
                  <path d="M4 4a16 16 0 0 1 16 16"></path>
                  <circle cx="5" cy="19" r="1"></circle>
                </svg>
                ${escapeHtml(sourceName)}
              </span>
            </div>
            <button class="card-check-btn ${isRead ? 'is-read' : ''}" 
                    onclick="toggleCardCheck('${cardKey}', event, this)" 
                    title="${isRead ? 'Mark as unread' : 'Mark as read'}">
              ${renderCheckCircleSvg(isRead)}
            </button>
          </div>

          <h2 class="card-title">
            <a href="${item.link || item.url || '#'}" target="_blank" rel="noopener" onclick="handleCardOpen('${cardKey}')">${escapeHtml(item.title)}</a>
          </h2>

          <div class="card-location">
            <svg class="loc-pin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; color:var(--color-racing-green);">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            ${escapeHtml(sourceName)}${dateParts.time ? ` · ${dateParts.time}` : ''}
          </div>
        </div>
      </div>

      ${summaryText ? `<p class="card-summary">${escapeHtml(summaryText)}</p>` : ''}

      <div class="card-actions">
        <div class="card-actions-left">
          <button class="btn btn-primary" onclick="openReaderModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            <span>Full Text</span>
          </button>
          ${options.inReads ? `
            <button class="btn btn-outline" onclick="removeRead('${cardKey}')">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span>Remove</span>
            </button>
          ` : `
            <button class="btn btn-outline" onclick="saveToReads('${item.link || item.url}', '${escapeQuote(item.title)}', '${escapeQuote(summaryText)}', '${escapeQuote(sourceName)}', '${escapeQuote(item.image_url || '')}', this)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Read Later</span>
            </button>
          `}
        </div>

        <div class="card-actions-right">
          <a href="${item.link || item.url || '#'}" class="btn-icon-action" target="_blank" rel="noopener" title="Source ↗" onclick="handleCardOpen('${cardKey}')">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      </div>
    </article>
  `;
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
  let events = res.data || [];

  // Filter or sort by proximity if Near Me is active
  if (window.nearMeActive && window.userLocation) {
    events = events.map(ev => {
      // Find venue coordinates
      const v = window.agendaVenues?.find(x => x.slug === ev.venue_slug);
      const vLat = ev.latitude || v?.latitude || (selectedCity === 'melbourne' ? -37.8136 : null);
      const vLon = ev.longitude || v?.longitude || (selectedCity === 'melbourne' ? 144.9631 : null);
      let dist = null;
      if (vLat && vLon) {
        dist = calculateDistanceKm(window.userLocation.lat, window.userLocation.lon, vLat, vLon);
      }
      return { ...ev, distance_km: dist };
    }).filter(ev => ev.distance_km === null || ev.distance_km <= 15)
      .sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
  }

  if (refreshPills) {
    if (res.categories && res.categories.length > 1) {
      renderSubFilterPills(res.categories);
    } else {
      hideSubFilter();
    }
  }

  if (events.length === 0) {
    container.innerHTML = '<div class="state-message">No upcoming events found for this filter.</div>';
    return;
  }

  const html = await Promise.all(events.map((ev, idx) => renderEventCardHtml(ev, idx)));
  container.innerHTML = html.join('');
  updateHiddenSeenNotice();
}

// Render Following Tab (Clean listing with unified card model)
async function renderFollowing(refreshPills = true) {
  const container = document.getElementById('feed');
  const followedList = await window.agendaDB.getFollowedEntities();

  if (followedList.length === 0) {
    hideSubFilter();
    container.innerHTML = `
      <div class="state-message">
        <h3 style="font-size:1.05rem; margin-bottom:8px; color:var(--color-nightfall);">Your Following Lineup is Empty</h3>
        <p style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:14px; max-width:440px; margin-left:auto; margin-right:auto;">
          Follow your favorite venues, artists, and independent organisers by tapping the <strong>Follow</strong> button on any gig card.
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

  // Sub-filter pills: 'All Followed' + distinct followed venue names
  const venueOptions = ['All Followed', ...followedList.map(f => f.name).filter(Boolean)];
  if (refreshPills) {
    if (venueOptions.length > 2) {
      renderSubFilterPills(venueOptions);
    } else {
      hideSubFilter();
    }
  }

  // Fetch all events
  const selectedCity = await window.agendaDB.getSelectedCity();
  const res = await window.agendaAPI.getEvents('all', 'all', selectedCity || 'all');
  if (res.venues && res.venues.length > 0) {
    window.agendaVenues = res.venues;
  }
  let events = res.data || [];

  // Filter events by followed venues (case-insensitive & trimmed)
  const followedNames = new Set(followedList.map(f => (f.name || '').trim().toLowerCase()).filter(Boolean));
  let filteredEvents = events.filter(e => {
    const vName = (e.venue_name || '').trim().toLowerCase();
    return followedNames.has(vName) || Array.from(followedNames).some(fn => vName.includes(fn) || fn.includes(vName));
  });

  if (currentCategory && currentCategory !== 'All' && currentCategory !== 'all' && currentCategory !== 'All Followed') {
    const catLower = currentCategory.trim().toLowerCase();
    filteredEvents = filteredEvents.filter(e => {
      const vName = (e.venue_name || '').trim().toLowerCase();
      return vName === catLower || vName.includes(catLower) || catLower.includes(vName);
    });
  }

  if (filteredEvents.length === 0) {
    const filterLabel = (currentCategory === 'All' || currentCategory === 'All Followed')
      ? 'your followed venues'
      : `"${escapeHtml(currentCategory)}"`;
    container.innerHTML = `<div class="state-message">No upcoming gigs currently announced for ${filterLabel}. Monitoring feed for new dates.</div>`;
    return;
  }

  const html = await Promise.all(filteredEvents.map((ev, idx) => renderEventCardHtml(ev, idx)));
  container.innerHTML = html.join('');
  updateHiddenSeenNotice();
}

// In-memory cache for custom feed items per folder
let cachedGroupItems = {};

// Render Dynamic Category / Group Folder from Personal Feeds
async function renderFeedGroup(groupName, refreshPills = true) {
  const container = document.getElementById('feed');
  const customFeeds = await window.agendaDB.getCustomFeeds();
  const groupFeeds = customFeeds.filter(f => (f.category || 'Personal').toLowerCase() === groupName.toLowerCase());

  if (groupFeeds.length === 0) {
    hideSubFilter();
    container.innerHTML = `
      <div class="state-message">
        <p>No feeds found in folder "<strong>${escapeHtml(groupName)}</strong>".</p>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="openAddFeedModal()">+ Add Feed</button>
      </div>
    `;
    return;
  }

  // Submenu pills: 'All' + individual feed names in this group
  const feedPills = ['All', ...groupFeeds.map(f => f.name).filter(Boolean)];
  if (refreshPills) {
    if (feedPills.length > 2) {
      renderSubFilterPills(feedPills);
    } else {
      hideSubFilter();
    }
  }

  let allItems = [];
  if (!refreshPills && cachedGroupItems[groupName] && cachedGroupItems[groupName].length > 0) {
    allItems = cachedGroupItems[groupName];
  } else {
    // Fetch feeds in this group
    const feedPromises = groupFeeds.map(f => window.agendaAPI.fetchCustomFeed(f.feed_url));
    const results = await Promise.all(feedPromises);

    results.forEach((r, idx) => {
      const feedInfo = groupFeeds[idx];
      if (r && r.items && Array.isArray(r.items)) {
        r.items.forEach(item => {
          allItems.push({
            ...item,
            feed_name: feedInfo.name,
            feed_category: feedInfo.category || groupName
          });
        });
      }
    });
    cachedGroupItems[groupName] = allItems;
  }

  let filtered = allItems;
  if (currentCategory && currentCategory !== 'All' && currentCategory !== 'all') {
    const catLower = currentCategory.trim().toLowerCase();
    filtered = allItems.filter(i => {
      const fName = (i.feed_name || '').trim().toLowerCase();
      const iCat = (i.category || '').trim().toLowerCase();
      return fName === catLower || fName.includes(catLower) || catLower.includes(fName) || iCat === catLower;
    });
  }

  // Sort reverse chronological
  filtered.sort((a, b) => new Date(b.published_at || b.pubDate || 0) - new Date(a.published_at || a.pubDate || 0));

  if (filtered.length === 0) {
    const filterLabel = (currentCategory === 'All' || currentCategory === 'all')
      ? `folder "${escapeHtml(groupName)}"`
      : `feed "${escapeHtml(currentCategory)}"`;
    container.innerHTML = `<div class="state-message">No articles found in ${filterLabel}.</div>`;
    return;
  }

  const html = await Promise.all(filtered.map((item, idx) => renderArticleCardHtml(item, idx)));
  container.innerHTML = html.join('');
  updateHiddenSeenNotice();
}

// Render Personal Custom Feeds Tab
async function renderPersonalFeeds(refreshPills = true) {
  await renderFeedGroup('Personal', refreshPills);
}

// Render Curated News / Blogs Tab
async function renderItems(tab, refreshPills = true) {
  const container = document.getElementById('feed');
  const res = await window.agendaAPI.getItems(tab, currentCategory);
  let items = res.data || [];

  if (refreshPills) {
    const feedPills = (res.sources && res.sources.length > 1)
      ? res.sources
      : (res.categories && res.categories.length > 1)
        ? res.categories
        : Array.from(new Set(['All', ...items.map(i => i.source_name || i.category).filter(Boolean)]));
    renderSubFilterPills(feedPills);
  }

  // Client-side source/category filter fallback
  if (currentCategory && currentCategory !== 'All' && currentCategory !== 'all') {
    const catLower = currentCategory.trim().toLowerCase();
    items = items.filter(i => {
      const sName = (i.source_name || '').trim().toLowerCase();
      const iCat = (i.category || '').trim().toLowerCase();
      return sName === catLower || sName.includes(catLower) || catLower.includes(sName) || iCat === catLower;
    });
  }

  if (items.length === 0) {
    container.innerHTML = `<div class="state-message">No ${tab} dispatches currently available for "${escapeHtml(currentCategory)}".</div>`;
    return;
  }

  const html = await Promise.all(items.map((item, idx) => renderArticleCardHtml(item, idx)));
  container.innerHTML = html.join('');
  updateHiddenSeenNotice();
}

// Render Reads Tab (Offline Saved Gigs & Articles)
async function renderReads(refreshPills = true) {
  const container = document.getElementById('feed');
  const readLaterItems = await window.agendaDB.getReadItems();
  const starredEvents = await window.agendaDB.getStarredEvents();

  if (readLaterItems.length === 0 && starredEvents.length === 0) {
    hideSubFilter();
    container.innerHTML = `
      <div class="state-message">
        <p>Your private offline reading list and saved gigs are empty.</p>
        <p style="font-size:0.8rem; margin-top:8px;">Tap <strong>Save</strong> on events or <strong>Read Later</strong> on articles to store them here in IndexedDB.</p>
      </div>
    `;
    return;
  }

  const savedSources = ['All', ...new Set([
    ...starredEvents.map(e => e.venue_name).filter(Boolean),
    ...readLaterItems.map(i => i.domain || i.source_name).filter(Boolean)
  ])];

  if (refreshPills) {
    if (savedSources.length > 2) {
      renderSubFilterPills(savedSources);
    } else {
      hideSubFilter();
    }
  }

  let filteredEvents = starredEvents;
  let filteredReads = readLaterItems;

  if (currentCategory && currentCategory !== 'All' && currentCategory !== 'all') {
    const catLower = currentCategory.trim().toLowerCase();
    filteredEvents = starredEvents.filter(e => {
      const v = (e.venue_name || '').trim().toLowerCase();
      return v === catLower || v.includes(catLower) || catLower.includes(v);
    });
    filteredReads = readLaterItems.filter(i => {
      const d = (i.domain || i.source_name || '').trim().toLowerCase();
      return d === catLower || d.includes(catLower) || catLower.includes(d);
    });
  }

  if (filteredEvents.length === 0 && filteredReads.length === 0) {
    container.innerHTML = `
      <div class="state-message">
        <p>No saved items found for "${escapeHtml(currentCategory)}".</p>
      </div>
    `;
    return;
  }

  let html = '';

  if (filteredEvents.length > 0) {
    html += `
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:12px;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="color:var(--color-amber-rust);">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        <h3 style="font-size:0.95rem; margin:0; color:var(--color-nightfall);">Saved Gigs</h3>
      </div>
    `;
    const eventCards = await Promise.all(filteredEvents.map((ev, idx) => renderEventCardHtml(ev, idx, { inReads: true })));
    html += eventCards.join('');
  }

  if (filteredReads.length > 0) {
    html += `
      <div style="display:flex; align-items:center; gap:6px; margin:24px 0 12px 0;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-racing-green);">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <h3 style="font-size:0.95rem; margin:0; color:var(--color-nightfall);">Offline Reading Queue</h3>
      </div>
    `;
    const readCards = await Promise.all(filteredReads.map((item, idx) => renderArticleCardHtml(item, idx, { inReads: true })));
    html += readCards.join('');
  }

  container.innerHTML = html;
  updateHiddenSeenNotice();
}

// User Actions
async function toggleStar(eventData, btn) {
  const isNowStarred = await window.agendaDB.toggleStarredEvent(eventData);
  btn.classList.toggle('starred', isNowStarred);
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="${isNowStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>${isNowStarred ? 'Saved' : 'Save'}</span>
  `;
}

async function removeStarred(id) {
  await window.agendaDB.toggleStarredEvent({ id });
  await renderReads(true);
}

async function saveToReads(url, title, description, domain, image_url = '') {
  await window.agendaDB.saveReadItem({ url, title, description, domain, image_url });
  alert('Saved to your private Reads queue in IndexedDB!');
}

async function removeRead(url) {
  await window.agendaDB.deleteReadItem(url);
  await renderReads(true);
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

  if (newsTab) newsTab.style.display = channelSettings.show_news ? 'inline-flex' : 'none';
  if (blogsTab) blogsTab.style.display = channelSettings.show_blogs ? 'inline-flex' : 'none';
  if (checkNews) checkNews.checked = channelSettings.show_news;
  if (checkBlogs) checkBlogs.checked = channelSettings.show_blogs;

  // If current active tab was hidden, revert to events
  if ((currentTab === 'news' && !channelSettings.show_news) || (currentTab === 'blogs' && !channelSettings.show_blogs)) {
    setTab('events');
  }

  // Ensure scroll is pinned to the far-left corner if Events is active
  if (currentTab === 'events') {
    const mainTabs = document.getElementById('main-tabs');
    if (mainTabs) mainTabs.scrollLeft = 0;
  }
}

// Personal Feeds Manager
async function refreshPersonalFeedsUI() {
  const listEl = document.getElementById('personal-feeds-list');
  const feeds = await window.agendaDB.getCustomFeeds();

  if (listEl) {
    if (feeds.length === 0) {
      listEl.innerHTML = '<p style="font-size:0.8rem; color:var(--color-text-muted);">No custom feeds added yet.</p>';
    } else {
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
  }

  await refreshNavigationTabs();
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
  await refreshNavigationTabs();
  await setTab(`group:${category}`);
  alert(`Personal RSS feed added to folder "${category}"!`);
}

async function removePersonalFeed(url) {
  if (confirm('Remove this custom feed?')) {
    await window.agendaDB.deleteCustomFeed(url);
    await refreshPersonalFeedsUI();
    await refreshNavigationTabs();
    if (currentTab.startsWith('group:') || currentTab === 'personal') {
      const customFeeds = await window.agendaDB.getCustomFeeds();
      const groupName = currentTab.startsWith('group:') ? currentTab.slice(6) : 'Personal';
      const stillHasFeeds = customFeeds.some(f => (f.category || 'Personal').toLowerCase() === groupName.toLowerCase());
      if (stillHasFeeds) {
        await renderCurrentTab();
      } else {
        await setTab('events');
      }
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

async function handleImportOpmlFile(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const count = await window.agendaDB.importOpml(e.target.result);
      alert(`Successfully imported ${count} feed(s) from OPML! Reloading...`);
      window.location.reload();
    } catch (err) {
      alert('Failed to import OPML: ' + err.message);
    }
  };
  reader.readAsText(file);
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

function cleanCardSummary(text) {
  if (!text) return '';
  let clean = String(text);
  // Strip raw HTML tags if present
  clean = clean.replace(/<[^>]+>/g, ' ');
  // Decode entities that might be unescaped tags
  clean = clean.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  clean = clean.replace(/<[^>]+>/g, ' ');
  return clean.replace(/\s+/g, ' ').trim();
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
  saveBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>Save to Reads</span>
  `;
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
  document.getElementById('reader-source-cat').innerHTML = `
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="vertical-align:-2px; margin-right:3px; color:var(--color-racing-green);">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
    <span>${escapeHtml(ev.venue_name || 'Venue')} · ${escapeHtml(ev.category || 'Culture')}</span>
  `;
  document.getElementById('reader-title').textContent = ev.title;

  const fullDateStr = formatFullDateTime(ev.start_time, ev.end_time);
  document.getElementById('reader-date').innerHTML = `
    <div style="font-weight:600; color:var(--color-nightfall); display:flex; align-items:center; gap:5px;">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span>${fullDateStr}</span>
    </div>
    ${ev.address ? `
      <div style="font-size:0.84rem; color:var(--color-text-muted); margin-top:4px; display:flex; align-items:center; gap:4px;">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="color:var(--color-racing-green);">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <span>${escapeHtml(ev.address)}</span>
      </div>` : ''}
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
    </div>
    <div class="event-reader-content">
      ${formattedHtml}
    </div>
  `;

  // Action Buttons
  const saveBtn = document.getElementById('reader-save-btn');
  saveBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>Save to Reads</span>
  `;
  saveBtn.onclick = () => {
    saveToReads(ev.ticket_url || `#event-${ev.id}`, ev.title, ev.description || '', ev.venue_name, ev.image_url || '');
  };

  const sourceLink = document.getElementById('reader-source-link');
  if (ev.ticket_url) {
    sourceLink.style.display = 'inline-flex';
    sourceLink.href = ev.ticket_url;
    sourceLink.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/>
      </svg>
      <span>Get Tickets ↗</span>
    `;
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
  calBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
    <span>Add to Calendar</span>
  `;
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
