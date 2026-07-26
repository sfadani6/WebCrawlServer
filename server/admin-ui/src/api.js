// src/api.js
// Basic Auth 헤더를 포함한 fetch JSON 래퍼
export async function fetchJSON(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa('admin:admin123')
  };

  const opts = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, opts);
  if (!response.ok) {
    const errText = await response.text();
    let msg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) msg = parsed.error;
      else if (parsed.message) msg = parsed.message;
    } catch (_) {}
    throw new Error(msg);
  }
  if (response.status === 204) return null;
  const data = await response.json();
  return data;
}
