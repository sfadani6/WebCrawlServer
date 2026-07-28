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
- [ ] **로컬 자동 인증/무인증 개발 모드 옵션 추가**:
  - `.env` 내 `LOCAL_SINGLE_USER_MODE=true` 설정 시, 개인 노트북 환경에서 매번 Basic Auth 로그인 창 없이 즉시 관리자 UI에 접근할 수 있도록 자동 바이패스/자동 토큰 주입 미들웨어 옵션 제공.
- [ ] **단일 명령어 원스톱 로컬 구동 스크립트 구축**:
  - `package.json`에 로컬 전용 concurrent/dev 구동 스크립트 정리 (UI 빌드 생략 및 Vite dev server + Express backend 동시 시동).
- [ ] **로컬 SQLite DB 원클릭 스냅샷 백업 및 복원 도구**:
  - 개인 작업용 DB 데이터 손실 방지를 위한 관리자 UI 상의 단일 클릭 DB 백업/스냅샷 다운로드 및 복원 기능 보강 (`DatabaseOverviewPage.jsx` 연동).

#### 2. 데이터 내보내기 & 크롤링 결과 활용 편의성 강화
- [ ] **크롤링 수집 데이터 엑셀/CSV/JSON 로컬 내보내기 보강**:
  - `SpreadsheetView.jsx` 및 `CrawlerPage.jsx`에서 수집된 크롤링 결과를 클릭 한 번으로 `.csv` / `.json` / `.xlsx` 로컬 파일로 즉시 다운로드하는 기능 개선.
- [ ] **수집 결과 자동 정리 및 중복 제거 필터**:
  - 크롤러 모듈 수집 결과 데이터베이스에서 URL 또는 키워드 기준 자동 중복 필터링 및 컬럼 별칭 적용 뷰 지원.

#### 3. 노트북 리소스 최적화 및 OS 데스크톱 알림 연동
- [ ] **노트북 리소스 최적화 & 로컬 DB 자동 Vacuum**:
  - 개인 노트북 자원 소모 감소를 위해 크롤러/스케줄러 유휴 상태 시 폴링 주기 자동 감소 및 일정 주기마다 SQLite DB 용량 정리(`VACUUM`) 백그라운드 태스크 추가.
- [ ] **워크플로우/크롤러 완료 시 로컬 데스크톱 알림 연동**:
  - 백그라운드 크롤링 및 스케줄러 작업 완료/오류 발생 시 브라우저 Web Notification 또는 시스템 데스크톱 알림 전송.

#### 4. 브라우저 플러그인 로컬 자동 연동 & 디버깅 강화
- [ ] **로컬 루프백(127.0.0.1) 자동 발견 & 미승인 즉시 토큰 발급**:
  - 플러그인 옵션 페이지에서 로컬 서버 탐색 및 `localhost` 접속 시 단일 클릭 간편 토큰 등록 지원.
- [ ] **WebSocketDashboard 로그 내보내기 & 패킷 필터 강화**:
  - `WebSocketDashboard.jsx`에 수신/발신 패킷 로그 JSON 파일 저장 및 특정 이벤트 액션별 모니터링 하이라이트 기능 추가.

---

## 완료된 항목

### 브라우저 플러그인 개발 (plugin/)
- `plugin/manifest.json` 생성 (Manifest V3, Chrome/Firefox/Opera 호환, `notifications` 권한 추가)
- `plugin/background.js` 생성 (WebSocket 연결, MCP 메시지 처리, 스크립트 실행 엔진, 에러 상황별 notification 및 뱃지/아이콘 보강)
- `plugin/contentScript.js` 생성 (DOM 조작, 데이터 수집, 브라우저 자동화)
- `plugin/popup/` 구현 (연결 상태 표시, 명령어 전송, 로그 표시)
- `plugin/options/` 구현 (서버 URL, WS_TOKEN, 연결 설정 관리)
- `plugin/icons/` 생성 (16x16, 48x48, 128x128 SVG 아이콘)
- `plugin/README.md` 작성 (설치 방법, 설정 방법, MCP 프로토콜 설명)

### 관리자 UI 개발 (server/admin-ui/)
- `SettingsPage.jsx` 폼 제출 시 성공/실패 반응형 Toast 알림 컴포넌트 추가 및 폼 제출 알림 개선

### 플러그인 주요 기능
- WebSocket MCP 프로토콜 완전 구현 (요청/응답, 스크립트, heartbeat, 이벤트)
- 8개 표준 명령어 지원 (open_browser, crawl_page, run_process, stop_process 등)
- 12개 스크립트 스텝 타입 지원 (navigate, click, input, extract, scroll, loop, condition 등)
- 지수 백오프 재연결, heartbeat 유지, 타임아웃 처리
- 에러 상황별(네트워크, 스크립트, 타임아웃 등) Chrome Notifications 및 배지/아이콘 시각적 표기
- 다중 브라우저 프로세스 통제 (여러 탭/브라우저 인스턴스)
- 서버 확장 모듈 스크립트 실행 및 결과 반환

---

## 완료된 항목

### 시스템 주요 개선 기능 개발 (server/admin-ui/)
- [x] **시각적 워크플로우 에디터**: 노드 기반 드래그 앤 드롭 워크플로우 설계 기능 (`VisualWorkflowEditor.jsx`) 구현 완료
- [x] **글로벌 다크/라이트모드 지원**: 테마 설정을 통한 운영자용 다크/라이트모드 UI 옵션 및 CSS 변수 전환 기능 추가 (`Layout.jsx`, `index.css`)
- [x] **플러그인 원격 터미널**: 관리자 페이지에서 특정 플러그인의 브라우저 콘솔 로그를 실시간으로 확인하고 JS를 주입하는 디버깅 도구 (`PluginRemoteTerminal.jsx`) 구현 완료
- [x] **SettingsPage Toast 알림**: 폼 제출 시 성공/실패 여부를 사용자에게 알려주는 Toast 알림 컴포넌트 추가

### 관리자 환경 변수 세팅 수용 및 검증 로더 (server/app.js)
- [x] **서버 및 네트워크 보안 설정 (Server & Security)**: `PORT`, `HOST`, `NODE_ENV`, `WS_TOKEN`, `API_KEY`, `ALLOWED_ORIGINS`, `SSL_CERT_PATH` 등 검증 로더 적용
- [x] **관리자 인증 및 세션 설정 (Authentication & Session)**: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, `BASIC_AUTH_ENABLED` 로더 적용
- [x] **크롤러 및 브라우저 자동화 설정 (Crawler & Browser Automation)**: `CRAWLER_MAX_CONCURRENCY`, `CRAWLER_DEFAULT_TIMEOUT`, `CRAWLER_USER_AGENT`, `CHROME_BINARY_PATH`, `HEADLESS_MODE` 검증
- [x] **데이터베이스 및 로깅/모니터링 설정 (Database & Logging/Monitoring)**: `DB_MAIN_PATH`, `DB_CRAWLER_PATH`, `LOG_LEVEL`, `LOG_RETENTION_DAYS`, `LOG_PATH` 적용
- [x] **스케줄러 및 백그라운드 태스크 설정 (Scheduler & Task Queue)**: `SCHEDULER_ENABLED`, `SCHEDULER_CHECK_INTERVAL`, `MAX_RETRY_COUNT`, `RETRY_BACKOFF_MS` 적용

### 서버 / DB 리팩토링 및 기술 부채 해결
- [x] **P1: DB 연결 패턴 통일**: `server/db/helper.js`에 `getDbForPath(dbPath)` 및 공통 쿼리 헬퍼 구현 후 `adminDb.js`와 `crawler.js` 연결 패턴 통일 완료
- [x] **P2: adminDb.js 응답 형식 표준화**: `adminDb.js` 엔드포인트의 응답을 `response.js` 래퍼(`success`/`fail`)로 통일 완료
- [x] **P2: NLP 라우터 응답 형식 불일치 해결**: `server/routes/nlp.js` 응답을 `success`/`fail` 래퍼로 규격 통일 완료
- [x] **P3: adminDb.js 복원 시 DB close 조건 버그 수정**: `adminDb.js` 복원 핸들러 내 main.db 누수 조건문 제거 및 무조건 커넥션 해제 처리 완료
- [x] **P3: 에러 처리 미들웨어 require 위치 개선**: `server/app.js` 내부 동적 `require` 구문을 파일 상단 모듈 로드 섹션으로 이동 완료
- [x] **P3: WebSocket MCP action 처리 보강**: `server/app.js` 내 switch-case 더미 응답 정리 및 표준 응답 핸들링 적용 완료
- [x] **P4: SPA 라우팅 catch-all 범위 조정**: API 404 라우트와 SPA `*` catch-all 핸들러 동작 순서 정돈 완료

### 브라우저 플러그인 개발 (plugin/)
- `plugin/manifest.json` 생성 및 `notifications` 권한 추가 완료
- `plugin/background.js` 생성 (WebSocket 연결, MCP 메시지 처리, 스크립트 실행 엔진, 에러 상황별 notification 및 뱃지/아이콘 시각화)
- `plugin/contentScript.js` 생성 (DOM 조작, 데이터 수집, 브라우저 자동화)
- `plugin/popup/` 및 `plugin/options/` 구현 완료
- `plugin/icons/` 및 `plugin/README.md` 작성 완료

---

## 완료된 항목

### 플러그인 관리 UI (server/admin-ui/)
- [x] **PluginsPage.jsx 신규 생성**: 승인 대기/연결된 플러그인 탭, 서버 연결 정보 패널(WebSocket URL 표시), 승인·거부·연결종료 버튼, 승인 직후 인라인 토큰 표시 기능 구현
- [x] **Layout.jsx 메뉴 항목 추가**: `🔌 플러그인 관리` 메뉴를 원격 터미널 아래에 추가
- [x] **App.jsx 라우팅 추가**: `/plugins` 경로 → `PluginsPage` 연결

---

(현재 등록된 모든 미해결 항목 및 기술 부채 해결 완료)

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