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

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  await renderCurrentTab();
}

async function renderCurrentTab() {
  const container = document.getElementById('feed');
  container.innerHTML = '<div class="state-message">Loading cultural feed...</div>';

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
  const res = await window.agendaAPI.getEvents(currentCategory);
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
          <a href="#" onclick="handleCardOpen('${ev.id}'); return false;">${escapeHtml(ev.title)}</a>
        </h2>
        <div class="card-location">📍 ${escapeHtml(ev.venue_name)} · ${escapeHtml(ev.address || '')}</div>
        ${ev.description ? `<p class="card-summary">${escapeHtml(ev.description)}</p>` : ''}
        <div class="card-actions">
          <div class="card-actions-left">
            <a href="calendar.php?id=${ev.id}" class="btn btn-primary" target="_blank" onclick="handleCardOpen('${ev.id}')">📅 Add to Calendar</a>
            <button class="btn ${starBtnClass}" onclick="toggleStar(${JSON.stringify(ev).replace(/"/g, '&quot;')}, this)">
              ${starBtnText}
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

// Render Following Tab (Events from Followed Venues / Artists)
async function renderFollowing(refreshPills = true) {
  const container = document.getElementById('feed');
  const followedList = await window.agendaDB.getFollowedEntities();
  const followedNames = followedList.map(f => f.name.toLowerCase());

  if (followedList.length === 0) {
    hideSubFilter();
    container.innerHTML = `
      <div class="state-message">
        <h3 style="font-size:1.05rem; margin-bottom:8px; color:var(--color-nightfall);">Your Following Lineup is Empty</h3>
        <p style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:14px; max-width:440px; margin-left:auto; margin-right:auto;">
          Follow your favorite venues, artists, and independent organisers by tapping the <strong>Follow [RSS]</strong> button on any gig card.
        </p>
        <button class="btn btn-primary" onclick="setTab('events')">⚡ Browse All Gigs</button>
      </div>
    `;
    return;
  }

  // Fetch all events
  const res = await window.agendaAPI.getEvents('All');
  let events = res.data;
  if (!events || events.length === 0) {
    events = FALLBACK_EVENTS;
  }

  // Filter events from followed venues
  let followedEvents = events.filter(e => followedNames.includes((e.venue_name || '').toLowerCase()));

  // Extract dynamic categories for followed events
  const autoCategories = ['All', ...new Set(followedEvents.map(e => e.category).filter(Boolean))];
  if (refreshPills) {
    renderSubFilterPills(autoCategories);
  }

  if (currentCategory !== 'All') {
    followedEvents = followedEvents.filter(e => e.category === currentCategory);
  }

  // Header showing followed chips
  let headerHtml = `
    <div class="following-header">
      <span class="following-header-label">Following (${followedList.length}):</span>
      ${followedList.map(f => `
        <span class="following-chip">
          📍 ${escapeHtml(f.name)}
          <button class="following-chip-remove" onclick="unfollowFromSettings('${escapeQuote(f.name)}')">✕</button>
        </span>
      `).join('')}
    </div>
  `;

  if (followedEvents.length === 0) {
    container.innerHTML = headerHtml + `
      <div class="state-message">
        No upcoming events found from your followed lineup${currentCategory !== 'All' ? ' in category "' + escapeHtml(currentCategory) + '"' : ''}.
      </div>
    `;
    return;
  }

  const html = await Promise.all(followedEvents.map(async (ev) => {
    const isStarred = await window.agendaDB.isEventStarred(ev.id);
    const isRead = await window.agendaDB.isCardRead(ev.id);
    const isFollowed = await window.agendaDB.isEntityFollowed(ev.venue_name);
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
          <a href="#" onclick="handleCardOpen('${ev.id}'); return false;">${escapeHtml(ev.title)}</a>
        </h2>
        <div class="card-location">📍 ${escapeHtml(ev.venue_name)} · ${escapeHtml(ev.address || '')}</div>
        ${ev.description ? `<p class="card-summary">${escapeHtml(ev.description)}</p>` : ''}
        <div class="card-actions">
          <div class="card-actions-left">
            <a href="calendar.php?id=${ev.id}" class="btn btn-primary" target="_blank" onclick="handleCardOpen('${ev.id}')">📅 Add to Calendar</a>
            <button class="btn ${starBtnClass}" onclick="toggleStar(${JSON.stringify(ev).replace(/"/g, '&quot;')}, this)">
              ${starBtnText}
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

  container.innerHTML = headerHtml + html.join('');
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
          <h2 class="card-title">${escapeHtml(ev.title)}</h2>
          <div class="card-location">📍 ${escapeHtml(ev.venue_name)}</div>
          <div class="card-actions">
            <div class="card-actions-left">
              <a href="calendar.php?id=${ev.id}" class="btn btn-primary" onclick="handleCardOpen('${ev.id}')">📅 Add to Calendar</a>
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

// Full-Text Broadsheet Reader Modal
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
  saveBtn.onclick = () => {
    saveToReads(item.link, item.title, item.summary || '', item.source_name || item.feed_name || '', item.image_url || '');
  };

  const sourceLink = document.getElementById('reader-source-link');
  sourceLink.href = item.link;

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
