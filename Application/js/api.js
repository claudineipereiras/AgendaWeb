/**
 * AgendaWeb API Client
 * Defined in Docs/API_Spec.md
 */

const AgendaAPI = {
  async getCities() {
    try {
      const res = await fetch('api/cities.php');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('Cities API unavailable:', err);
      return [
        { id: 1, slug: 'melbourne', name: 'Melbourne', state: 'VIC' },
        { id: 2, slug: 'sydney', name: 'Sydney', state: 'NSW' },
        { id: 3, slug: 'brisbane', name: 'Brisbane', state: 'QLD' },
        { id: 4, slug: 'perth', name: 'Perth', state: 'WA' },
        { id: 5, slug: 'adelaide', name: 'Adelaide', state: 'SA' },
        { id: 6, slug: 'hobart', name: 'Hobart', state: 'TAS' }
      ];
    }
  },

  async getEvents(category = 'all', venue = 'all', city = 'melbourne', age = 'all', family = false) {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all' && category !== 'All') params.append('category', category);
      if (venue && venue !== 'all') params.append('venue', venue);
      if (city && city !== 'all') params.append('city', city);
      if (age && age !== 'all') params.append('age', age);
      if (family) params.append('family', '1');

      const res = await fetch(`api/events.php?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return {
        data: json.data || [],
        categories: json.categories || ['All'],
        cities: json.cities || [],
        venues: json.venues || []
      };
    } catch (err) {
      console.warn('Events API unavailable, using fallback:', err);
      return { data: [], categories: ['All', 'Live Music', 'Art', 'Community'], cities: [], venues: [] };
    }
  },

  async getItems(tab = 'news', category = 'all') {
    try {
      const params = new URLSearchParams();
      params.append('tab', tab);
      if (category && category !== 'all' && category !== 'All') params.append('category', category);

      const res = await fetch(`api/items.php?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return {
        data: json.data || [],
        categories: json.categories || ['All']
      };
    } catch (err) {
      console.warn(`Items API for ${tab} unavailable:`, err);
      return { data: [], categories: ['All'] };
    }
  },

  async fetchCustomFeed(feedUrl) {
    try {
      const res = await fetch(`api/proxy_feed.php?url=${encodeURIComponent(feedUrl)}`);
      if (!res.ok) throw new Error(`HTTP proxy error ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Custom feed proxy error:', err);
      return { items: [], categories: ['All'] };
    }
  },

  async extractUrl(targetUrl) {
    const res = await fetch(`api/extract.php?url=${encodeURIComponent(targetUrl)}`);
    if (!res.ok) throw new Error('Extraction failed');
    return await res.json();
  }
};

window.agendaAPI = AgendaAPI;
