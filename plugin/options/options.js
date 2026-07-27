/**
 * WebCrawlServer 브라우저 플러그인 - 옵션 페이지 스크립트
 * 
 * 서버 연결 설정, WebSocket 토큰, 연결 옵션 관리
 * 
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 */

// ============================================================
// DOM 참조
// ============================================================
const $ = (id) => document.getElementById(id);

const serverUrl = $('serverUrl');
const wsToken = $('wsToken');
const toggleTokenBtn = $('toggleTokenBtn');
const autoReconnect = $('autoReconnect');
const reconnectInterval = $('reconnectInterval');
const heartbeatInterval = $('heartbeatInterval');
const requestTimeout = $('requestTimeout');
const statusDot = $('statusDot');
const statusText = $('statusText');
const connectBtn = $('connectBtn');
const testConnectionBtn = $('testConnectionBtn');
const saveBtn = $('saveBtn');
const resetBtn = $('resetBtn');
const saveMessage = $('saveMessage');
const extensionId = $('extensionId');
const browserInfo = $('browserInfo');
const pluginVersion = $('pluginVersion');

// ============================================================
// 초기화
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 확장 프로그램 정보 표시
  extensionId.textContent = chrome.runtime.id;
  browserInfo.textContent = navigator.userAgent;
  pluginVersion.textContent = chrome.runtime.getManifest().version;

  // 설정 로드
  await loadSettings();

  // 연결 상태 확인
  await refreshStatus();

  // 이벤트 리스너 등록
  toggleTokenBtn.addEventListener('click', toggleTokenVisibility);
  connectBtn.addEventListener('click', toggleConnection);
  testConnectionBtn.addEventListener('click', testConnection);
  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);

  // 백그라운드 메시지 리스너
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'connection_state') {
      updateStatusDisplay(message.connected);
    }
  });
});

// ============================================================
// 설정 관리
// ============================================================

/** 설정 로드 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get_config' }, (response) => {
      if (response && response.config) {
        const cfg = response.config;
        serverUrl.value = cfg.serverUrl || 'ws://localhost:9600';
        wsToken.value = cfg.wsToken || 'default-ws-token';
        autoReconnect.checked = cfg.autoReconnect !== false;
        reconnectInterval.value = (cfg.reconnectInterval || 5000) / 1000;
        heartbeatInterval.value = (cfg.heartbeatInterval || 30000) / 1000;
        requestTimeout.value = (cfg.requestTimeout || 30000) / 1000;
      }
      resolve();
    });
  });
}

/** 설정 저장 */
async function saveSettings() {
  const config = {
    serverUrl: serverUrl.value.trim(),
    wsToken: wsToken.value.trim(),
    autoReconnect: autoReconnect.checked,
    reconnectInterval: parseInt(reconnectInterval.value) * 1000,
    heartbeatInterval: parseInt(heartbeatInterval.value) * 1000,
    requestTimeout: parseInt(requestTimeout.value) * 1000
  };

  // 유효성 검사
  if (!config.serverUrl) {
    showSaveMessage('서버 URL을 입력하세요.', 'error');
    return;
  }

  if (!config.serverUrl.startsWith('ws://') && !config.serverUrl.startsWith('wss://')) {
    showSaveMessage('서버 URL은 ws:// 또는 wss://로 시작해야 합니다.', 'error');
    return;
  }

  chrome.runtime.sendMessage({
    type: 'update_config',
    config,
    reconnect: true
  }, (response) => {
    if (response && response.saved) {
      showSaveMessage('설정이 저장되었습니다. 연결을 다시 시도합니다.', 'success');
    } else {
      showSaveMessage('설정 저장에 실패했습니다.', 'error');
    }
  });
}

/** 설정 초기화 */
function resetSettings() {
  if (!confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) return;

  serverUrl.value = 'ws://localhost:9600';
  wsToken.value = '';
  autoReconnect.checked = true;
  reconnectInterval.value = 5;
  heartbeatInterval.value = 30;
  requestTimeout.value = 30;

  showSaveMessage('설정이 기본값으로 초기화되었습니다. 저장하려면 "설정 저장" 버튼을 클릭하세요.', 'info');
}

/** 저장 메시지 표시 */
function showSaveMessage(text, type) {
  saveMessage.textContent = text;
  saveMessage.className = `save-message save-${type}`;
  saveMessage.style.display = 'block';

  setTimeout(() => {
    saveMessage.style.display = 'none';
  }, 5000);
}

// ============================================================
// 연결 관리
// ============================================================

/** 연결 상태 갱신 */
async function refreshStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
      if (response) {
        updateStatusDisplay(response.connected);
      }
      resolve();
    });
  });
}

/** 상태 표시 업데이트 */
function updateStatusDisplay(connected) {
  if (connected) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = '연결됨';
    connectBtn.textContent = '연결 끊기';
    connectBtn.className = 'btn btn-primary';
  } else {
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = '연결 끊김';
    connectBtn.textContent = '연결';
    connectBtn.className = 'btn';
  }
}

/** 연결 토글 */
function toggleConnection() {
  const message = statusText.textContent === '연결됨'
    ? { type: 'disconnect' }
    : { type: 'connect' };

  chrome.runtime.sendMessage(message, (response) => {
    if (response) {
      updateStatusDisplay(response.connected);
    }
  });
}

/** 연결 테스트 */
async function testConnection() {
  testConnectionBtn.disabled = true;
  testConnectionBtn.textContent = '테스트 중...';

  try {
    const wsUrl = serverUrl.value.trim();
    if (!wsUrl) {
      showSaveMessage('서버 URL을 입력하세요.', 'error');
      return;
    }

    const testUrl = wsToken.value
      ? `${wsUrl}?token=${encodeURIComponent(wsToken.value.trim())}`
      : wsUrl;

    // 5초 타임아웃으로 WebSocket 연결 테스트
    const result = await Promise.race([
      new Promise((resolve, reject) => {
        const testWs = new WebSocket(testUrl);
        testWs.onopen = () => {
          testWs.close(1000, '테스트 완료');
          resolve(true);
        };
        testWs.onerror = () => {
          reject(new Error('연결 실패'));
        };
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('타임아웃')), 5000);
      })
    ]);

    showSaveMessage('서버 연결 테스트 성공!', 'success');
  } catch (err) {
    showSaveMessage(`연결 테스트 실패: ${err.message}`, 'error');
  } finally {
    testConnectionBtn.disabled = false;
    testConnectionBtn.textContent = '연결 테스트';
  }
}

// ============================================================
// 유틸리티
// ============================================================

/** 토큰 표시/숨김 토글 */
function toggleTokenVisibility() {
  if (wsToken.type === 'password') {
    wsToken.type = 'text';
    toggleTokenBtn.textContent = '숨김';
  } else {
    wsToken.type = 'password';
    toggleTokenBtn.textContent = '표시';
  }
}