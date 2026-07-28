/**
 * WebCrawlServer 브라우저 플러그인 - 팝업 UI 스크립트
 * 
 * 백그라운드 스크립트와 통신하여 상태 표시, 명령 전송, 로그 표시等功能
 * 
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 */

// ============================================================
// DOM 참조
// ============================================================
const $ = (id) => document.getElementById(id);

const statusDot = $('statusDot');
const statusText = $('statusText');
const connectBtn = $('connectBtn');
const serverUrl = $('serverUrl');
const activeScripts = $('activeScripts');
const commandSelect = $('commandSelect');
const commandInput = $('commandInput');
const sendBtn = $('sendBtn');
const scriptList = $('scriptList');
const logContainer = $('logContainer');
const optionsBtn = $('optionsBtn');
const clearLogBtn = $('clearLogBtn');
const connectBtnText = connectBtn.querySelector('span') || connectBtn;

// ============================================================
// 상태 관리
// ============================================================
let isConnected = false;
let statusCheckInterval = null;

// ============================================================
// 초기화
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // 백그라운드에 상태 요청
  getStatus();
  
  // 주기적 상태 확인 (3초)
  statusCheckInterval = setInterval(getStatus, 3000);

  // 이벤트 리스너 등록
  connectBtn.addEventListener('click', toggleConnection);
  sendBtn.addEventListener('click', sendCommand);
  optionsBtn.addEventListener('click', openOptions);
  clearLogBtn.addEventListener('click', clearLog);
  commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendCommand();
  });

  // 백그라운드 메시지 리스너
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'connection_state') {
      updateConnectionStatus(message.connected, message.serverUrl);
    } else if (message.type === 'server_event' || message.type === 'server_message') {
      addLog('이벤트', message.event || message.message);
    }
  });
});

// 창이 닫힐 때 인터벌 정리
window.addEventListener('unload', () => {
  if (statusCheckInterval) clearInterval(statusCheckInterval);
});

// ============================================================
// 상태 관리 함수
// ============================================================

/** 현재 상태 조회 */
function getStatus() {
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response) {
      updateConnectionStatus(response.connected, response.serverUrl);
      activeScripts.textContent = response.activeScripts || 0;
    }
  });
}

/** 연결 상태 업데이트 */
function updateConnectionStatus(connected, url) {
  isConnected = connected;

  if (connected) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = '연결됨';
    connectBtn.textContent = '연결 끊기';
    connectBtn.className = 'btn btn-sm btn-danger';
    serverUrl.textContent = url || '알 수 없음';
  } else {
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = '연결 끊김';
    connectBtn.textContent = '연결';
    connectBtn.className = 'btn btn-sm';
    serverUrl.textContent = '연결 안 됨';
  }

  // 명령어 전송 버튼 상태 업데이트
  sendBtn.disabled = !connected;
}

/** 연결 토글 */
function toggleConnection() {
  const message = isConnected
    ? { type: 'disconnect' }
    : { type: 'connect' };

  chrome.runtime.sendMessage(message, (response) => {
    if (response) {
      updateConnectionStatus(response.connected, '');
    }
  });
}

// ============================================================
// 명령어 전송
// ============================================================

/** 명령어 전송 */
function sendCommand() {
  const action = commandSelect.value;
  const inputValue = commandInput.value.trim();

  if (!isConnected) {
    addLog('오류', '서버에 연결되어 있지 않습니다.');
    return;
  }

  // 입력값 파싱
  let data = {};
  if (inputValue) {
    try {
      // JSON 형식 시도
      data = JSON.parse(inputValue);
    } catch {
      // URL 문자열로 처리
      if (inputValue.startsWith('http://') || inputValue.startsWith('https://')) {
        data = { url: inputValue };
      } else if (action === 'stop_process' || action === 'monitor_status') {
        data = { scriptId: inputValue };
      } else {
        data = { value: inputValue };
      }
    }
  }

  addLog('전송', `${action}: ${JSON.stringify(data)}`);

  // 백그라운드에 명령 전송
  chrome.runtime.sendMessage({
    type: 'send_command',
    command: {
      type: 'request',
      module: 'popup',
      action,
      data
    }
  }, (response) => {
    if (response && response.success) {
      addLog('응답', JSON.stringify(response.result, null, 2));
    } else if (response && response.error) {
      addLog('오류', response.error);
    } else {
      addLog('응답', '응답 없음');
    }

    // 상태 갱신
    getStatus();
  });
}

// ============================================================
// 활성 스크립트 목록
// ============================================================

/** 활성 스크립트 목록 갱신 */
function refreshScripts() {
  chrome.runtime.sendMessage({ type: 'get_active_scripts' }, (response) => {
    if (!response || !response.scripts || response.scripts.length === 0) {
      scriptList.innerHTML = '<div class="empty-state">실행 중인 스크립트 없음</div>';
      return;
    }

    scriptList.innerHTML = '';
    response.scripts.forEach(script => {
      const item = document.createElement('div');
      item.className = 'script-item';
      item.innerHTML = `
        <div class="script-info">
          <span class="script-id">${script.scriptId}</span>
          <span class="script-status ${script.status}">${script.status}</span>
        </div>
        <div class="script-detail">
          단계: ${script.currentStep}/${script.steps ? script.steps.length : '?'}
        </div>
        <button class="btn btn-sm btn-danger stop-btn" data-id="${script.scriptId}">중지</button>
      `;

      // 중지 버튼 이벤트
      item.querySelector('.stop-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: 'stop_script',
          scriptId: script.scriptId
        });
      });

      scriptList.appendChild(item);
    });
  });
}

// ============================================================
// 로그 관리
// ============================================================

/** 로그 추가 */
function addLog(type, message) {
  const time = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${type === '오류' ? 'error' : type === '전송' ? 'send' : 'receive'}`;
  
  // 빈 상태 메시지 제거
  const emptyState = logContainer.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  logEntry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-type">${type}</span>
    <span class="log-message">${escapeHtml(message)}</span>
  `;

  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;

  // 최대 100개 로그 유지
  while (logContainer.children.length > 100) {
    logContainer.removeChild(logContainer.firstChild);
  }
}

/** 로그 지우기 */
function clearLog() {
  logContainer.innerHTML = '<div class="empty-state">로그 없음</div>';
}

// ============================================================
// 유틸리티
// ============================================================

/** HTML 이스케이프 */
function escapeHtml(text) {
  if (typeof text !== 'string') text = String(text);
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** 옵션 페이지 열기 */
function openOptions() {
  chrome.runtime.openOptionsPage();
}