# 현재 작업 (docs/todo.md)

> 본 문서는 AI가 진행 중인 작업의 계획과 상태를 관리하는 문서입니다.
> AGENTS.md 1.6절에 따라 작업 시작 전에 반드시 확인합니다.

---

## 작업 개요

| 항목 | 내용 |
|------|------|
| 프로젝트 | WebCrawlServer |
| 현재 주기 | **접속관리 및 플러그인 연결 시스템 완료** |
| **환경 요구사항** | **모든 설치는 로컬만 허용, 글로벌 설치 금지** |

---

## 완료된 항목 (✅ 완료)

### 1. README.md 문서 정리 및 서버 실행 / PM2 프로세스 관리 세션 보완 (2026-07-27)
- ✅ `README.md` 어수선했던 실행 설명들을 `서버 실행 및 프로세스 관리` 단일 섹션으로 일원화 및 깔끔한 표/코드블록으로 리팩토링
- ✅ PM2 단독 실행, 단독 재시작(`npx pm2 restart WebCrawlServer`), 단독 중지/삭제(`npx pm2 delete WebCrawlServer`), 실시간 대시보드 및 로그 감시, OS 부팅 자동 등록 명령어 명시
- ✅ Express 백엔드 포트 설정(`PORT=3000` 기본, `0.0.0.0` 바인딩) 및 Vite 관리자 UI 빌드(`npm run build`) 필수 과정 체계적 보강

### 2. 실시간 WebSocket 메시지 흐름 대시보드 구현 (2026-07-27)
- ✅ 실시간 WebSocket 메시지 흐름 및 활성 연결 모니터링 대시보드 컴포넌트(`WebSocketDashboard.jsx`) 신규 구현
- ✅ `ConnectionPage.jsx` 상단 탭 네비게이션 추가 및 대시보드 화면 연동
- ✅ `server/monitor/connectionManager.js` 메시지 흐름 링버퍼(최대 100개) 및 누적 통계 수집 기능 추가
- ✅ `server/routes/admin.js` GET `/admin/api/connections/flow` 엔드포인트 구현

### 2. 오류 수정 (2026-07-27)
- ✅ Opera 브라우저 플러그인 아이콘 로딩 오류 수정 (manifest.json)
- ✅ WebSocket 인증 오류 수정 (app.js verifyClient)
- ✅ API 경로 일관성 확보

### 2. 새로운 기능 구현 (2026-07-27)
- ✅ 접속관리 메뉴 구현 (ConnectionPage.jsx)
- ✅ Layout.jsx에 접속관리 메뉴 추가
- ✅ App.jsx에 접속관리 라우팅 추가
- ✅ WebSocket 연결 추적 시스템 구현 (connectionManager.js)
- ✅ server/routes/admin.js 생성 (연결 관리 API)

## 진행 중인 항목 (📋 예정 및 진행 과제)

### 💻 노트북 단일 사용자(Local Single-User) 맞춤 개선 과제

#### 1. 로컬 개발 및 실행 환경 편의성 개선 (DX & Local Launch)
- [x] **로컬 자동 인증/무인증 개발 모드 옵션 추가**:
  - `.env` 내 `LOCAL_SINGLE_USER_MODE=true` 설정 시, 개인 노트북 환경에서 매번 Basic Auth 로그인 창 없이 즉시 관리자 UI에 접근할 수 있도록 자동 바이패스/자동 토큰 주입 미들웨어 옵션 제공.
- [x] **단일 명령어 원스톱 로컬 구동 스크립트 구축**:
  - `package.json`에 로컬 전용 concurrent/dev 구동 스크립트 정리 (UI 빌드 생략 및 Vite dev server + Express backend 동시 시동).
- [x] **로컬 SQLite DB 원클릭 스냅샷 백업 및 복원 도구**:
  - 개인 작업용 DB 데이터 손실 방지를 위한 관리자 UI 상의 단일 클릭 DB 백업/스냅샷 다운로드 및 복원 기능 보강 (`DatabaseOverviewPage.jsx` 연동).

#### 2. 데이터 내보내기 & 크롤링 결과 활용 편의성 강화
- [x] **크롤링 수집 데이터 엑셀/CSV/JSON 로컬 내보내기 보강**:
  - `SpreadsheetView.jsx` 및 `CrawlerPage.jsx`에서 수집된 크롤링 결과를 클릭 한 번으로 `.csv` / `.json` / `.xlsx` 로컬 파일로 즉시 다운로드하는 기능 개선.
- [x] **수집 결과 자동 정리 및 중복 제거 필터**:
  - 크롤러 모듈 수집 결과 데이터베이스에서 URL 또는 키워드 기준 자동 중복 필터링 및 컬럼 별칭 적용 뷰 지원.

#### 3. 노트북 리소스 최적화 및 OS 데스크톱 알림 연동
- [x] **노트북 리소스 최적화 & 로컬 DB 자동 Vacuum**:
  - 개인 노트북 자원 소모 감소를 위해 크롤러/스케줄러 유휴 상태 시 폴링 주기 자동 감소 및 일정 주기마다 SQLite DB 용량 정리(`VACUUM`) 백그라운드 태스크 추가.
- [ ] **워크플로우/크롤러 완료 시 로컬 데스크톱 알림 연동**:
  - 백그라운드 크롤링 및 스케줄러 작업 완료/오류 발생 시 브라우저 Web Notification 또는 시스템 데스크톱 알림 전송.

#### 4. 브라우저 플러그인 로컬 자동 연동 & 디버깅 강화
- [ ] **로컬 루프백(127.0.0.1) 자동 발견 & 미승인 즉시 토큰 발급**:
  - 플러그인 옵션 페이지에서 로컬 서버 탐색 및 `localhost` 접속 시 단일 클릭 간편 토큰 등록 지원.
- [ ] **WebSocketDashboard 로그 내보내기 & 패킷 필터 강화**:
  - `WebSocketDashboard.jsx`에 수신/발신 패킷 로그 JSON 파일 저장 및 특정 이벤트 액션별 모니터링 하이라이트 기능 추가.

---

### 🎨 관리자 화면(Admin UI) UI/UX 전면 검토 및 고도화 과제

#### 1. 대시보드 & 레이아웃 (Dashboard & Global Layout UX)
- [ ] **반응형 대시보드 및 모바일/패드 사이드바 Drawer 개선**:
  - 다양한 해상도(태블릿, 모바일 브라우저)에 맞춘 반응형 사이드바 접힘(Collapsible Drawer) 및 스티키 헤더 최적화.
- [ ] **OverviewPage 메트릭 실시간 자동 새로고침(Auto-refresh) 토글**:
  - 시스템 활성 소켓, 크롤러 및 스케줄러 상태 메트릭 카드의 자동 새로고침 Interval 토글 스위치 및 카운트다운 타이머 UI 배치.
- [ ] **글로벌 검색 및 핫키 모달(`Ctrl + K` / `/`) 도입**:
  - 빠른 메뉴 이동, 특정 워크플로우/모듈/테이블 검색을 지원하는 글로벌 커맨드 팔레트(Command Palette) 도입.
- [ ] **시스템 테마 스위처 및 고대비(High-contrast) 가독성 모드**:
  - 다크/라이트모드 오버레이 전환 시 모듈별 카드 및 데이터 테이블의 명암비/색상 가독성 다듬기.

#### 2. 실시간 모니터링 및 연결 제어 (Connection & WebSocket Dashboard UX)
- [ ] **WebSocketDashboard 스트림 제어 및 일시정지(Freeze/Pause) 기능**:
  - 실시간 수신/발신 MCP 패킷이 빠르게 흘러갈 때 특정 지점에서 스트림을 일시정지하고 패킷 내용을 정밀 점검하는 제어 버튼 추가.
- [ ] **패킷 유형별 필터링 및 텍스트 하이라이팅**:
  - `heartbeat`, `script_execution`, `crawl_page` 등 메시지 타입별 필터 칩 및 JSON 인라인 하이라이팅.
- [ ] **클라이언트 개별 Ping 테스트 및 강제 재연결 인터랙션**:
  - 연결된 브라우저 플러그인 목록에서 특정 클라이언트 선택 후 단일 클릭으로 Ping 도달 시간(ms) 측정 및 연결 리셋 제어.

#### 3. 시각적 워크플로우 에디터 & YAML 동기화 (Visual Workflow Editor UX)
- [ ] **VisualWorkflowEditor 캔버스 제어(Zoom/Pan) 및 스마트 자석 정렬**:
  - 캔버스 확대/축소, 마우스 드래그 이동(Pan), 미니맵(Minimap) 및 노드 간 자동 위치 자석 정렬 가이드라인 제공.
- [ ] **YAML 직접 편집기 - 비주얼 노드 간 양방향 실시간 동기화(Bi-directional Sync)**:
  - YAML 소스 코드 직접 수정 시 비주얼 노드 차트가 즉시 업데이트되며, 스키마 오류 발생 시 인라인 빨간 줄 검증 표기.
- [ ] **워크플로우 드라이런(Dry-run) 시뮬레이터 & 스텝별 디버깅 뷰**:
  - 실제 실행 전 가상 입력 변수로 각 노드의 동작 순서 및 성공/실패 상태(초록/빨강 뱃지)를 시각적으로 추적하는 테스트 모드.

#### 4. 크롤러 및 대용량 그리드 스프레드시트 (Crawler & Spreadsheet View UX)
- [ ] **SpreadsheetView 가상 스크롤(Virtual Scrolling) 적용**:
  - 수집 데이터가 10만 건 이상일 때 브라우저 렌더링 병목을 없애기 위한 가상 스크롤 그리드 엔진 도입.
- [ ] **컬럼 가시성(Column Visibility) 토글 및 드래그 폭 리사이징**:
  - 표시할 컬럼을 자유롭게 선택/숨김 처리하고 컬럼 경계선을 마우스로 드래그하여 폭을 조정하는 기능.
- [ ] **크롤링 진행률(Progress Bar) 및 실시간 스티키 로그 스티치**:
  - 크롤러 실행 시 상단 진행 상태바, 예상 완료 시간(ETA) 및 하단 스티키 콘솔 로그 뷰 제공.

#### 5. 스케줄러 & 데이터베이스 관리자 (Scheduler & DB Browser UX)
- [ ] **SchedulerPage 직관적 Cron GUI 빌더**:
  - 복잡한 Cron 표현식을 매일/매주/특정 시각 마우스 클릭만으로 쉽게 조합하고 다음 실행 예정 시각 5개를 미리 보여주는 뷰어 추가.
- [ ] **DatabaseOverviewPage 테이블별 레코드/용량 시각 차트**:
  - SQLite main.db 테이블별 점유 용량 파이 차트 및 원클릭 `VACUUM`(용량 압축) / 스냅샷 백업 UI 통합.
- [ ] **SQL 직접 실행 터미널의 쿼리 히스토리 및 자동완성**:
  - 자주 쓰는 SQL 쿼리 저장 및 이전 실행 히스토리 재활용 버튼.

#### 6. 플러그인 & 원격 터미널 (Plugins & Remote Terminal UX)
- [ ] **PluginRemoteTerminal 스크린샷 & DOM 요소 선택기 시뮬레이터**:
  - 연결된 브라우저 플러그인의 현재 탭 화면 캡처 뷰어 및 JS 주입 결과 실시간 파싱 콘솔.
- [ ] **플러그인 승인/거부 팝업 및 토큰 원클릭 복사 간편 모달**:
  - 미승인 플러그인 접속 요청 시 즉시 데스크톱/UI 알림 모달 및 단일 클릭 토큰 복사 기능 제공.

#### 7. 시스템 로그 & 설정 (Logs & Settings UX)
- [ ] **LogsPage 로그 레벨별 컬러 뱃지 및 실시간 Tail-f 스트림**:
  - `ERROR`(빨강), `WARN`(노랑), `INFO`(파랑) 컬러 표기 및 신규 로그 발생 시 자동 스크롤 하단 고정 기능.
- [ ] **SettingsPage 자격증명 변경 확인 및 환경변수 상태 헬스 표기**:
  - Basic Auth 비밀번호 변경 시 안전 모달 및 백엔드 주요 환경변수 설정 정상 여부 뱃지 표기.

---

### 🔌 브라우저 플러그인 (plugin/) 소스 코드 분석, 오류 대응 & UI/UX 고도화 과제

#### 1. Manifest V3 Service Worker 수명주기 & 연결 신뢰성 (Service Worker & Connection Health)
- [ ] **Chrome Service Worker 휴면(Idle Shutdown) 대응 킵얼라이브(Keep-alive) 알람 적용**:
  - Service Worker가 30초 후 비활성화될 때 `STATE.ws` 인스턴스 유실 및 `setInterval` 타이머 정지 문제 해결을 위해 `chrome.alarms` 기반 킵얼라이브 구축.
- [ ] **지수 백오프 재연결 및 서버 접속 거부 서킷 브레이커(Circuit Breaker)**:
  - 서버 승인 거부, 토큰 불일치 또는 네트워크 단절 발생 시 무한 접속 요청을 방지하는 최대 재시도 횟수 제한 및 지수 백오프(Exponential Backoff) 구현.
- [ ] **Service Worker 재시동 시 오프라인 메시지 큐(Message Queue) 보관 및 재전송**:
  - WebSocket 비연결 상태에서 백그라운드 이벤트 발생 시 패킷 유실을 방지하기 위해 `chrome.storage.local` 기반 오프라인 큐 보관 및 재연결 즉시 순차 재전송.

#### 2. 콘텐츠 스크립트(contentScript.js) DOM 스크래핑 & 스크립트 실행 오류 개선 (Content Script Robustness)
- [ ] **동적 DOM 요소 및 iFrame/Shadow DOM 타임아웃 예외 처리 강화**:
  - `waitForElement` 스텝 실행 시 Element 존재 여부 감지 타임아웃 예외 핸들링을 강화하고, 접근 불가능한 Cross-origin iFrame 접근 실패 시 명확한 MCP 에러 구조체 반환.
- [ ] **SPA 페이지 이동 감지 및 Content Script 중복 주입 충돌 방지**:
  - `History API`(`pushState`/`replaceState`) 및 `webNavigation` 이벤트를 모니터링하여 단일 페이지 앱 이동 시 자동 스크래핑 컨텍스트 재설정 및 주입 충돌 차단.

#### 3. 플러그인 팝업 UI (popup/popup.html, popup.js) UI/UX 고도화 (Popup UI/UX)
- [ ] **접속 상태 실시간 인디케이터 및 승인 대기(Awaiting Approval) 뱃지 보강**:
  - 미승인 접속 요청 상태(`requestId`)인 경우, 팝업 상단에 노란색 경고 뱃지, 요청 ID 및 "관리자 승인 대기 중" 직관적 레이아웃 표시.
- [ ] **최근 수신/발신 MCP 패킷 실시간 로그 뷰어 & 원클릭 복사 기능**:
  - 팝업 내 최신 20개 MCP 패킷 인라인 JSON 포맷터 뷰어 추가, 자동 하단 스크롤 토글 및 패킷 내용 단일 클릭 복사 버튼 제공.
- [ ] **서버 URL 및 토큰 인라인 조작 숏컷 버튼**:
  - 옵션 페이지로 이동하지 않고도 팝업 화면에서 현 설정 서버 URL을 즉시 확인하고 재연결을 시도할 수 있는 액션 바 추가.

#### 4. 옵션 페이지 (options/options.html, options.js) UI/UX 개선 (Options UI/UX)
- [ ] **WebSocket 서버 URL 유효성 검증 및 핑(Ping / Test Connection) 테스트 버튼**:
  - `ws://` 또는 `wss://` 스킴 입력 유효성 실시간 라이브 검증 및 "서버 연결 테스트" 버튼으로 소켓 도달 가능 여부 사전 확인.
- [ ] **저장된 토큰 마스킹 처리 및 보안 토큰 초기화 모달**:
  - 개인정보/인증 토큰 노출 방지를 위한 토큰 마스킹(`••••••••`) 및 토큰 재발행/초기화 모달 인터랙션 적용.
- [ ] **관리자 페이지 UI/UX 디자인 시스템(Tailwind 기반)과 테마 일치화**:
  - 플러그인 팝업 및 옵션 페이지의 폰트, 다크/라이트 테마 색상 및 버튼 스타일을 Admin UI 디자인 가이드에 맞추어 시각적 통일성 확보.

#### 5. 다중 탭 제어 & 대용량 패킷 분할 전송 (Multi-tab & Large Payload Handling)
- [ ] **닫힌 탭 가비지 컬렉션(Tab Closed Garbage Collection)**:
  - 브라우저 탭 닫힘 이벤트(`chrome.tabs.onRemoved`) 감지 시 `STATE.activeScripts` 및 `tabStates` 메모리에서 즉시 누수 자원 제거.
- [ ] **대용량 수집 데이터 패킷 분할(Chunking) 전송 처리**:
  - 대용량 이미지 Base64 또는 1만 줄 이상의 HTML 스크래핑 데이터 전송 시 메세지 크기 제한으로 인한 소켓 드롭 방지를 위한 패킷 분할 및 백엔드 재조합 로직 보강.

---

### 💬 브라우저 플러그인 - 서버 - 관리자 페이지 채팅쉘 (Chat Shell) 고도화 과제

#### 1. 채팅쉘 내부 통신 아키텍처 및 소켓 연결 신뢰성 (Communication Architecture)
- [ ] **삼각 통신 라우팅(Plugin ↔ Express Server ↔ Admin UI) 및 타겟 세션 바인딩**:
  - `server/app.js` 내 WebSocket 라우팅 레이어를 고도화하여 특정 `targetClientId`를 지정한 메시지만 해당 브라우저 플러그인으로 1:1 전달 및 상태 실시간 브로드캐스팅 구현.
- [ ] **2단계 관리자 승인(Pending ↔ Approved) 소켓 핸드셰이크 흐름 구현**:
  - 플러그인 최초 연결 시 `pending` 상태 보관 및 관리자 UI 상단에서 "승인(Approve)" 처리 시에만 백그라운드 명령 수신 및 실행을 활성화하는 소켓 핸드셰이크 제어.
- [ ] **Chrome MV3 킵얼라이브 알람(`chrome.alarms`) & 오프라인 메세지 큐 연동**:
  - 채팅쉘 소켓 연결 상태에서 Service Worker 비활성화 방지를 위한 20초 주기 핑퐁 알람 적용 및 미연결 시 발송된 채팅 명령 `chrome.storage.local` 큐 저장 후 재연결 시 재전송.
- [ ] **대용량 수집 데이터 패킷 분할(Chunking) 및 백엔드 재조합 엔진**:
  - 대용량 DOM 스크래핑 결과 또는 스크린샷 Base64 수신 시 프레임 크기 초과 방지를 위한 1MB 단위 분할 전송 및 `messageId` 기준 재조합 수신 처리.

#### 2. 채팅쉘 UI/UX & 터미널 인터랙션 고도화 (UI/UX & Terminal Interaction)
- [ ] **타겟 플러그인 빠른 전환 셀렉터(Target Switcher) & 실시간 RTT/상태 표시**:
  - 채팅쉘 상단 헤더에 현재 접속 및 승인된 브라우저 플러그인 목록 드롭다운, 핑 소요시간(Latency ms) 및 접속 IP 인라인 정보 표시.
- [ ] **승인 대기(Awaiting Approval) 노란색 패널 & 원클릭 승인/차단 뱃지**:
  - 미승인 플러그인 접속 시 채팅쉘 상단에 승인 대기 노란색 패널과 원클릭 "승인 허용" / "접속 차단" 인라인 버튼 레이아웃 구현.
- [ ] **JSON 패킷 아코디언 포맷터 & 원클릭 클립보드 복사 버튼**:
  - 플러그인 수집 결과 및 스크립트 실행 응답 JSON 패킷 클릭 시 접기/펼치기 아코디언 및 단일 클릭 결과 복사 버튼 제공.
- [ ] **자동 스크롤 오버라이드 뜬 버튼(Scroll Lock Indicator)**:
  - 새로운 스트리밍 메시지 수신 시 자동 스크롤되되, 사용자가 과거 대화 기록 조회를 위해 위로 스크롤한 경우 스크롤 위치를 고정하고 "⬇️ 최신 로그로 이동" Floating 버튼 표시.
- [ ] **자주 사용하는 자동화 프롬프트 숏컷 태그 Bar (`#DOM수집`, `#스크린샷` 등)**:
  - 입력창 하단에 `#DOM수집`, `#현재탭스크린샷`, `#콘솔로그조회`, `#대화초기화` 단축 태그를 배치하여 클릭 즉시 입력 바에 프롬프트 자동 삽입.

---

### 🛠️ 소스 코드 분석 기반 리팩토링 & 고도화 과제 (Codebase Refactoring & Enhancement Tasks)

#### 1. 백엔드 코어 & 서버 아키텍처 개선 (Backend Core Architecture)
- [ ] **`server/app.js` 모듈화 및 서버 수명주기(Graceful Shutdown) 분리**:
  - Express 어플리케이션 설정, 라우터 등록, WebSocket 서버 인스턴스 생성을 독립 모듈로 분리하고, 프로세스 종료 신호(`SIGTERM`, `SIGINT`) 시 DB 커넥션 및 소켓 서버 안전 정리를 수행하는 Graceful Shutdown 핸들러 구현.
- [ ] **계층화 아키텍처(Layered Architecture) 완전 도입 (`routes/` -> `services/`)**:
  - `server/routes/*.js` 컨트롤러에 포함된 비즈니스 로직 및 DB 직접 접근 코드를 `server/services/` 계층으로 완전 분리하여 관심사 분리(SoC) 달성.
- [ ] **중앙 집중식 커스텀 에러 핸들러 및 비동기 Wrapper 도입**:
  - 반복적인 `try-catch` 블록 제거를 위한 `asyncHandler` 미들웨어 및 표준화된 에러 객체(`AppError`)와 글로벌 에러 처리 미들웨어 구현.
- [ ] **라우트 요청 파라미터 유효성 검증 미들웨어(Schema Validation) 구축**:
  - API 요청 Body 및 Query 파라미터 스키마 검증 미들웨어를 도입하여 잘못된 입력값 차단 및 데이터 안정성 확보.

#### 2. 워크플로우 & 스케줄러 실행 엔진 고도화 (Engine Optimization)
- [ ] **`workflowEngine.js` 실행 컨텍스트 격리 및 메모리 누수 방지**:
  - 대용량 반복문/조건문 실행 시 변수 스코프 격리 강화 및 무한 루프 방지용 최대 뎁스/실행 시간 제한(Timeout) 서킷 브레이커 적용.
- [ ] **비동기 태스크 취소 신호(`AbortController`) 및 재시도 백오프(Exponential Backoff)**:
  - 워크플로우 및 크롤링 노드 실행 실패 시 설정된 횟수만큼 지수 백오프 재시도를 수행하고, 중단 요청 시 실행 중인 비동기 작업을 즉시 멈추는 Cancel Signal 구현.
- [ ] **`jobRunner.js` 태스크 큐 및 동시성 제어 (Concurrency Limiter)**:
  - 동일 스케줄러/모듈 중복 실행 방지 락(Locking) 및 인메모리/SQLite 백킹 태스크 큐를 구성하여 서버 CPU/메모리과부하 방지.

#### 3. SQLite DB & 저장소 관리 최적화 (Database & Persistence)
- [ ] **`server/db/helper.js` SQLite WAL 모드 및 Busy Timeout 최적화**:
  - SQLite동시 쓰기/읽기 락 충돌 방지를 위해 WAL(Write-Ahead Logging) 모드 활성화 및 `busy_timeout` 설정 적용.
- [ ] **안전한 DB 트랜잭션 래퍼 함수 및 커스텀 스키마 동기화 엔진 보강**:
  - 여러 SQL 쿼리를 원자적으로 처리할 수 있는 `db.transaction()` 도 도 도 도입 및 모듈별 `schema.sql` 동적 생성/적용 시 문법 검증 레이어 추가.

#### 4. 브라우저 플러그인 리팩토링 (Extension Manifest V3 Refactoring)
- [ ] **`plugin/background.js` Service Worker 수명주기 대응 및 메세지 큐 구축**:
  - Chrome Manifest V3 Service Worker의 비활성화/재시동 시 WebSocket 연결 상태 복구 및 비대면 상태에서 발생한 패킷을 보관/재전송하는 메시지 큐(Message Queue) 구현.
- [ ] **`contentScript.js` DOM 수집 오버헤드 감소 및 안전한 커스텀 액션 주입**:
  - 대용량 DOM 스크래핑 시 메인 스레드 블로킹 방지를 위한 비동기 chunk 분할 수집 및 오류 방지용 래퍼 함수 적용.

#### 5. 관리자 UI 프론트엔드 코드 구조 개선 (Frontend Refactoring)
- [ ] **API 클라이언트 레벨(`server/admin-ui/src/api.js`) 표준화 및 에러 인터셉터**:
  - API 호출 시 인증 토큰 자동 첨부, 네트워크 에러 시 자동 재시도 및 표준화된 Toast 알림 처리 미들웨어 도입.
- [ ] **대형 컴포넌트 관심사 분리 및 커스텀 훅(Custom Hooks) 추출**:
  - `VisualWorkflowEditor.jsx`, `SpreadsheetView.jsx`, `ConnectionPage.jsx` 내 복잡한 캔버스/그리드 연산 및 소켓 통신 로직을 커스텀 훅으로 분리하여 가독성 개선.
- [ ] **전역 상태 관리(Zustand / Context) 도입을 통한 Props Drilling 해소**:
  - 활성 연결 상태, 사용자 설정, 시스템 테마 및 알림 상태를 관리하는 전역 스토어 구축.

#### 6. 보안, 모니터링 & 테스트 커버리지 강화 (Security & Testing)
- [ ] **Rate Limiting(요청 제한) 및 Security Headers 미들웨어 적용**:
  - `express-rate-limit` 적용으로 무차별 API 호출 방지 및 Helmet 기반 보안 헤더 설정.
- [ ] **핵심 모듈 단위/통합 테스트 코드 확충 (Test Coverage > 80%)**:
  - `server/app.test.js`, 스케줄러 `jobRunner`, `workflowEngine`에 대한 Jest/Supertest 테스트 모듈 추가 작성 및 CI/CD 검증 체계 강화.

---

## 완료된 항목

> ※ `docs/todo.md` 문서 가독성을 위해 이전 완료 내역은 `docs/CHANGELOG/todo-completed-backup-20260727.md` 파일로 백업 이관되었습니다.


---

## 차단 사항 (Blockers)

- **글로벌 설치 금지**: 모든 패키지는 로컬 프로젝트 내에서만 설치해야 함
- **독립적인 환경**: 프로젝트는 자체 포함된 의존성만 사용해야 함
- **서버 구성**: 모든 서버 구성은 로컬 환경에서 동작해야 함

---

## AI 작업 지침 준수 사항

- AGENTS.md 1.1절: 모든 답변은 한글로만 작성
- AGENTS.md 1.3절: 모든 문서는 docs/ 하위에 생성 (예외: AGENTS.md, README.md)
- AGENTS.md 1.6절: 작업 시작 전 문서 확인 순서 준수
- 사용자 요구사항: 모든 설치는 로컬에서만 수행, 글로벌 설치 금지