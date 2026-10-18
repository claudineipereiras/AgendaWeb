/**
 * AgendaWeb Local-First IndexedDB Client Layer
 * Defined in Docs/Frontend_IndexedDB.md
 */

class AgendaDB {
  constructor() {
    this.dbName = 'AgendaWebDB';
    this.dbVersion = 2;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Read Later Store
        if (!db.objectStoreNames.contains('read_later')) {
          const readStore = db.createObjectStore('read_later', { keyPath: 'url' });
          readStore.createIndex('idx_saved_at', 'saved_at', { unique: false });
        }

        // 2. Starred Events Store
        if (!db.objectStoreNames.contains('starred_events')) {
          const eventStore = db.createObjectStore('starred_events', { keyPath: 'id' });
          eventStore.createIndex('idx_start_time', 'start_time', { unique: false });
        }

        // 3. Custom Personal Feeds Store
        if (!db.objectStoreNames.contains('custom_feeds')) {
          db.createObjectStore('custom_feeds', { keyPath: 'feed_url' });
        }

        // 4. User Settings Store
        if (!db.objectStoreNames.contains('user_settings')) {
          db.createObjectStore('user_settings', { keyPath: 'key' });
        }

        // 5. Read Cards Status Store (Check Circle)
        if (!db.objectStoreNames.contains('read_cards')) {
          db.createObjectStore('read_cards', { keyPath: 'id' });
        }

        // 6. Followed Entities Store (Venues, Artists, Organisers)
        if (!db.objectStoreNames.contains('followed_entities')) {
          const followStore = db.createObjectStore('followed_entities', { keyPath: 'name' });
          followStore.createIndex('idx_type', 'type', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // --- Read Later Store ---
  async saveReadItem(item) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('read_later', 'readwrite');
      const store = tx.objectStore('read_later');
      const data = {
        ...item,
        saved_at: item.saved_at || new Date().toISOString()
      };
      const req = store.put(data);
      req.onsuccess = () => resolve(data);
      req.onerror = () => reject(req.error);
    });
  }

  async getReadItems() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('read_later', 'readonly');
      const store = tx.objectStore('read_later');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteReadItem(url) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('read_later', 'readwrite');
      const store = tx.objectStore('read_later');
      const req = store.delete(url);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Starred Events Store ---
  async toggleStarredEvent(event) {
    await this.init();
    const isStarred = await this.isEventStarred(event.id);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('starred_events', 'readwrite');
      const store = tx.objectStore('starred_events');
      if (isStarred) {
        store.delete(event.id);
        resolve(false);
      } else {
        const data = {
          ...event,
          saved_at: new Date().toISOString()
        };
        store.put(data);
        resolve(true);
      }
    });
  }

  async isEventStarred(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('starred_events', 'readonly');
      const store = tx.objectStore('starred_events');
      const req = store.get(id);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getStarredEvents() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('starred_events', 'readonly');
      const store = tx.objectStore('starred_events');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Custom Personal Feeds Store ---
  async addCustomFeed(feed) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('custom_feeds', 'readwrite');
      const store = tx.objectStore('custom_feeds');
      const data = {
        feed_url: feed.feed_url,
        name: feed.name || 'Personal Feed',
        category: feed.category || 'Personal',
        added_at: new Date().toISOString()
      };
      const req = store.put(data);
      req.onsuccess = () => resolve(data);
      req.onerror = () => reject(req.error);
    });
  }

  async getCustomFeeds() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('custom_feeds', 'readonly');
      const store = tx.objectStore('custom_feeds');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteCustomFeed(feedUrl) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('custom_feeds', 'readwrite');
      const store = tx.objectStore('custom_feeds');
      const req = store.delete(feedUrl);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- User Settings Store ---
  async getSetting(key, defaultValue = null) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction('user_settings', 'readonly');
      const store = tx.objectStore('user_settings');
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ? req.result.value : defaultValue);
      };
      req.onerror = () => resolve(defaultValue);
    });
  }

  async setSetting(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('user_settings', 'readwrite');
      const store = tx.objectStore('user_settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllSettings() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('user_settings', 'readonly');
      const store = tx.objectStore('user_settings');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Read Cards Store (Circle Check) ---
  async markCardRead(id, isRead = true) {
    await this.init();
    const key = String(id);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('read_cards', 'readwrite');
      const store = tx.objectStore('read_cards');
      if (isRead) {
        const req = store.put({ id: key, read_at: new Date().toISOString() });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } else {
        const req = store.delete(key);
        req.onsuccess = () => resolve(false);
        req.onerror = () => reject(req.error);
      }
    });
  }

  async isCardRead(id) {
    await this.init();
    const key = String(id);
    return new Promise((resolve) => {
      const tx = this.db.transaction('read_cards', 'readonly');
      const store = tx.objectStore('read_cards');
      const req = store.get(key);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  }

  async toggleCardRead(id) {
    const current = await this.isCardRead(id);
    const next = !current;
    await this.markCardRead(id, next);
    return next;
  }

  async getAllReadCardIds() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction('read_cards', 'readonly');
      const store = tx.objectStore('read_cards');
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map(r => r.id));
      req.onerror = () => resolve([]);
    });
  }

  // --- Followed Entities Store (Venues, Artists, Organisers) ---
  async isEntityFollowed(name) {
    await this.init();
    if (!name) return false;
    return new Promise((resolve) => {
      const tx = this.db.transaction('followed_entities', 'readonly');
      const store = tx.objectStore('followed_entities');
      const req = store.get(name);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  }

  async toggleFollowEntity(name, type = 'venue') {
    await this.init();
    if (!name) return false;
    const isFollowed = await this.isEntityFollowed(name);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('followed_entities', 'readwrite');
      const store = tx.objectStore('followed_entities');
      if (isFollowed) {
        const req = store.delete(name);
        req.onsuccess = () => resolve(false);
        req.onerror = () => reject(req.error);
      } else {
        const data = {
          name: name,
          type: type,
          followed_at: new Date().toISOString()
        };
        const req = store.put(data);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      }
    });
  }

  async getFollowedEntities() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction('followed_entities', 'readonly');
      const store = tx.objectStore('followed_entities');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  // --- Data Portability: Export / Import ---
  async exportBackup() {
    await this.init();
    const backup = {
      version: 2,
      exported_at: new Date().toISOString(),
      user_settings: await this.getAllSettings(),
      starred_events: await this.getStarredEvents(),
      read_later: await this.getReadItems(),
      custom_feeds: await this.getCustomFeeds(),
      read_cards: await this.getAllReadCardIds(),
      followed_entities: await this.getFollowedEntities()
    };
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agendaweb-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importBackup(jsonString) {
    await this.init();
    const data = JSON.parse(jsonString);
    if (!data.version) throw new Error('Invalid backup format');

    const activeStores = ['user_settings', 'starred_events', 'read_later', 'custom_feeds', 'read_cards', 'followed_entities'];
    const tx = this.db.transaction(activeStores, 'readwrite');

    if (data.user_settings) {
      const sStore = tx.objectStore('user_settings');
      data.user_settings.forEach(s => sStore.put(s));
    }
    if (data.starred_events) {
      const eStore = tx.objectStore('starred_events');
      data.starred_events.forEach(e => eStore.put(e));
    }
    if (data.read_later) {
      const rStore = tx.objectStore('read_later');
      data.read_later.forEach(r => rStore.put(r));
    }
    if (data.custom_feeds) {
      const cStore = tx.objectStore('custom_feeds');
      data.custom_feeds.forEach(c => cStore.put(c));
    }
    if (data.read_cards && Array.isArray(data.read_cards)) {
      const rcStore = tx.objectStore('read_cards');
      data.read_cards.forEach(id => rcStore.put({ id: String(id), read_at: new Date().toISOString() }));
    }
    if (data.followed_entities && Array.isArray(data.followed_entities)) {
      const feStore = tx.objectStore('followed_entities');
      data.followed_entities.forEach(fe => feStore.put(fe));
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async exportOpml() {
    const customFeeds = await this.getCustomFeeds();
    const outlines = customFeeds.map(f => 
      `      <outline text="${f.name.replace(/"/g, '&quot;')}" title="${f.name.replace(/"/g, '&quot;')}" type="rss" xmlUrl="${f.feed_url.replace(/"/g, '&quot;')}" category="${(f.category || 'Personal').replace(/"/g, '&quot;')}" />`
    ).join('\n');

    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>AgendaWeb Feeds Export</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    <outline text="AgendaWeb Feeds">
${outlines || '      <!-- No personal feeds added -->'}
    </outline>
  </body>
</opml>`;

    const blob = new Blob([opml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agendaweb-feeds-${new Date().toISOString().slice(0, 10)}.opml`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Global DB instance
window.agendaDB = new AgendaDB();
