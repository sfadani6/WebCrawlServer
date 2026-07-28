# ADR-0003: 브라우저 플러그인-서버-관리자 페이지 간 채팅쉘(Chat Shell) 통신 아키텍처 및 UI/UX 설계

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-27
> 검토일: 2026-07-27
> 수정 이유: 브라우저 플러그인, Express 서버, 관리자 페이지 간 대화형 채팅쉘(Chat Shell) 실시간 통신 메커니즘과 UI/UX 패턴 결정 기록
> 관련 문서: AGENTS.md(R-000), docs/rule/architecture.md(R-001), docs/rule/mcp.md(R-004), docs/rule/websocket.md(R-016), docs/rule/admin-design-guide.md
> 영향 범위: server/app.js, plugin/background.js, src/pages/PluginRemoteTerminal.jsx, src/components/ChatShell.jsx
> Breaking Change 여부: 없음 (신규 및 고도화 설계)

---

## 1. 상태
**채택** — 2026-07-27

---

## 2. 배경 및 목적

WebCrawlServer 플랫폼의 **채팅쉘(Chat Shell / Remote Terminal)**은 관리자가 자연어 대화 또는 CLI 명령을 통해 브라우저 플러그인을 원격 제어하고, 실시간 스크래핑 결과·DOM 상태·시스템 로그를 대화형 UI에서 모니터링할 수 있도록 지원하는 핵심 컴포넌트다.

본 문서에서는 브라우저 플러그인(`plugin/background.js`), 서버(`server/app.js`), 관리자 UI(`src/pages/PluginRemoteTerminal.jsx`) 삼각 구조 간의 **내부 기술적 통신 파이프라인**과 **UI/UX 인터랙션 설계 결정**을 통합 명시한다.

---

## 3. 내부 기술적 통신 아키텍처 (Technical Communication Architecture)

### 3.1 삼각 통신 토폴로지 (Triangle Communication Topology)

```
 [ 브라우저 플러그인 ]                         [ 관리자 웹 UI (Chat Shell) ]
 (plugin/background.js)                       (PluginRemoteTerminal.jsx)
        │                                                │
        │ WSS (ws://.../ws?token=WS_TOKEN)               │ WSS (ws://.../ws?token=WS_TOKEN)
        │ clientType="browser_plugin"                    │ clientType="admin_ui"
        ▼                                                ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                 WebCrawlServer (server/app.js)              │
  │   - Client Session Map (`clients<clientId, SessionInfo>`)   │
  │   - Auth Validator (`WS_TOKEN` Verification)                │
  │   - Target Message Router & Event Broadcaster               │
  └─────────────────────────────────────────────────────────────┘
```

1. **클라이언트 세션 라우팅**: Express WebSocket 서버는 연결 수립 시 `clientType`, `clientId`, `requestId`를 부여하고 `clients` Map 메모리 인스턴스에 유지한다.
2. **타겟팅 메시지 브로드캐스팅**: 관리자 UI가 특정 브라우저 플러그인을 타겟 지정하여 명령 전송 시, 서버는 `targetClientId`를 조회하여 해당 소켓 채널로만 메시지를 라우팅한다.
3. **상태 변경 브로드캐스트**: 플러그인의 연결 수립, 승인 완료(`approved`), 연결 끊김 발생 시 서버는 관리자 UI 세션에 실시간 상태 이벤트를 푸시한다.

### 3.2 세션 식별 및 보안/승인 핸드셰이크 (Authentication & Approval)

```
[Plugin] ───── WebSocket Connect (token, clientId) ─────> [Server]
[Plugin] <──── 1008 Policy Violation (Token Invalid) ───── [Server] (토큰 불일치 시 연결 거부)
[Plugin] <──── "pending" Status Notification ───────────── [Server] (정상 토큰 시 승인 대기)
                                                               │
[Admin UI] ─── Approve Action (targetClientId) ─────────> [Server]
[Plugin] <──── "approved" Event Notification ───────────── [Server] (명령 수신 활성화)
```

- **보안 토큰 검증**: `WS_TOKEN` 환경변수를 통한 1차 패스워드 검증.
- **2단계 관리자 승인 (Approval Workflow)**: 연결된 플러그인은 최초 `pending` 상태로 등록되며, 관리자가 채팅쉘 상단의 **"승인(Approve)"** 버튼을 누르기 전까지 백그라운드 스크립트 실행 명령을 수신하지 않는다.

### 3.3 MCP 표준 메시지 페이로드 (Chat Shell Message Envelope)

채팅쉘에서 오가는 모든 데이터는 `docs/rule/mcp.md`(R-004) 및 `docs/rule/websocket.md`(R-016) 규격을 따른다.

```json
{
  "messageId": "msg_1722123456789_a1b2",
  "type": "request | response | event | heartbeat",
  "module": "browser_plugin",
  "action": "run_script | chat_command | capture_dom | get_status",
  "sender": "admin_ui | browser_plugin | server",
  "targetClientId": "plugin_chrome_01",
  "timestamp": 1722123456789,
  "payload": {
    "prompt": "현재 탭의 상품 제목과 가격을 수집해줘",
    "steps": [
      { "type": "waitForElement", "selector": ".product-title" },
      { "type": "extractText", "selector": ".product-title", "variable": "title" }
    ],
    "result": { "status": "success", "data": { "title": "샘플 상품" } }
  }
}
```

### 3.4 신뢰성 및 예외 처리 (Reliability & Fault Tolerance)

1. **Chrome MV3 Keep-alive 알람**: 백그라운드 Service Worker 휴면(30초) 시 소켓 해제를 방지하기 위해 `chrome.alarms`를 활용하여 20초 주기 핑퐁을 수행한다.
2. **지수 백오프 (Exponential Backoff)**: 네트워크 끊김 시 `Math.min(1000 * Math.pow(2, retryCount), 30000)ms` 백오프로 재연결 시도.
3. **오프라인 메세지 큐ing**: 소켓 비활성화 중 발생한 응답 및 수집 로그는 `chrome.storage.local`에 보관 후 연결 즉시 순차 재전송.
4. **대용량 패킷 분할 (Chunking)**: 1MB 이상의 대용량 DOM 스크래핑 패킷은 `totalChunks`, `chunkIndex` 분할 프레임으로 전송 후 서버 재조합.

---

## 4. UI/UX 디자인 및 인터랙션 구조 (UI/UX Design & Interaction Pattern)

### 4.1 채팅쉘 레이아웃 구조 (Chat Shell Screen Structure)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [ 헤더 영역 ]                                                                 │
│ 🔌 브라우저 플러그인 채팅쉘  [ Target Plugin Selector ▼ ] [ 🟢 Connected ] [ 승인 대기 1건 뱃지 ]│
├──────────────────────────────────────────────────────────────────────────────┤
│ [ 대화 및 터미널 출력 영역 (Chat & Terminal Stream Output) ]                    │
│                                                                              │
│  👤 Admin (21:45:10)                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 현재 탭의 네이버 쇼핑 검색 결과 상위 3개 수집해줘                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  🤖 Agent / Plugin (21:45:12) [ ⏱️ 1.2s ]                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 네이버 쇼핑 수집 스크립트를 실행 중입니다...                         │  │
│  │ ────────────────────────────────────────────────────────────────────── │  │
│  │ 1. [완료] 페이지 이동: https://search.shopping.naver.com/...           │  │
│  │ 2. [완료] 요소 감지: .list_basis                                       │  │
│  │ 3. [완료] 데이터 추출: 3건 완료                                        │  │
│  │ [ JSON 결과보기 (클릭하여 펼치기) ]                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ 프롬프트 & CLI 명령어 입력창 (Sticky Bottom Prompt Bar) ]                  │
│  ┌───────────────────────────────────────────────────┬────────────────────┐  │
│  │ 💬 자연어 명령 또는 CLI 스크립트 작성 (Shift+Enter 줄바꿈)...│ 🚀 전송 (Enter)   │  │
│  └───────────────────────────────────────────────────┴────────────────────┘  │
│  [ 숏컷 태그: #DOM수집 ] [ #현재탭스크린샷 ] [ #콘솔로그조회 ] [ 🧹 대화초기화 ]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 주요 UI/UX 컴포넌트 패턴 및 디자인 가이드 준수

1. **시각적 계층 구조 및 색상 체계 (Tailwind CSS 기반)**:
   - 배경: 고대비 라이트/다크 상응 Slate 계열 (`bg-slate-50` / `dark:bg-slate-900`)
   - 사용자 메시지 버블: 브랜드 기본 Indigo (`bg-indigo-600 text-white`)
   - 플러그인 응답 버블: 서브 카드 형태 (`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700`)
   - 터미널 인라인 코드/JSON: 모노스페이스 폰트 (`font-mono text-xs bg-slate-950 text-emerald-400 p-3 rounded-lg`)
2. **타겟 플러그인 빠른 전환 (Target Plugin Switcher)**:
   - 상단 셀렉터 드롭다운을 통해 접속된 브라우저 플러그인(Chrome, Opera, Edge)을 실시간 선택하고, 핑 소요시간(Latency ms) 및 접속 IP를 인라인 표시.
3. **승인 대기 뱃지 및 인라인 액션 (Approval Banner)**:
   - 미승인 플러그인 세션 연결 시 채팅창 상단에 노란색 경고 패널과 **"승인 허용" / "접속 차단"** 인라인 버튼 노출.
4. **인터랙티브 대화 숏컷 및 JSON 포맷터**:
   - 수집 결과 JSON 패킷 클릭 시 접기/펼치기 Accordion 및 **"클립보드 복사"** 원클릭 버튼 제공.
   - 자주 사용하는 셸 명령어 프리셋 숏컷 태그(`#DOM수집`, `#현재탭스크린샷` 등) 클릭 시 입력창에 즉시 바인딩.
5. **자동 스크롤 제어 (Auto-Scroll with Override)**:
   - 신규 스트리밍 로그 수신 시 하단으로 자동 스크롤되되, 사용자가 과거 로그를 조회하기 위해 위로 스크롤한 경우 자동 스크롤을 일시 중단하고 **"⬇️ 최신 로그로 이동"** 뜬 버튼 표시.

---

## 5. 영향 범위 및 파일 구조

| 구분 | 파일 경로 | 역할 |
|---|---|---|
| **서버 통신 코어** | `server/app.js` | WebSocket 서버 수립, `WS_TOKEN` 인증, 세션 맵 관리, 브로드캐스팅 |
| **플러그인 백그라운드** | `plugin/background.js` | Service Worker MV3 킵얼라이브, 소켓 재연결, MCP 수신 및 스크립트 실행 |
| **관리자 UI 메인** | `src/pages/PluginRemoteTerminal.jsx` | 채팅쉘 메인 레이아웃, 타겟 플러그인 상태 관리, 소켓 연결 |
| **채팅쉘 UI 컴포넌트** | `src/components/ChatShell.jsx` | 메시지 버블 스트리밍, JSON 포맷터, CLI 입력 바, 숏컷 태그 |
| **규칙 문서** | `docs/rule/websocket.md` | R-016 웹소켓 프로토콜 규격 및 AI 작성 지침 |

---

## 6. 향후 확장 및 고도화 계획

1. **다중 타겟 동시 전송 (Multi-target Broadcast)**:
   - 여러 브라우저 플러그인에 동일한 수집 명령을 동시에 브로드캐스트하여 분산 크롤링 수행 기능 확장.
2. **AI LLM 자동 제어 루프 연동**:
   - 수집 실패 시 LLM이 에러 로그를 분석하여 대체 Selector 스크립트를 자동 재시도하는 대화형 셀프 힐링(Self-healing) 루프 구현.
