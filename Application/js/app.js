/**
 * AgendaWeb Main Application Controller
 */

let currentTab = 'events';
let currentCategory = 'All';
let isCleanMode = false;

// Fallback seed events for offline / local static preview
const FALLBACK_EVENTS = [
  {
    id: 1,
    title: "The Echoes — Album Launch",
    venue_name: "The Gasometer Hotel",
    address: "484 Smith St, Collingwood VIC",
    category: "Live Music",
    start_time: "2026-10-24 20:00:00",
    description: "Indie rock outfit celebrating their debut LP with special guests.",
    ticket_url: "https://oztix.com.au",
    calendar_url: "calendar.php?id=1"
  },
  {
    id: 2,
    title: "Contemporary Printmaking Biennial",
    venue_name: "Fitzroy Community Arts",
    address: "128 Gertrude St, Fitzroy VIC",
    category: "Art",
    start_time: "2026-10-25 10:00:00",
    description: "Showcasing emerging Australian printmakers and zine artists.",
    ticket_url: "",
    calendar_url: "calendar.php?id=2"
  }
];

// Fallback news items for offline preview
const FALLBACK_ITEMS = {
  news: [
    {
      id: 101,
      source_name: "ABC News",
      title: "Regional Arts Grants Reopened for Community Venues",
      summary: "Victoria’s live music venues receive new infrastructure support under the grassroots recovery fund.",
      link: "https://www.abc.net.au/news",
      published_at: "2026-10-18 08:30:00"
    }
  ],
  politics: [
    {
      id: 201,
      source_name: "The Conversation (AU)",
      title: "Why Australia's Cultural Infrastructure Needs Decentralized Support",
      summary: "Public arts funding policy is shifting towards community-anchored hubs and open data.",
      link: "https://theconversation.com/au",
      published_at: "2026-10-18 07:45:00"
    }
  ],
  culture: [
    {
      id: 301,
      source_name: "The Guardian (AU)",
      title: "Australian Indie Music Resilience: Behind Collingwood's Gigs",
      summary: "An in-depth look into independent venues maintaining live stages amidst urban development.",
      link: "https://www.theguardian.com/au/culture",
      published_at: "2026-10-17 14:00:00"
    }
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  // Load Clean Mode preference
  isCleanMode = await window.agendaDB.getSetting('clean_mode', false);
  applyCleanMode(isCleanMode);

  // Initialize view
  await renderCurrentTab();

  // Register Service Worker for offline PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.log('ServiceWorker registration skipped:', err);
    });
  }
});

async function setTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const subFilter = document.getElementById('sub-filter');
  if (subFilter) {
    subFilter.style.display = (tabName === 'events') ? 'flex' : 'none';
  }

  await renderCurrentTab();
}

async function setFilter(category, btnElement) {
  currentCategory = category;
  document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  await renderEvents();
}

async function renderCurrentTab() {
  const container = document.getElementById('feed');
  container.innerHTML = '<div class="state-message">Loading cultural feed...</div>';

  if (currentTab === 'events') {
    await renderEvents();
  } else if (currentTab === 'reads') {
    await renderReads();
  } else {
    await renderItems(currentTab);
  }
}

async function renderEvents() {
  const container = document.getElementById('feed');
  let events = await window.agendaAPI.getEvents(currentCategory);

  if (!events || events.length === 0) {
    events = (currentCategory === 'All')
      ? FALLBACK_EVENTS
      : FALLBACK_EVENTS.filter(e => e.category === currentCategory);
  }

  if (events.length === 0) {
    container.innerHTML = '<div class="state-message">No upcoming events found for this filter.</div>';
    return;
  }

  const html = await Promise.all(events.map(async (ev) => {
    const isStarred = await window.agendaDB.isEventStarred(ev.id);
    const dateStr = formatDate(ev.start_time);
    const starBtnClass = isStarred ? 'btn-secondary starred' : 'btn-secondary';
    const starBtnText = isStarred ? '★ Saved' : '★ Save';

    return `
      <article class="card">
        <div class="card-meta">
          <span>${dateStr}</span>
          <span class="card-meta-source">${escapeHtml(ev.category || 'Culture')}</span>
        </div>
        <h2 class="card-title">${escapeHtml(ev.title)}</h2>
        <div class="card-location">📍 ${escapeHtml(ev.venue_name)} · ${escapeHtml(ev.address || '')}</div>
        ${ev.description ? `<p class="card-summary">${escapeHtml(ev.description)}</p>` : ''}
        <div class="card-actions">
          <a href="calendar.php?id=${ev.id}" class="btn btn-primary">📅 Add to Calendar</a>
          <button class="btn ${starBtnClass}" onclick="toggleStar(${JSON.stringify(ev).replace(/"/g, '&quot;')}, this)">
            ${starBtnText}
          </button>
          ${ev.ticket_url ? `<a href="${ev.ticket_url}" class="btn btn-outline" target="_blank" rel="noopener">Tickets</a>` : ''}
        </div>
      </article>
    `;
  }));

  container.innerHTML = html.join('');
}

async function renderItems(tab) {
  const container = document.getElementById('feed');
  let items = await window.agendaAPI.getItems(tab);

  if (!items || items.length === 0) {
    items = FALLBACK_ITEMS[tab] || [];
  }

  if (items.length === 0) {
    container.innerHTML = `<div class="state-message">No ${tab} dispatches currently available.</div>`;
    return;
  }

  const html = items.map(item => {
    const dateStr = formatDate(item.published_at);
    return `
      <article class="card">
        <div class="card-meta">
          <span>${dateStr}</span>
          <span class="card-meta-source">${escapeHtml(item.source_name || 'Broadsheet')}</span>
        </div>
        <h2 class="card-title">
          <a href="${item.link}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
        </h2>
        <p class="card-summary">${escapeHtml(item.summary || '')}</p>
        <div class="card-actions">
          <a href="${item.link}" class="btn btn-primary" target="_blank" rel="noopener">Read Full Article ↗</a>
          <button class="btn btn-outline" onclick="saveToReads('${item.link}', '${escapeQuote(item.title)}', '${escapeQuote(item.summary || '')}', '${escapeQuote(item.source_name || '')}')">
            🔖 Read Later
          </button>
        </div>
      </article>
    `;
  });

  container.innerHTML = html.join('');
}

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
    starredEvents.forEach(ev => {
      html += `
        <article class="card">
          <div class="card-meta"><span>${formatDate(ev.start_time)}</span></div>
          <h2 class="card-title">${escapeHtml(ev.title)}</h2>
          <div class="card-location">📍 ${escapeHtml(ev.venue_name)}</div>
          <div class="card-actions">
            <a href="calendar.php?id=${ev.id}" class="btn btn-primary">📅 Add to Calendar</a>
            <button class="btn btn-outline" onclick="removeStarred(${ev.id})">✕ Remove</button>
          </div>
        </article>
      `;
    });
  }

  if (readLaterItems.length > 0) {
    html += '<h3 style="font-size:0.95rem; margin:20px 0 12px 0; color:var(--color-nightfall);">🔖 Offline Reading Queue</h3>';
    readLaterItems.forEach(item => {
      html += `
        <article class="card">
          <div class="card-meta"><span>${escapeHtml(item.domain || 'External')}</span></div>
          <h2 class="card-title"><a href="${item.url}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></h2>
          <p class="card-summary">${escapeHtml(item.description || '')}</p>
          <div class="card-actions">
            <a href="${item.url}" class="btn btn-primary" target="_blank" rel="noopener">Open Link ↗</a>
            <button class="btn btn-outline" onclick="removeRead('${item.url}')">✕ Remove</button>
          </div>
        </article>
      `;
    });
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

async function saveToReads(url, title, description, domain) {
  await window.agendaDB.saveReadItem({ url, title, description, domain });
  alert('Saved to your private Reads queue in IndexedDB!');
}

async function removeRead(url) {
  await window.agendaDB.deleteReadItem(url);
  await renderReads();
}

// Settings & Clean Mode
function toggleSettingsModal() {
  const modal = document.getElementById('settings-modal');
  modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

async function toggleCleanMode(checkbox) {
  isCleanMode = checkbox.checked;
  await window.agendaDB.setSetting('clean_mode', isCleanMode);
  applyCleanMode(isCleanMode);
}

function applyCleanMode(active) {
  const newsTabs = document.querySelectorAll('.tab-news, .tab-politics, .tab-culture');
  newsTabs.forEach(el => {
    el.style.display = active ? 'none' : 'inline-block';
  });

  const badge = document.getElementById('clean-mode-indicator');
  if (badge) {
    badge.textContent = active ? '⚡ Clean Gig Guide' : '✦ Open Broadsheet';
  }

  const checkbox = document.getElementById('clean-mode-check');
  if (checkbox) checkbox.checked = active;

  if (active && (currentTab === 'news' || currentTab === 'politics' || currentTab === 'culture')) {
    setTab('events');
  }
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
