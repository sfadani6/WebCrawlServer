// src/api.js
// Simple wrapper for fetch with JSON handling and error checking
export async function fetchJSON(url, options = {}) {
  const opts = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };
  const response = await fetch(url, opts);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }
  // If response has no content (e.g., 204) return null
  if (response.status === 204) return null;
  const data = await response.json();
  return data;
}
