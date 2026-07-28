# R-016 웹소켓(WebSocket) 통신 및 실시간 프로토콜 가이드 (websocket.md)

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-27
> 검토일: 2026-07-27
> 수정 이유: 브라우저 플러그인, 관리자 UI 및 MCP 서버 간 WebSocket 연결 수명주기, 인증, 재연결, 킵얼라이브 및 에러 핸들링 AI 개발 가이드라인 신설
> 관련 문서: docs/rule/instructions.md(R-000), docs/rule/mcp.md(R-004), docs/rule/security.md(R-013), docs/rule/auth.md(R-014)
> 영향 범위: WebSocket 서버(server/app.js), 브라우저 플러그인(plugin/background.js), 관리자 UI 실시간 통신
> Breaking Change 여부: 없음

---

## 1. WebSocket 아키텍처 및 연결 수명주기

`WebCrawlServer` 시스템은 서버(Express + `ws` 모듈)와 클라이언트(브라우저 플러그인 `background.js`, 관리자 UI, 외부 MCP 연동 모듈) 간 실시간 양방향 명령 및 통신을 위해 WebSocket을 핵심 채널로 사용한다.

```
[ 브라우저 플러그인 ] <--- WebSocket (ws/wss) ---> [ WebCrawlServer (app.js) ] <--- WebSocket ---> [ 관리자 UI (Admin UI) ]
```

### 1.1 연결 연결 수립 및 인증 흐름 (Connection & Auth)
1. **연결 요청**: 클라이언트는 `ws://<HOST>:<PORT>?token=<WS_TOKEN>&clientType=<type>&clientId=<id>` 연결 URL 및 쿼리 파라미터로 서브프로토콜/토큰을 전달한다.
2. **토큰 검증 (`WS_TOKEN`)**: 서버는 환경 변수 `WS_TOKEN`과 비교 검증하며, 토큰 불일치 시 연결을 거부하고 `1008 (Policy Violation)` 상태 코드로 연결을 종료한다.
3. **플러그인 승인 절차 (Approval Workflow)**:
   - 신규 브라우저 플러그인 접속 시 승인 대기 상태(`pending`)로 클라이언트 맵에 등록한다.
   - 관리자 페이지(`PluginsPage.jsx`)에서 운영자가 접속을 승인(`approve`)할 때까지 명령 수신을 보류한다.
4. **세션 바인딩**: 승인 완료 후 해당 클라이언트에 고유 `requestId` 및 `socketId`를 부여하고 메시지 라우팅 맵에 바인딩한다.

### 1.2 Heartbeat & Health Check 핑퐁
- **서버 핑 (Ping)**: 서버는 주기적(기본 30초)으로 연결된 모든 클라이언트에 `heartbeat` 프레임을 전송한다.
- **클라이언트 응답 (Pong)**: 클라이언트는 `heartbeat` 수신 즉시 `type: "heartbeat"` 응답을 반환하여 활성 상태임을 증명한다.
- **연결 끊김 감지**: 2회 연속 핑 응답이 없거나 소켓 에러 발생 시 서버는 세션을 즉시 정리(`ws.terminate()`)하고 자원을 해제한다.

---

## 2. WebSocket MCP 메시지 규격 및 프레임

모든 WebSocket 데이터 전송은 UTF-8 인코딩된 JSON 문자열 프레임 기반으로 이루어지며, `docs/rule/mcp.md`(R-004)의 표준 구조를 엄격히 준수한다.

### 2.1 공통 메시지 필드 규격
```json
{
  "messageId": "msg_1722123456789_a1b2c3",
  "type": "request | script | response | event | heartbeat | approval",
  "module": "crawler | browser_plugin | system",
  "action": "open_browser | crawl_page | run_script | log_event 등",
  "timestamp": 1722123456789,
  "requestId": "req_plugin_01",
  "payload": { ... }
}
```

### 2.2 메시지 타입 분류 및 용도
- `request`: 서버 또는 관리자가 플러그인/모듈에 전달하는 개별 단일 명령
- `script`: `steps` 배열로 이루어진 복합 자동화 스크립트 실행 요청
- `response`: 명령/스크립트 수행 결과 반환 (`status: "success" | "error"`)
- `event`: 실시간 상태 변경, 콘솔 로그 및 모니터링 메트릭 이벤트 스트리밍
- `heartbeat`: 연결 유지 및 생존 체크용 프레임
- `approval`: 플러그인 연결 승인/거부 통지

---

## 3. 클라이언트 (브라우저 플러그인 background.js) 구현 지침

### 3.1 Chrome Manifest V3 Service Worker 수명주기 대응
- **Idle Shutdown 방지**: Chrome MV3 Service Worker는 30초 간 입출력이 없으면 휴면 상태로 비활성화된다.
- **알람 킵얼라이브 (chrome.alarms)**: `chrome.alarms` 타이머(예: 20초 간격)를 등록하여 Service Worker 재시동 시 WebSocket 연결 인스턴스(`STATE.ws`)가 누락되지 않도록 유지 관리한다.

### 3.2 재연결 및 지수 백오프 (Exponential Backoff)
- 네트워크 단절 또는 서버 재시동 시 즉시 재연결을 시도하되, 서버 과부하 및 무한 루프 접속 시도를 방지하기 위해 지수 백오프 알고리즘을 적용한다.
- **기존 재시도 지연 시간**: `Math.min(1000 * Math.pow(2, retryCount), 30000)ms` (최대 30초 cap).
- **서킷 브레이커**: 서버로부터 인증 실패(`WS_TOKEN` 불일치) 응답을 수신한 경우 재연결을 중단하고 사용자에게 팝업/알림으로 인증 재설정을 안내한다.

### 3.3 오프라인 메시지 큐잉 (Message Queueing)
- WebSocket 미연결 상태에서 백그라운드 이벤트나 수집 결과가 발생한 경우 패킷을 유실하지 않도록 `chrome.storage.local` 내 오프라인 큐에 보관한다.
- WebSocket 연결 수립 및 승인 완료 즉시 오프라인 큐의 메시지를 순차적으로 서버에 재전송 후 큐를 비운다.

---

## 4. 서버 (server/app.js) WebSocket 핸들링 및 세션 관리

### 4.1 클라이언트 세션 맵 관리 (`clients` Map)
- 서버는 접속된 소켓들을 `Map<clientId, { ws, info, pending }>` 구조로 메모리 관리한다.
- 클라이언트 소켓 종료(`close`, `error`) 시 이벤트 핸들러를 통해 맵에서 세션을 제거하고, 연결 해제 이벤트를 관리자 UI에 브로드캐스트한다.

### 4.2 관리자 UI 실시간 로그 & 콘솔 디버깅 스트리밍
- 플러그인 원격 터미널(`PluginRemoteTerminal.jsx`) 및 모니터링 페이지 연결 시, 특정 플러그인에서 발생하는 `console.log` 및 DOM 이벤트 메시지를 해당 관리자 세션 소켓으로 타겟 브로드캐스팅한다.

---

## 5. 예외 처리 & 대용량 패킷 분할 (Chunking)

### 5.1 타임아웃 예외 핸들링
- 스크립트 실행 명령(`script`) 전달 후 지정된 타임아웃(기본 30,000ms) 내 응답(`response`)이 오지 않을 경우, 서버는 스크립트 실행 실패 처리 및 `TIMEOUT_EXCEEDED` 에러 응답을 반환한다.

### 5.2 대용량 스크래핑 데이터 패킷 분할 전송
- 대용량 DOM 스크래핑 결과 또는 Base64 이미지를 WebSocket 단일 프레임으로 전송할 경우 프레임 제한 크기 초과로 소켓이 드롭될 수 있다.
- **분할 전송 규칙**: 1MB 이상의 대용량 페이로드는 `totalChunks`, `chunkIndex`, `chunkData` 필드를 포함하여 분할 전송하고 서버에서 `messageId` 기준으로 재조합한다.

---

## 6. AI 개발자 코드 작성 및 변경 시 준수 체크리스트

1. **소켓 이벤트 핸들러 누수 방지**: `ws.on('message')`, `ws.on('close')` 이벤트 등록 시 중복 등록으로 인한 메모리 누수가 없는지 확인한다.
2. **비동기 예외 캐치**: WebSocket 전송(`ws.send()`) 시 소켓 상태(`ws.readyState === WebSocket.OPEN`)를 반드시 사전 확인하고 `try-catch` 블록으로 전송 오류를 감싼다.
3. **규격 준수**: 모든 메시지 생성 시 `messageId`, `timestamp`, `type`, `action` 필드가 빠짐없이 포함되었는지 검증한다.
