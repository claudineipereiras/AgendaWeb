/**
 * AgendaWeb Local-First IndexedDB Client Layer
 * Defined in Docs/Frontend_IndexedDB.md
 */

class AgendaDB {
  constructor() {
    this.dbName = 'AgendaWebDB';
    this.dbVersion = 1;
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

        // 3. Custom Feeds Store
        if (!db.objectStoreNames.contains('custom_feeds')) {
          db.createObjectStore('custom_feeds', { keyPath: 'feed_url' });
        }

        // 4. User Settings Store
        if (!db.objectStoreNames.contains('user_settings')) {
          db.createObjectStore('user_settings', { keyPath: 'key' });
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
}

// Global DB instance
window.agendaDB = new AgendaDB();
