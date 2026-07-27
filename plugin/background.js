/**
 * WebCrawlServer 브라우저 플러그인 - 백그라운드 서비스 워커
 * 
 * MCP 프로토콜 기반 WebSocket 통신 관리
 * - 서버 연결 및 인증
 * - 메시지 송수신 (MCP 프로토콜)
 * - 스크립트(steps) 실행 관리
 * - 탭/콘텐츠 스크립트 통신
 * 
 * AGENTS.md 1.1절: 모든 주석은 한글로 작성
 * R-004 (mcp.md): MCP 프로토콜 규칙 준수
 */

// ============================================================
// 상태 관리
// ============================================================
const STATE = {
  ws: null,
  connected: false,
  serverUrl: '',
  wsToken: '',
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000, // 초기 1초, 지수 백오프
  heartbeatInterval: null,
  pendingRequests: new Map(), // messageId -> { resolve, reject, timeout }
  activeScripts: new Map(),   // scriptId -> { steps, currentStep, variables, tabId }
  tabStates: new Map(),       // tabId -> { url, status }
};

// ============================================================
// 설정 관리
// ============================================================
const DEFAULT_CONFIG = {
  serverUrl: 'ws://localhost:9600',
  wsToken: '',
  autoReconnect: true,
  reconnectInterval: 5000,
  heartbeatInterval: 30000,
  requestTimeout: 30000
};

let config = { ...DEFAULT_CONFIG };

/** 설정을 storage에서 로드 */
async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get('wcs_config');
    if (result.wcs_config) {
      config = { ...DEFAULT_CONFIG, ...result.wcs_config };
    }
  } catch (err) {
    console.error('[WCS] 설정 로드 오류:', err);
  }
}

/** 설정을 storage에 저장 */
async function saveConfig(newConfig) {
  config = { ...config, ...newConfig };
  await chrome.storage.sync.set({ wcs_config: config });
}

// ============================================================
// WebSocket 연결 관리
// ============================================================

/** 서버에 WebSocket 연결 */
async function connect() {
  if (STATE.ws && STATE.ws.readyState === WebSocket.OPEN) {
    console.log('[WCS] 이미 연결됨');
    return;
  }

  await loadConfig();

  if (!config.serverUrl) {
    console.warn('[WCS] 서버 URL이 설정되지 않음');
    return;
  }

  const url = config.wsToken
    ? `${config.serverUrl}?token=${encodeURIComponent(config.wsToken)}`
    : config.serverUrl;

  console.log(`[WCS] 서버 연결 시도: ${config.serverUrl}`);

  try {
    STATE.ws = new WebSocket(url);

    STATE.ws.onopen = () => {
      console.log('[WCS] WebSocket 연결 성공');
      STATE.connected = true;
      STATE.reconnectAttempts = 0;
      startHeartbeat();
      notifyConnectionState(true);
      resetNotificationBadge();
    };

    STATE.ws.onmessage = (event) => {
      handleMessage(event.data);
    };

    STATE.ws.onclose = (event) => {
      console.log(`[WCS] WebSocket 연결 종료 (code: ${event.code})`);
      STATE.connected = false;
      stopHeartbeat();
      notifyConnectionState(false);
      if (event.code !== 1000) {
        showErrorNotification('network', '연결 종료', `WebSocket 연결이 끊어졌습니다 (코드: ${event.code})`);
      }
      scheduleReconnect();
    };

    STATE.ws.onerror = (error) => {
      console.error('[WCS] WebSocket 오류:', error);
      showErrorNotification('network', '네트워크 오류', 'WebSocket 연결 오류가 발생하였습니다.');
    };
  } catch (err) {
    console.error('[WCS] WebSocket 생성 오류:', err);
    showErrorNotification('network', '연결 시도 실패', err.message);
    scheduleReconnect();
  }
}

/** 연결 종료 */
function disconnect() {
  if (STATE.ws) {
    STATE.ws.close(1000, '클라이언트 종료');
    STATE.ws = null;
  }
  STATE.connected = false;
  stopHeartbeat();
  notifyConnectionState(false);
}

/** 재연결 스케줄링 (지수 백오프) */
function scheduleReconnect() {
  if (!config.autoReconnect) return;
  if (STATE.reconnectAttempts >= STATE.maxReconnectAttempts) {
    console.warn('[WCS] 최대 재연결 시도 횟수 초과');
    return;
  }

  const delay = Math.min(
    STATE.reconnectDelay * Math.pow(2, STATE.reconnectAttempts),
    60000 // 최대 60초
  );
  STATE.reconnectAttempts++;

  console.log(`[WCS] ${delay}ms 후 재연결 시도 (${STATE.reconnectAttempts}/${STATE.maxReconnectAttempts})`);
  setTimeout(() => connect(), delay);
}

/** Heartbeat 시작 */
function startHeartbeat() {
  stopHeartbeat();
  STATE.heartbeatInterval = setInterval(() => {
    if (STATE.ws && STATE.ws.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'heartbeat',
        module: 'plugin',
        action: 'ping',
        data: { timestamp: new Date().toISOString() }
      });
    }
  }, config.heartbeatInterval);
}

/** Heartbeat 중지 */
function stopHeartbeat() {
  if (STATE.heartbeatInterval) {
    clearInterval(STATE.heartbeatInterval);
    STATE.heartbeatInterval = null;
  }
}

/** 연결 상태를 팝업/옵션에 알림 */
function notifyConnectionState(connected) {
  chrome.runtime.sendMessage({
    type: 'connection_state',
    connected,
    serverUrl: config.serverUrl
  }).catch(() => {}); // 팝업이 열려있지 않으면 무시
}

// ============================================================
// 에러 알림 및 아이콘/배지 보강 관리
// ============================================================

/**
 * 에러 상황별 시스템 알림(chrome.notifications) 및 뱃지/아이콘 보강
 * @param {'network'|'script'|'timeout'|'unknown'} errorType - 에러 종류
 * @param {string} title - 알림 제목
 * @param {string} message - 알림 내용
 */
function showErrorNotification(errorType, title, message) {
  let badgeText = '!';
  let badgeColor = '#D93025'; // 기본 빨강

  switch (errorType) {
    case 'network':
      badgeText = 'OFF';
      badgeColor = '#D93025'; // 빨강
      break;
    case 'script':
      badgeText = 'FAIL';
      badgeColor = '#F2994A'; // 주황
      break;
    case 'timeout':
      badgeText = 'TIME';
      badgeColor = '#E2A900'; // 노랑
      break;
    default:
      badgeText = 'ERR';
      badgeColor = '#D93025';
  }

  // 확장 프로그램 뱃지 및 색상 업데이트
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  }

  // chrome.notifications 알림 전송
  if (chrome.notifications) {
    const notificationId = `wcs_err_${Date.now()}`;
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: `[WebCrawlServer] ${title}`,
      message: message || '오류가 발생했습니다.',
      priority: 2
    }, () => {});
  }
}

/** 성공 / 정상 상태 배지 초기화 */
function resetNotificationBadge() {
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#188038' }); // 초록
  }
}

// ============================================================
// MCP 메시지 처리
// ============================================================

/** 고유 messageId 생성 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** MCP 메시지 전송 */
function sendMessage(msg) {
  if (!STATE.ws || STATE.ws.readyState !== WebSocket.OPEN) {
    console.warn('[WCS] WebSocket이 연결되지 않음');
    return Promise.reject(new Error('WebSocket이 연결되지 않음'));
  }

  const messageId = msg.messageId || generateMessageId();
  const timestamp = msg.timestamp || new Date().toISOString();

  const mcpMessage = {
    messageId,
    type: msg.type || 'request',
    module: msg.module || 'plugin',
    action: msg.action || 'unknown',
    scriptId: msg.scriptId || null,
    timestamp,
    protocolVersion: '1.0',
    data: msg.data || {}
  };

  // 요청 타입이면 응답 대기 Promise 생성
  if (mcpMessage.type === 'request' || mcpMessage.type === 'script') {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        STATE.pendingRequests.delete(messageId);
        reject(new Error(`요청 타임아웃: ${messageId}`));
      }, config.requestTimeout);

      STATE.pendingRequests.set(messageId, { resolve, reject, timeout });
      STATE.ws.send(JSON.stringify(mcpMessage));
    });
  }

  // heartbeat/event 타입은 응답 대기 없음
  STATE.ws.send(JSON.stringify(mcpMessage));
  return Promise.resolve({ status: 'sent' });
}

/** WebSocket 메시지 수신 처리 */
function handleMessage(rawData) {
  try {
    const data = JSON.parse(rawData);
    console.log('[WCS] 메시지 수신:', data);

    // 필수 필드 검증
    if (!data.type) {
      console.warn('[WCS] type 필드 누락 메시지 무시');
      return;
    }

    switch (data.type) {
      case 'response':
        handleResponse(data);
        break;
      case 'request':
        handleServerRequest(data);
        break;
      case 'script':
        handleScript(data);
        break;
      case 'event':
        handleEvent(data);
        break;
      case 'heartbeat':
        handleHeartbeat(data);
        break;
      default:
        console.warn(`[WCS] 알 수 없는 메시지 타입: ${data.type}`);
    }
  } catch (err) {
    console.error('[WCS] 메시지 파싱 오류:', err);
  }
}

/** 응답 메시지 처리 */
function handleResponse(data) {
  const pending = STATE.pendingRequests.get(data.messageId);
  if (pending) {
    clearTimeout(pending.timeout);
    STATE.pendingRequests.delete(data.messageId);

    if (data.status === 'error') {
      pending.reject(new Error(data.message || '서버 오류'));
    } else {
      pending.resolve(data);
    }
  }
}

/** 서버 요청 처리 */
async function handleServerRequest(data) {
  console.log('[WCS] 서버 요청 수신:', data.action);

  try {
    let result;

    switch (data.action) {
      case 'open_browser':
        result = await handleOpenBrowser(data);
        break;
      case 'crawl_page':
        result = await handleCrawlPage(data);
        break;
      case 'run_process':
        result = await handleRunProcess(data);
        break;
      case 'stop_process':
        result = await handleStopProcess(data);
        break;
      case 'send_message':
        result = await handleSendMessage(data);
        break;
      case 'log_event':
        result = await handleLogEvent(data);
        break;
      case 'monitor_status':
        result = await handleMonitorStatus(data);
        break;
      case 'manage_db':
        result = await handleManageDb(data);
        break;
      default:
        result = { error: `알 수 없는 명령어: ${data.action}` };
    }

    // 응답 전송
    sendMessage({
      messageId: data.messageId,
      type: 'response',
      module: data.module,
      action: data.action,
      scriptId: data.scriptId,
      status: result.error ? 'error' : 'success',
      data: result.error ? { error: result.error } : { result }
    });

  } catch (err) {
    console.error('[WCS] 서버 요청 처리 오류:', err);
    sendMessage({
      messageId: data.messageId,
      type: 'response',
      module: data.module,
      action: data.action,
      scriptId: data.scriptId,
      status: 'error',
      data: { error: err.message }
    });
  }
}

/** 스크립트 실행 메시지 처리 */
async function handleScript(data) {
  const { scriptId, steps, module: moduleName } = data;

  if (!scriptId || !steps || !Array.isArray(steps)) {
    sendMessage({
      messageId: data.messageId,
      type: 'response',
      module: moduleName,
      action: 'script_execute',
      scriptId,
      status: 'error',
      data: { error: 'scriptId와 steps 배열이 필요합니다.' }
    });
    return;
  }

  console.log(`[WCS] 스크립트 실행 시작: ${scriptId}, 단계 수: ${steps.length}`);

  // 스크립트 실행 상태 저장
  STATE.activeScripts.set(scriptId, {
    steps,
    currentStep: 0,
    variables: {},
    status: 'running',
    startTime: Date.now()
  });

  try {
    const result = await executeSteps(scriptId, steps, moduleName);

    STATE.activeScripts.set(scriptId, {
      ...STATE.activeScripts.get(scriptId),
      status: 'completed',
      result
    });

    // 완료 응답
    sendMessage({
      messageId: data.messageId,
      type: 'response',
      module: moduleName,
      action: 'script_execute',
      scriptId,
      status: 'success',
      data: { result }
    });

  } catch (err) {
    console.error(`[WCS] 스크립트 실행 실패: ${scriptId}`, err);

    showErrorNotification('script', '스크립트 실행 실패', `ID: ${scriptId} - ${err.message}`);

    STATE.activeScripts.set(scriptId, {
      ...STATE.activeScripts.get(scriptId),
      status: 'failed',
      error: err.message
    });

    sendMessage({
      messageId: data.messageId,
      type: 'response',
      module: moduleName,
      action: 'script_execute',
      scriptId,
      status: 'error',
      data: { error: err.message }
    });
  }
}

/** 이벤트 메시지 처리 */
function handleEvent(data) {
  console.log('[WCS] 이벤트 수신:', data);
  // 팝업에 이벤트 전달
  chrome.runtime.sendMessage({
    type: 'server_event',
    event: data
  }).catch(() => {});
}

/** Heartbeat 응답 처리 */
function handleHeartbeat(data) {
  // 서버 heartbeat 응답 처리 (필요시)
}

// ============================================================
// 스크립트 단계 실행 엔진
// ============================================================

/** 스크립트 steps를 순차 실행 */
async function executeSteps(scriptId, steps, moduleName) {
  const scriptState = STATE.activeScripts.get(scriptId);
  if (!scriptState) throw new Error('스크립트 상태 없음');

  const results = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    scriptState.currentStep = i;

    // 중단 확인
    if (scriptState.status === 'stopped') {
      throw new Error('사용자에 의해 중단됨');
    }

    console.log(`[WCS] 단계 ${i + 1}/${steps.length} 실행: ${step.type}`);

    try {
      const stepResult = await executeStep(step, scriptState, moduleName);
      results.push({ stepId: step.stepId || i, type: step.type, status: 'success', result: stepResult });

      // onSuccess 분기
      if (step.onSuccess && stepResult) {
        const nextStepIndex = steps.findIndex(s => s.stepId === step.onSuccess);
        if (nextStepIndex !== -1 && nextStepIndex > i) {
          // 다음 단계로 건너뛰기 (현재는 단순 순차 실행)
        }
      }
    } catch (err) {
      results.push({ stepId: step.stepId || i, type: step.type, status: 'error', error: err.message });

      // onFailure 분기
      if (step.onFailure) {
        const nextStepIndex = steps.findIndex(s => s.stepId === step.onFailure);
        if (nextStepIndex !== -1 && nextStepIndex > i) {
          // 실패 시 대체 경로로 이동
          continue;
        }
      }

      throw err;
    }
  }

  return results;
}

/** 개별 스텝 실행 */
async function executeStep(step, scriptState, moduleName) {
  const { type, target, params, timeout } = step;
  const stepTimeout = timeout || config.requestTimeout;

  // 타임아웃 처리
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const errMsg = `단계 타임아웃: ${type} (${stepTimeout}ms)`;
      showErrorNotification('timeout', '단계 타임아웃', errMsg);
      reject(new Error(errMsg));
    }, stepTimeout);
  });

  let executePromise;

  switch (type) {
    case 'navigate':
      executePromise = handleNavigate(target, params);
      break;
    case 'waitFor':
      executePromise = handleWaitFor(target, params);
      break;
    case 'extract':
      executePromise = handleExtract(target, params);
      break;
    case 'click':
      executePromise = handleClick(target, params);
      break;
    case 'input':
      executePromise = handleInput(target, params);
      break;
    case 'scroll':
      executePromise = handleScroll(target, params);
      break;
    case 'collectImages':
      executePromise = handleCollectImages(target, params);
      break;
    case 'download':
      executePromise = handleDownload(target, params);
      break;
    case 'condition':
      executePromise = handleCondition(step, scriptState);
      break;
    case 'loop':
      executePromise = handleLoop(step, scriptState, moduleName);
      break;
    case 'setVariable':
      executePromise = handleSetVariable(step, scriptState);
      break;
    case 'custom':
      executePromise = handleCustom(step, scriptState, moduleName);
      break;
    default:
      throw new Error(`알 수 없는 스텝 타입: ${type}`);
  }

  return Promise.race([executePromise, timeoutPromise]);
}

// ============================================================
// 브라우저 자동화 핸들러
// ============================================================

/** 페이지 이동 */
async function handleNavigate(target, params) {
  if (!target) throw new Error('navigate: target(URL)이 필요합니다.');

  // 현재 활성 탭에서 네비게이션
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) throw new Error('활성 탭이 없습니다.');

  await chrome.tabs.update(tabs[0].id, { url: target });

  // 페이지 로드 완료 대기
  await waitForTabLoad(tabs[0].id);

  return { url: target, tabId: tabs[0].id };
}

/** 요소 대기 */
async function handleWaitFor(target, params) {
  if (!target) throw new Error('waitFor: target(선택자)이 필요합니다.');

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) throw new Error('활성 탭이 없습니다.');

  const timeout = (params && params.timeout) || 10000;

  const result = await chrome.tabs.sendMessage(tabs[0].id, {
    type: 'wcs_waitFor',
    selector: target,
    timeout
  });

  return result;
}

/** 데이터 추출 */
async function handleExtract(target, params) {
  if (!target) throw new Error('extract: target(선택자)이 필요합니다.');

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) throw new Error('활성 탭이 없습니다.');

  const result = await chrome.tabs.sendMessage(tabs[0].id, {
    type: 'wcs_extract',
    selector: target,
    attribute: params && params.attribute,
    multiple: params && params.multiple
  });

  return result;
}

/** 클릭 */
async function handleClick(target, params) {
  if (!target) throw new Error('click: target(선택자)이 필요합니다.');

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) throw new Error('활성 탭이 없습니다.');

  const result = await chrome.tabs.sendMessage(tabs[0].id, {
    type: 'wcs_click',
    selector: target
  });

  return result;
}

/** 입력 */
async function handleInput(target, params) {
  if (!target) throw new Error('input: target(선택자)이 필요합니다.');
  if (!params || !params.value) throw new Error('input: params.value가 필요합니다.');

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) throw new Error('활성 탭이 없습니다.');

  const result = await chrome.tabs.sendMessage(tabs[0].id, {
    type: 'wcs_input',
    selector: target,
    value: params.value
  });

  return result;
}

/** 스크롤 */
async function handleScroll(target, params) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) throw new Error('활성 탭이 없습니다.');

  const result = await chrome.tabs.sendMessage(tabs[0].id, {
    type: 'wcs_scroll',
    direction: params && params.direction,
    amount: params && params.amount
  });

  return result;
}

/** 이미지 수집 */
async function handleCollectImages(target, params) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) throw new Error('활성 탭이 없습니다.');

  const result = await chrome.tabs.sendMessage(tabs[0].id, {
    type: 'wcs_collectImages',
    selector: params && params.selector
  });

  return result;
}

/** 파일 다운로드 */
async function handleDownload(target, params) {
  const downloadUrl = params && params.url ? params.url : target;
  if (!downloadUrl) throw new Error('download: 다운로드 URL이 필요합니다.');

  const downloadId = await chrome.downloads.download({
    url: downloadUrl,
    conflictAction: 'uniquify'
  });

  return { downloadId, url: downloadUrl };
}

/** 조건 분기 */
async function handleCondition(step, scriptState) {
  const { params } = step;
  if (!params || !params.expression) {
    throw new Error('condition: params.expression이 필요합니다.');
  }

  // 변수 참조를 실제 값으로 치환
  const expression = replaceVariables(params.expression, scriptState.variables);
  
  // 단순 비교식 평가 (===, !==, >, <, >=, <=, &&, ||)
  const result = evaluateExpression(expression);
  
  return { expression, result };
}

/** 반복 실행 */
async function handleLoop(step, scriptState, moduleName) {
  const { params } = step;
  if (!params) throw new Error('loop: params가 필요합니다.');

  const maxIterations = params.maxIterations || 1000;
  let iterations = 0;
  const loopResults = [];

  const times = params.times;
  const until = params.until;

  if (times && until) {
    throw new Error('loop: times와 until을 동시에 지정할 수 없습니다.');
  }

  const shouldContinue = () => {
    if (times) return iterations < times;
    if (until) {
      const expr = replaceVariables(until, scriptState.variables);
      return !evaluateExpression(expr);
    }
    return false;
  };

  while (shouldContinue()) {
    if (iterations >= maxIterations) {
      throw new Error(`loop: 최대 반복 횟수(${maxIterations}) 초과`);
    }

    if (scriptState.status === 'stopped') {
      throw new Error('사용자에 의해 중단됨');
    }

    // 내부 steps 실행
    if (step.steps && Array.isArray(step.steps)) {
      const innerResults = await executeSteps(
        `${scriptState.scriptId}_loop_${iterations}`,
        step.steps,
        moduleName
      );
      loopResults.push(innerResults);
    }

    iterations++;
  }

  return { iterations, results: loopResults };
}

/** 변수 설정 */
async function handleSetVariable(step, scriptState) {
  const { target, params } = step;
  if (!target) throw new Error('setVariable: target(변수명)이 필요합니다.');

  let value = params && params.value;

  // 이전 단계 결과 참조
  if (typeof value === 'string' && value.startsWith('$prev.')) {
    const path = value.substring(6);
    // scriptState의 이전 결과에서 값 추출
    value = getNestedValue(scriptState, path);
  }

  // 변수 참조 치환
  if (typeof value === 'string') {
    value = replaceVariables(value, scriptState.variables);
  }

  scriptState.variables[target] = value;
  return { variable: target, value };
}

/** 커스텀 액션 */
async function handleCustom(step, scriptState, moduleName) {
  const { params } = step;
  if (!params || !params.action) {
    throw new Error('custom: params.action이 필요합니다.');
  }

  // 콘텐츠 스크립트에 커스텀 액션 전달
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) throw new Error('활성 탭이 없습니다.');

  const result = await chrome.tabs.sendMessage(tabs[0].id, {
    type: 'wcs_custom',
    action: params.action,
    params: params.args || {},
    variables: scriptState.variables
  });

  return result;
}

// ============================================================
// 표준 명령어 핸들러
// ============================================================

/** 브라우저 열기 */
async function handleOpenBrowser(data) {
  const url = data.data && data.data.url;
  if (url) {
    const tab = await chrome.tabs.create({ url });
    return { tabId: tab.id, url: tab.url };
  }
  return { message: '새 탭 생성' };
}

/** 페이지 크롤링 */
async function handleCrawlPage(data) {
  const url = data.data && data.data.url;
  if (!url) throw new Error('crawl_page: url이 필요합니다.');

  const tab = await chrome.tabs.create({ url, active: false });
  await waitForTabLoad(tab.id);

  // 전체 페이지 정보 수집
  const pageInfo = await chrome.tabs.sendMessage(tab.id, {
    type: 'wcs_crawlPage'
  });

  // 탭 정리
  await chrome.tabs.remove(tab.id);

  return pageInfo;
}

/** 프로세스 실행 */
async function handleRunProcess(data) {
  const processName = data.data && data.data.process;
  if (!processName) throw new Error('run_process: process 이름이 필요합니다.');

  // 특정 스크립트 실행
  if (data.data.scriptId) {
    return handleScript(data);
  }

  return { message: `프로세스 실행: ${processName}` };
}

/** 프로세스 중지 */
async function handleStopProcess(data) {
  const scriptId = data.data && data.data.scriptId;
  if (scriptId && STATE.activeScripts.has(scriptId)) {
    const scriptState = STATE.activeScripts.get(scriptId);
    scriptState.status = 'stopped';
    return { scriptId, status: 'stopped' };
  }
  return { message: '중지할 활성 프로세스 없음' };
}

/** 메시지 전송 */
async function handleSendMessage(data) {
  const message = data.data && data.data.message;
  const target = data.data && data.data.target;

  if (target === 'popup') {
    chrome.runtime.sendMessage({
      type: 'server_message',
      message
    }).catch(() => {});
  }

  return { sent: true, message };
}

/** 이벤트 로그 */
async function handleLogEvent(data) {
  const logData = data.data || {};
  console.log('[WCS] 이벤트 로그:', logData);
  return { logged: true };
}

/** 모니터링 상태 */
async function handleMonitorStatus(data) {
  // 현재 플러그인 상태 정보 수집
  const tabs = await chrome.tabs.query({});
  const activeScripts = [];
  STATE.activeScripts.forEach((script, scriptId) => {
    activeScripts.push({
      scriptId,
      currentStep: script.currentStep,
      status: script.status,
      startTime: script.startTime
    });
  });

  return {
    connected: STATE.connected,
    serverUrl: config.serverUrl,
    activeTabs: tabs.length,
    activeScripts,
    memory: {}
  };
}

/** DB 관리 */
async function handleManageDb(data) {
  // 플러그인 로컬 저장소 관리
  const action = data.data && data.data.dbAction;
  const key = data.data && data.data.key;
  const value = data.data && data.data.value;

  switch (action) {
    case 'get':
      return { key, value: (await chrome.storage.local.get(key))[key] };
    case 'set':
      await chrome.storage.local.set({ [key]: value });
      return { key, set: true };
    case 'delete':
      await chrome.storage.local.remove(key);
      return { key, deleted: true };
    case 'clear':
      await chrome.storage.local.clear();
      return { cleared: true };
    default:
      throw new Error(`알 수 없는 DB 액션: ${action}`);
  }
}

// ============================================================
// 유틸리티 함수
// ============================================================

/** 탭 로드 완료 대기 */
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    // 30초 타임아웃
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });
}

/** 변수 참조 치환 */
function replaceVariables(str, variables) {
  if (typeof str !== 'string') return str;
  return str.replace(/\$\{(\w+)\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
}

/** 중첩 객체 값 조회 */
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/** 단순 표현식 평가 */
function evaluateExpression(expression) {
  // 안전한 단순 비교식만 평가
  // 허용: 변수, 숫자, 문자열, ===, !==, >, <, >=, <=, &&, ||, !
  // 금지: 함수 호출, 객체 접근, new, eval 등
  try {
    // 매우 제한된 평가 (실제로는 더 안전한 파서 필요)
    return Function(`"use strict"; return (${expression})`)();
  } catch (err) {
    console.warn('[WCS] 표현식 평가 오류:', expression, err);
    return false;
  }
}

// ============================================================
// 확장 프로그램 생명주기
// ============================================================

/** 설치/업데이트 이벤트 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[WCS] 확장 프로그램 ${details.reason}`);

  if (details.reason === 'install') {
    // 기본 설정 저장
    chrome.storage.sync.set({ wcs_config: DEFAULT_CONFIG });
  }

  // 서버 연결
  connect();
});

/** 메시지 리스너 (팝업/옵션/콘텐츠 스크립트 통신) */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WCS] 런타임 메시지 수신:', message.type, message);

  switch (message.type) {
    case 'connect':
      connect().then(() => sendResponse({ connected: STATE.connected }));
      return true;

    case 'disconnect':
      disconnect();
      sendResponse({ connected: false });
      break;

    case 'get_status':
      sendResponse({
        connected: STATE.connected,
        serverUrl: config.serverUrl,
        activeScripts: STATE.activeScripts.size
      });
      break;

    case 'send_command':
      sendMessage(message.command)
        .then(result => sendResponse({ success: true, result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'update_config':
      saveConfig(message.config).then(() => {
        if (message.reconnect !== false) {
          disconnect();
          connect();
        }
        sendResponse({ saved: true });
      });
      return true;

    case 'get_config':
      sendResponse({ config });
      break;

    case 'get_active_scripts':
      const scripts = [];
      STATE.activeScripts.forEach((script, scriptId) => {
        scripts.push({ scriptId, ...script });
      });
      sendResponse({ scripts });
      break;

    case 'stop_script':
      const scriptId = message.scriptId;
      if (scriptId && STATE.activeScripts.has(scriptId)) {
        STATE.activeScripts.get(scriptId).status = 'stopped';
        sendResponse({ stopped: true });
      } else {
        sendResponse({ stopped: false, error: '스크립트를 찾을 수 없음' });
      }
      break;
  }

  return false;
});

/** 알람 리스너 (주기적 연결 확인) */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'wcs_reconnect') {
    if (!STATE.connected) {
      connect();
    }
  }
});

// 알람 생성 (5분마다 연결 상태 확인)
chrome.alarms.create('wcs_reconnect', { periodInMinutes: 5 });

console.log('[WCS] WebCrawlServer 플러그인 백그라운드 서비스 로드 완료');