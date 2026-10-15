/**
 * Frontend API Client for communicating with the Smart Recycling Assistant Backend
 */

const API_BASE = window.location.origin;

export async function fetchTelemetry() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/telemetry`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend telemetry fetch error:', err);
    return null;
  }
}

export async function postScanItem(item) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/scan/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend scan item post error:', err);
    return null;
  }
}

export async function postScanImage(base64Image, filename) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/scan/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, filename })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend image scan error:', err);
    return null;
  }
}

export async function purgeFacilityBinApi(category) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/facilities/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend bin purge error:', err);
    return null;
  }
}

export async function postGenAiAdvice(item) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/genai/advise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend GenAI advice error:', err);
    return null;
  }
}

export async function postGenAiChat(query) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/genai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend GenAI chat error:', err);
    return null;
  }
}

export async function fetchAuditLogs(limit = 50, category = null) {
  try {
    let url = `${API_BASE}/api/v1/logs?limit=${limit}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend logs fetch error:', err);
    return null;
  }
}
