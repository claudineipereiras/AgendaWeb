/**
 * AgendaWeb API Client
 * Defined in Docs/API_Spec.md
 */

const AgendaAPI = {
  async getEvents(category = 'all', venue = 'all') {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all' && category !== 'All') params.append('category', category);
      if (venue && venue !== 'all') params.append('venue', venue);

      const res = await fetch(`api/events.php?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('Events API unavailable, using fallback:', err);
      return [];
    }
  },

  async getItems(tab = 'news') {
    try {
      const res = await fetch(`api/items.php?tab=${encodeURIComponent(tab)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn(`Items API for ${tab} unavailable:`, err);
      return [];
    }
  },

  async extractUrl(targetUrl) {
    const res = await fetch(`api/extract.php?url=${encodeURIComponent(targetUrl)}`);
    if (!res.ok) throw new Error('Extraction failed');
    return await res.json();
  }
};

window.agendaAPI = AgendaAPI;
