/**
 * AgendaWeb Embeddable Venue Widget (widget.js)
 * Standalone, zero-dependency calendar widget for venue websites.
 * 
 * Usage:
 * <div class="agendaweb-widget" data-venue="the-gasometer-hotel" data-limit="5"></div>
 * <script src="https://agendaweb.app/widget.js" async></script>
 */

(function () {
  'use strict';

  // Prevent multiple executions
  if (window.__AgendaWebWidgetLoaded) return;
  window.__AgendaWebWidgetLoaded = true;

  // Find API root from script tag or fallback
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const defaultApiBase = currentScript && currentScript.src
    ? new URL(currentScript.src).origin
    : (window.location.origin || 'https://agendaweb.app');

  const STYLES = `
    .aw-widget {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 'Inter', sans-serif;
      background: #FFFFFF;
      border: 1px solid #E6E2D8;
      border-radius: 12px;
      padding: 16px;
      color: #1B3B2B;
      box-sizing: border-box;
      max-width: 100%;
      box-shadow: 0 2px 8px rgba(27, 59, 43, 0.05);
      line-height: 1.4;
    }
    .aw-widget * { box-sizing: border-box; margin: 0; padding: 0; }
    .aw-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #E6E2D8;
    }
    .aw-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #1B3B2B;
    }
    .aw-badge {
      font-size: 0.72rem;
      color: #4A5D4E;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .aw-badge:hover { text-decoration: underline; }
    .aw-events-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .aw-card {
      background: #F7F5F0;
      border: 1px solid #E6E2D8;
      border-radius: 8px;
      padding: 12px 14px;
      transition: border-color 0.15s ease;
    }
    .aw-card:hover {
      border-color: #4A5D4E;
    }
    .aw-meta {
      font-size: 0.72rem;
      font-weight: 700;
      color: #C85A32;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .aw-event-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #1B3B2B;
      margin-bottom: 6px;
    }
    .aw-event-desc {
      font-size: 0.82rem;
      color: #5C675E;
      margin-bottom: 10px;
      line-height: 1.4;
    }
    .aw-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .aw-btn {
      padding: 5px 10px;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 4px;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: none;
    }
    .aw-btn-cal {
      background: #1B3B2B;
      color: #FFFFFF;
    }
    .aw-btn-cal:hover { opacity: 0.9; }
    .aw-btn-ticket {
      background: #C85A32;
      color: #FFFFFF;
    }
    .aw-btn-ticket:hover { opacity: 0.9; }
    .aw-empty {
      text-align: center;
      padding: 24px 10px;
      font-size: 0.85rem;
      color: #5C675E;
    }
    .aw-footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #E6E2D8;
      text-align: right;
    }
    .aw-sub-link {
      font-size: 0.72rem;
      color: #1B3B2B;
      text-decoration: none;
      font-weight: 600;
    }
    .aw-sub-link:hover { text-decoration: underline; }
  `;

  // Inject Styles once
  function injectStyles() {
    if (document.getElementById('agendaweb-widget-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'agendaweb-widget-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  // Format Date Helper
  function formatEventDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr.replace(' ', 'T'));
    return d.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  // Render a single widget container
  async function initWidget(container) {
    const venueSlug = container.getAttribute('data-venue') || 'all';
    const limit = parseInt(container.getAttribute('data-limit') || '5', 10);
    const apiBase = container.getAttribute('data-api') || defaultApiBase;
    const title = container.getAttribute('data-title') || 'Upcoming Gigs & Live Events';

    container.innerHTML = `
      <div class="aw-widget">
        <div class="aw-header">
          <div class="aw-title">${escapeHtml(title)}</div>
          <a href="${apiBase}" target="_blank" rel="noopener" class="aw-badge">✦ AgendaWeb</a>
        </div>
        <div class="aw-events-list">
          <div class="aw-empty">Loading schedule...</div>
        </div>
      </div>
    `;

    try {
      const url = `${apiBase}/api/events.php?venue=${encodeURIComponent(venueSlug)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      const events = json.data || [];

      renderEvents(container, events, venueSlug, apiBase, title);
    } catch (err) {
      console.warn('AgendaWeb widget failed to fetch remote events:', err);
      // Fallback empty state
      const listEl = container.querySelector('.aw-events-list');
      if (listEl) {
        listEl.innerHTML = '<div class="aw-empty">No upcoming events currently scheduled.</div>';
      }
    }
  }

  function renderEvents(container, events, venueSlug, apiBase, title) {
    const listEl = container.querySelector('.aw-events-list');
    if (!listEl) return;

    if (events.length === 0) {
      listEl.innerHTML = '<div class="aw-empty">No upcoming events currently scheduled.</div>';
      return;
    }

    const cardsHtml = events.map(ev => {
      const dateText = formatEventDate(ev.start_time);
      const calUrl = `${apiBase}/calendar.php?id=${ev.id}`;
      return `
        <article class="aw-card">
          <div class="aw-meta">${escapeHtml(dateText)} · ${escapeHtml(ev.category || 'Event')}</div>
          <div class="aw-event-title">${escapeHtml(ev.title)}</div>
          ${ev.description ? `<p class="aw-event-desc">${escapeHtml(ev.description)}</p>` : ''}
          <div class="aw-actions">
            <a href="${calUrl}" class="aw-btn aw-btn-cal" target="_blank">📅 Add to Calendar</a>
            ${ev.ticket_url ? `<a href="${ev.ticket_url}" class="aw-btn aw-btn-ticket" target="_blank" rel="noopener">Tickets ↗</a>` : ''}
          </div>
        </article>
      `;
    }).join('');

    const subUrl = `webcal://${apiBase.replace(/^https?:\/\//, '')}/calendar.php?venue=${encodeURIComponent(venueSlug)}`;
    const feedUrl = `${apiBase}/feed.php?venue=${encodeURIComponent(venueSlug)}`;

    container.innerHTML = `
      <div class="aw-widget">
        <div class="aw-header">
          <div class="aw-title">${escapeHtml(title)}</div>
          <a href="${apiBase}" target="_blank" rel="noopener" class="aw-badge">✦ AgendaWeb</a>
        </div>
        <div class="aw-events-list">
          ${cardsHtml}
        </div>
        <div class="aw-footer">
          <a href="${subUrl}" class="aw-sub-link">📅 Subscribe (webcal://)</a> · 
          <a href="${feedUrl}" target="_blank" class="aw-sub-link">RSS Feed</a>
        </div>
      </div>
    `;
  }

  // Initialize all widgets on page
  function mountAll() {
    injectStyles();
    const targets = document.querySelectorAll('.agendaweb-widget, #agendaweb-widget');
    targets.forEach(initWidget);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }

  // Expose global for dynamic re-render
  window.AgendaWebWidget = { mount: mountAll };
})();
