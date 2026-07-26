// src/api.js
// localStorage에 저장된 관리자 자격증명 기반 Authorization 헤더를 포함한 fetch JSON 래퍼

const LS_KEY = 'wcs_admin_credentials';

/** 기본 자격증명 (최초 진입 시) */
const DEFAULT_CREDS = { username: 'adminkim', password: 'akssj#kasjf' };

/**
 * localStorage에서 현재 자격증명을 읽습니다.
 */
export function getStoredCredentials() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return DEFAULT_CREDS;
}

/**
 * 변경된 자격증명을 localStorage에 저장합니다.
 * @param {string} username
 * @param {string} password
 */
export function saveCredentials(username, password) {
  localStorage.setItem(LS_KEY, JSON.stringify({ username, password }));
}

/**
 * 현재 자격증명으로 Base64 Basic Auth 헤더 값을 생성합니다.
 */
function makeAuthHeader() {
  const { username, password } = getStoredCredentials();
  return 'Basic ' + btoa(`${username}:${password}`);
}

/**
 * JSON API 호출 래퍼
 * - Authorization: Basic 헤더 자동 포함
 * - HTTP 오류 시 에러 메시지 파싱하여 throw
 */
export async function fetchJSON(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': makeAuthHeader()
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
  return response.json();
}
