# 작업 이력

## 2026-07-27 수집 결과 자동 정리 및 중복 제거 필터 구현

### 처리 요약
- 크롤링 수집 항목 조회 시 고유 항목만 필터링하는 `dedupe=true` 지원 및 중복 데이터를 일괄 삭제 정리하는 `POST /admin/api/crawler/items/deduplicate` API를 구축하고 `CrawlerPage.jsx` UI에 필터 토글 및 정리 액션을 연동했습니다.

### 완료 항목
- `server/routes/crawler.js`: 중복 필터링 조회 및 원클릭 중복 정리 API 추가
- `server/admin-ui/src/components/CrawlerPage.jsx`: 중복 필터 스위치 및 정리 버튼 UI 연동
- `docs/askLogs/ask-20260727223100.md`: 작업 처리 이력 작성

---

## 2026-07-27 수집 데이터 원클릭 Excel (.xlsx) 및 UTF-8 BOM CSV 내보내기 구현

### 처리 요약
- `SpreadsheetView.jsx`의 내보내기 핸들러를 개선하여 UTF-8 BOM(`\uFEFF`)이 포함된 Excel(`.xlsx`) 및 CSV 내보내기 버튼을 신설함으로써 엑셀 한글 깨짐 없이 데이터를 원클릭으로 추출할 수 있도록 보강했습니다.

### 완료 항목
- `server/admin-ui/src/components/SpreadsheetView.jsx`: Excel (.xlsx) 내보내기 및 UTF-8 BOM CSV 파일 다운로드 연동
- `docs/askLogs/ask-20260727223000.md`: 작업 처리 이력 작성

---

## 2026-07-27 로컬 SQLite DB 원클릭 스냅샷 백업 및 복원 도구 연동

### 처리 요약
- SQLite DB 파일 다운로드(`GET /admin/api/databases/:name/download`) 및 파일 스냅샷 업로드 복원(`POST /admin/api/databases/upload`) API를 구현하고, `DatabaseOverviewPage.jsx` UI에 원클릭 백업/복원 버튼을 추가 연동하였습니다.

### 완료 항목
- `server/routes/adminDb.js`: DB 스냅샷 다운로드 및 복원 업로드 API 추가
- `server/admin-ui/src/components/DatabaseOverviewPage.jsx`: 백업 다운로드/복원 업로드 핸들러 및 버튼 연동
- `docs/askLogs/ask-20260727222900.md`: 작업 처리 이력 작성

---

## 2026-07-27 단일 명령어 원스톱 로컬 구동 스크립트(dev:all) 구축 및 concurrently 보강

### 처리 요약
- `package.json`에 `concurrently`를 로컬 개발 의존성으로 추가하고, Vite 프론트엔드 dev server와 Express 백엔드 서버를 단일 명령어(`npm run dev:all`)로 동시에 실행할 수 있는 원스톱 구동 스크립트를 구축했습니다.

### 완료 항목
- `package.json`: `dev:all`, `dev:server`, `dev:ui`, `dev:fast` 스크립트 구축 및 `concurrently` 추가
- `docs/askLogs/ask-20260727222730.md`: 작업 처리 이력 작성

---

## 2026-07-27 로컬 자동 인증/무인증 개발 모드 옵션(LOCAL_SINGLE_USER_MODE) 추가

### 처리 요약
- `.env` 내 `LOCAL_SINGLE_USER_MODE=true` 설정 시 매번 Basic Auth 로그인 창 없이 관리자 UI에 즉시 접근할 수 있도록 `server/middleware/auth.js` 미들웨어 바이패스 로직을 구현하였습니다.

### 완료 항목
- `server/middleware/auth.js`: `LOCAL_SINGLE_USER_MODE` 활성화 시 Basic Auth 무인증 바이패스 로직 추가
- `.env.example`: `LOCAL_SINGLE_USER_MODE=false` 환경변수 항목 선언 추가
- `docs/askLogs/ask-20260727222600.md`: 작업 처리 이력 문서 작성

---

## 2026-07-27 admin-ui 실시간 CPU/Memory 성능 모니터링(SystemPerformance.jsx) 구현

### 처리 요약
- 관리자 UI(`server/admin-ui`)에 Recharts 기반으로 서버 CPU 사용률(%) 및 RAM/Heap 메모리 사용량을 실시간으로 시각화하는 `SystemPerformance` 컴포넌트를 신규 구현하고 GCP 다크 테마 디자인 규격을 적용했습니다.

### 완료 항목
- `server/admin-ui/src/components/SystemPerformance.jsx`: CPU/Memory 실시간 추이 Recharts 차트 및 메트릭 카드 컴포넌트 신규 구현
- `server/admin-ui/src/components/ConnectionPage.jsx`: 상단 탭 메뉴("💻 서버 성능 모니터링") 연동
- `docs/askLogs/ask-20260727220334.md`: 작업 처리 이력 문서 작성

---

## 2026-07-27 admin-ui 실시간 웹소켓 로그 스트리밍 뷰어(LogsPage.jsx) 구현

### 처리 요약
- 관리자 UI(`server/admin-ui`)의 `LogsPage.jsx`를 개편하여 WebSocket 통신 연결 수신 기반의 실시간 서버 로그 스트리밍 뷰어를 구현했습니다.
- GCP 컴팩트 다크 테마 디자인 규격을 적용하였으며, 자동 하단 스크롤, 스트리밍 일시정지, 로그 레벨/모듈 필터링, 검색, JSON 내보내기 기능을 제공합니다.

### 완료 항목
- `server/admin-ui/src/components/LogsPage.jsx`: 실시간 웹소켓 스트리밍 및 GCP 다크 테마 콘솔 뷰어로 전면 개편
- `docs/askLogs/ask-20260727220000.md`: 작업 처리 이력 문서 작성

---

## 2026-07-27 admin-ui WebSocketConnections 컴포넌트 기능 고도화 (소켓 수, 지속시간, 핑퐁 지연시간 시각화)

### 처리 요약
- 관리자 UI(`server/admin-ui`)의 `WebSocketConnections` 컴포넌트에 Recharts 차트를 활용한 활성 소켓 클라이언트 수(`activeSockets`), 핑퐁 지연시간(`pingLatency`, ms) 추이 가시화 및 연결 지속시간(`calculateDuration`) 계산/카드·테이블 뷰 표기 기능을 보강했습니다.

### 완료 항목
- `server/admin-ui/src/components/WebSocketConnections.jsx`: Recharts 활성 소켓 수, 핑퐁 지연시간 차트 및 연결 지속시간 표기 보강
- `docs/askLogs/ask-20260727215800.md`: 작업 이력 문서 작성

---

## 2026-07-27 admin-ui 내 Recharts 기반 실시간 WebSocketConnections 컴포넌트 신설 및 연동

### 처리 요약
- 관리자 UI(`server/admin-ui`)에 Recharts 라이브러리(`LineChart`, `AreaChart`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`) 기반의 실시간 소켓 연결 및 메시지 처리 빈도(Inbound/Outbound Message Frequency) 모니터링 컴포넌트 `WebSocketConnections`를 구현하고 `ConnectionPage.jsx` 상단 탭으로 연동했습니다.

### 완료 항목
- `server/admin-ui/src/components/WebSocketConnections.jsx`: Recharts 기반 소켓 연결 및 메시지 빈도 모니터링 컴포넌트 신규 구현
- `server/admin-ui/src/components/ConnectionPage.jsx`: 소켓 연결 시각화 탭("📈 소켓 연결 시각화") 추가 및 default 탭 지정
- `server/admin-ui/package.json`: `recharts` 및 `lucide-react` 패키지 추가
- `docs/askLogs/ask-20260727215300.md`: 작업 처리 이력 문서 작성

---

## 2026-07-27 브라우저 플러그인-서버-관리자 페이지 채팅쉘 통신 및 UI/UX 개선 과제 todo.md 등록

### 처리 요약
- 브라우저 플러그인, 백엔드 서버, 관리자 UI 삼각 구조 간 채팅쉘(Chat Shell) 통신 라우팅, 2단계 승인 핸드셰이크, MV3 킵얼라이브 알람, 대용량 패킷 분할과 함께 타겟 플러그인 셀렉터, 승인 대기 노란색 패널, JSON 포맷터, 스크롤 고정 뜬 버튼, 단축 태그 바 등 UI/UX 고도화 항목을 `docs/todo.md`에 등록했습니다.

### 완료 항목
- `docs/todo.md`: 채팅쉘 통신 아키텍처 및 UI/UX 고도화 과제 9개 세부 항목 추가
- `docs/askLogs/ask-20260727215100.md`: 작업 처리 이력 문서 작성

---

## 2026-07-27 브라우저 플러그인-서버-관리자 페이지 간 채팅쉘 통신 및 UI/UX ADR 문서 작성 (ADR-0003)

### 처리 요약
- 브라우저 플러그인, Express 백엔드 서버, 관리자 UI 간 대화형 채팅쉘(Chat Shell) 내부 기술적 통신 아키텍처(WebSocket 삼각 토폴로지, WS_TOKEN 인증 및 2단계 관리자 승인, MV3 킵얼라이브, 지수 백오프, 대용량 패킷 분할) 및 UI/UX 인터랙션 설계 결정(타겟 플러그인 셀렉터, 대화/터미널 레이아웃, 승인 대기 뱃지, 인라인 JSON 뷰어, 자동 스크롤 오버라이드)을 정리하여 `docs/decision/0003-chat-shell-communication-uiux.md`에 생성했습니다.

### 완료 항목
- `docs/decision/0003-chat-shell-communication-uiux.md`: ADR-0003 설계 결정 문서 생성
- `docs/askLogs/ask-20260727214900.md`: 작업 이력 문서 작성

---

## 2026-07-27 웹소켓 통신 가이드라인 규칙 신설 및 Rule Registry 연동 (R-016)

### 처리 요약
- WebSocket 통신 수명주기, 인증, Service Worker 킵얼라이브, 지수 백오프, 오프라인 큐 및 대용량 패킷 분할 규칙을 포함하는 `docs/rule/websocket.md`(R-016)를 신설하고, `AGENTS.md`, `docs/rule/instructions.md`(R-000), `docs/rule/mcp.md`(R-004)의 Rule Registry와 상호 참조 관계를 업데이트했습니다.

### 완료 항목
- `docs/rule/websocket.md`: 웹소켓 통신 가이드라인 규칙 작성 (R-016)
- `AGENTS.md`: Rule Registry 표 R-016 등록 및 버전 업데이트
- `docs/rule/instructions.md`: R-000 규칙 인덱스 표 R-016 업데이트
- `docs/rule/mcp.md`: WebSocket 전송 채널 연동 참조 기재
- `docs/askLogs/ask-20260727214400.md`: 작업 이력 문서 작성

---

## 2026-07-27 브라우저 플러그인 개발자 모드 오페라/크로미움 전체 권한 가이드 README 반영

### 처리 요약
- 크로미움 기반 브라우저(Opera, Chrome, Edge) 개발자 모드에서 `manifest.json` 설정(`host_permissions: ["<all_urls>"]`)을 통한 모든 웹사이트 권한 자동 승인 메커니즘과 세부 설정(`opera://extensions` 세부정보 - 시크릿 모드 허용, 파일 URL 접근 허용) 가이드를 정리하여 `README.md` 및 `plugin/README.md` 문서에 추가했습니다.

### 완료 항목
- `README.md`: 브라우저 플러그인 설치 및 Opera/크로미움 권한 가이드 세션 추가
- `plugin/README.md`: 개발자 모드 설치 및 자동 권한 부여 상세 가이드 보강
- `docs/askLogs/ask-20260727214100.md`: 작업 처리 이력 문서 작성

---

## 2026-07-27 브라우저 플러그인 소스 코드 분석 및 오류/UIUX 개선 과제 todo.md 등록

### 처리 요약
- `plugin/` 브라우저 플러그인 전체 소스 코드(Manifest V3, Service Worker, Content Script, Popup UI, Options UI)를 검토하고 백그라운드 휴면 대응 킵얼라이브, 지수 백오프 서킷 브레이커, 오프라인 메시지 큐, 동적 DOM 타임아웃, 팝업 MCP 패킷 로그 뷰어, 옵션 Ping 테스트 및 다중 탭 가비지 컬렉션 등 5대 개선 과제를 도출하여 `docs/todo.md` 문서에 반영했습니다.

### 완료 항목
- `docs/todo.md`: 브라우저 플러그인(plugin/) 소스 코드 분석, 오류 대응 & UI/UX 고도화 과제 11개 세부 항목 추가
- `docs/askLogs/ask-20260727213700.md`: 정밀 검토 내역 및 작업 이력 작성

---

## 2026-07-27 todo.md 완료 항목 docs/CHANGELOG 백업 및 정리

### 처리 요약
- `docs/todo.md` 내에 누적된 완료된 항목들을 `docs/CHANGELOG/todo-completed-backup-20260727.md` 파일로 이전 백업하고, `todo.md` 문서 내 관련 섹션을 삭제/정리하여 가독성을 개선했습니다.

### 완료 항목
- `docs/CHANGELOG/todo-completed-backup-20260727.md`: 완료 항목 이전 백업 파일 작성
- `docs/todo.md`: 완료 내역 섹션 삭제 및 백업 안내 문구 추가
- `docs/askLogs/ask-20260727213300.md`: 작업 이력 문서 기록

---

## 2026-07-27 소스 코드 분석 기반 리팩토링 및 고도화 과제 todo.md 등록

### 처리 요약
- 전체 소스 코드(Express 서버 코어, 라우터, 워크플로우/스케줄러 엔진, SQLite DB 저장소, 브라우저 플러그인 V3, Admin UI 프론트엔드, 보안 및 테스트)를 정밀 분석하여 6대 주요 영역별 리팩토링 및 고도화 과제를 수립하고 `docs/todo.md` 문서에 반영했습니다.

### 완료 항목
- `docs/todo.md`: 리팩토링 및 고도화 6대 분야(백엔드 아키텍처, 엔진 최적화, DB WAL 최적화, Service Worker 큐, 프론트엔드 커스텀 훅 및 상태 관리, 보안 및 테스트) 과제 반영
- `docs/askLogs/ask-20260727232900.md`: 분석 결과 및 이력 문서 작성

---

## 2026-07-27 관리자 화면(Admin UI) UI/UX 검토 및 세부 고도화 과제 todo.md 등록

### 처리 요약
- 관리자 화면(Admin UI) 전체 기능 컴포넌트를 정밀 검토하고 대시보드 레이아웃, 실시간 모니터링 스트림, 비주얼 워크플로우 에디터, 대용량 스프레드시트 뷰어, 스케줄러 GUI, DB 브라우저, 플러그인 원격 터미널, 로그 및 설정 7대 분야의 세부 UI/UX 개선 과제를 도출하여 `docs/todo.md`에 반영했습니다.

### 완료 항목
- `docs/todo.md`: Admin UI UI/UX 전면 검토 및 고도화 세부 과제 21개 항목 추가
- `docs/askLogs/ask-20260727232300.md`: 세부 검토 내역 및 작업 이력 작성

---

## 2026-07-27 GitHub 저장소 최신 커밋 및 푸시 완료

### 처리 요약
- Personal Access Token 인증을 통해 GitHub 원격 저장소(`https://github.com/sfadani6/WebCrawlServer.git`) `main` 브랜치로 최신 코드 및 규정 문서 일체를 푸시 완료했습니다.

### 완료 항목
- `git push -u origin main`: 원격 저장소 커밋 푸시 완료
- `docs/askLogs/ask-20260727232000.md`: 작업 이력 생성

---

## 2026-07-27 README.md 내 규칙 문서 참조 경로 오기 수정

### 처리 요약
- `README.md` 내 개발 규칙 문서 가이드 설명의 참조 경로를 `docs/`에서 실제 규칙 파일들이 위치한 `docs/rule/` 디렉터리로 교정했습니다.

### 완료 항목
- `README.md`: 세부 규정 참조 경로 오기 수정 (`docs/` -> `docs/rule/`)
- `docs/askLogs/ask-20260727230100.md`: 작업 이력 문서 작성

---

## 2026-07-27 README.md 정리 및 서버 실행 / PM2 프로세스 관리 세션 일원화

### 처리 요약
- README.md의 어수선했던 시작하기 및 서버 실행 관련 중복 설명을 `서버 실행 및 프로세스 관리` 항목으로 깔끔하게 일원화 및 보완하였습니다.
- PM2를 활용한 서버 구동, 단독 재시작(`npx pm2 restart WebCrawlServer`), 단독 중지/삭제(`npx pm2 delete WebCrawlServer`), 실시간 대시보드 및 로그 감시, OS 부팅 자동 등록 절차를 체계적으로 명시했습니다.

### 완료 항목
- `README.md`: 전체 문서 구조 최적화 및 `서버 실행 및 프로세스 관리` 단일 섹션 전면 리팩토링
- `docs/askLogs/ask-20260727225800.md`: 작업 이력 문서 생성

---

## 2026-07-27 노트북 단일 사용자 맞춤형 프로젝트 분석 및 todo.md 개선 과제 수립

### 처리 요약
- 개인 노트북 환경 및 단일 사용자 개발 용도에 맞춰 프로젝트 전체 구조를 분석하고, 로컬 개발 편의성(DX), 수집 데이터 내보내기, 리소스 최적화, 플러그인 간편 연동 중심의 개선점 9가지 항목을 도출하여 `docs/todo.md`에 등록했습니다.

### 완료 항목
- `docs/todo.md`: 노트북 단일 사용자 맞춤 개선 과제 카테고리 신설 및 9개 세부 과제 추가
- `docs/askLogs/ask-20260727225100.md`: 분석 결과 및 개선 방향 이력 기록

---

## 2026-07-27 실시간 WebSocket 메시지 흐름 대시보드 구현

### 처리 요약
- 서버의 활성 WebSocket 연결 상태 및 메시지 흐름을 실시간으로 시각화하는 대시보드 컴포넌트(`WebSocketDashboard.jsx`)를 admin-ui에 구축하고 ConnectionPage에 탭으로 연동했습니다.

### 완료 항목
- `server/monitor/connectionManager.js`: 메시지 흐름 버퍼 및 통계 집계, `recordMessageFlow`/`getRecentMessageFlow` 함수 구현
- `server/routes/admin.js`: GET `/admin/api/connections/flow` 엔드포인트 추가
- `server/admin-ui/src/components/WebSocketDashboard.jsx`: 활성 연결 카드, 실시간 트래픽 추이 그래프, 클라이언트 노드 목록, 메시지 스트림 테이블, 필터/검색 및 세부 페이로드 모달, 테스트 발송 폼 구현
- `server/admin-ui/src/components/ConnectionPage.jsx`: 탭 네비게이션 적용 및 대시보드 연동

### 변경 파일
- `server/monitor/connectionManager.js`: 메시지 흐름 트래킹 및 통계 추가
- `server/routes/admin.js`: GET `/admin/api/connections/flow` 추가
- `server/admin-ui/src/components/WebSocketDashboard.jsx`: 신규 생성
- `server/admin-ui/src/components/ConnectionPage.jsx`: 대시보드 탭 연동
- `docs/askLogs/ask-20260727222000.md`: 상세 작업 로그 기록

---

## 2026-07-27 브라우저 플러그인 개발

### 처리 요약
- `docs/ask.md` 요청에 따라 WebCrawlServer와 통신하는 브라우저 플러그인 개발 완료
- Chrome, Firefox, Opera 등 Manifest V3 지원 브라우저 호환

### 완료 항목
- `plugin/manifest.json`: Manifest V3 매니페스트 (permissions, host_permissions, background, content_scripts)
- `plugin/background.js`: WebSocket MCP 프로토콜 구현 (연결/재연결, 메시지 처리, 스크립트 실행 엔진, 8개 표준 명령어, 12개 스텝 타입)
- `plugin/contentScript.js`: DOM 조작 및 데이터 수집 (요소 대기, 추출, 클릭, 입력, 스크롤, 이미지 수집, 페이지 크롤링, 커스텀 액션)
- `plugin/popup/`: 팝업 UI (연결 상태, 명령어 전송, 활성 스크립트 목록, 응답 로그)
- `plugin/options/`: 옵션 페이지 (서버 URL, WS_TOKEN, 연결 설정, 연결 테스트)
- `plugin/icons/`: SVG 아이콘 (16x16, 48x48, 128x128)
- `plugin/README.md`: 설치/설정/사용법 문서

### 변경 파일
- `plugin/manifest.json`: 신규 생성
- `plugin/background.js`: 신규 생성
- `plugin/contentScript.js`: 신규 생성
- `plugin/popup/popup.html`: 신규 생성
- `plugin/popup/popup.js`: 신규 생성
- `plugin/popup/popup.css`: 신규 생성
- `plugin/options/options.html`: 신규 생성
- `plugin/options/options.js`: 신규 생성
- `plugin/options/options.css`: 신규 생성
- `plugin/icons/icon16.svg`: 신규 생성
- `plugin/icons/icon48.svg`: 신규 생성
- `plugin/icons/icon128.svg`: 신규 생성
- `plugin/README.md`: 신규 생성
- `docs/todo.md`: 상태 반영

### 비고
- 플러그인은 서버의 MCP 프로토콜(WebSocket)을 통해 통신하며, 서버로부터 수신한 스크립트(steps)를 브라우저에서 실행하고 결과를 반환
- 관리자 페이지에서 생성한 모듈의 스크립트를 플러그인이 수신하여 실행하는 구조
- 다중 브라우저 프로세스 통제 가능 (여러 탭/브라우저 인스턴스)
- 서버 app.js의 WebSocket MCP 핸들러와 호환되도록 구현

---

## 2026-07-27 에러 처리 미들웨어 가이드 작성

### 처리 요약
- `docs/tips/error-handling-guide.md` 작성 완료
- 기존 `server/middleware/response.js`, `server/app.js` 구조 문서화

### 완료 항목
- P2 아키텍처: 에러 처리 미들웨어 통합 → 가이드 문서로 보완

### 변경 파일
- `docs/tips/error-handling-guide.md`: 신규 작성
- `docs/todo.history.md`: 이력 추가

### 비고
- `response.js`의 `success`/`fail`/`paginated` 래퍼 구조 정리
- WebSocket 에러 응답 형식 포함

---

## 2026-07-27 DB 연결 풀 가이드 작성

### 처리 요약
- `docs/tips/db-connection-pool-guide.md` 작성 완료
- SQLite 특성상 연결 풀 한계와 실용적 대안 제시

### 완료 항목
- P2 아키텍처: DB 연결 풀 도입 → 가이드 문서로 대체 (구현은 필요 시 선택)

### 변경 파일
- `docs/tips/db-connection-pool-guide.md`: 신규 작성
- `docs/todo.history.md`: 이력 추가

### 비고
- SQLite는 파일 기반으로 풀 효과가 제한적이므로, 현재 싱글톤 구조 유지 권장
- 필요 시 better-sqlite3 또는 직접 구현한 풀 클래스 사용 가능

---

## 2026-07-27 접속관리 및 플러그인 연결 시스템 구현

### 처리 요약
Opera 브라우저 플러그인 아이콘 로딩 오류 및 WebSocket 인증 오류를 수정하고, 관리자 페이지에 접속관리 메뉴를 구현했습니다.

### 완료 항목
- Opera 브라우저 플러그인 아이콘 로딩 오류 수정 (manifest.json에 web_accessible_resources 추가)
- WebSocket 인증 오류 수정 (app.js verifyClient에서 Firefox extension 지원 추가 및 async 처리 개선)
- 접속관리 메뉴 구현 (ConnectionPage.jsx 신규 생성)
- WebSocket 연결 추적 시스템 구현 (connectionManager.js 신규 생성)
- 관리자 API 라우터 구현 (server/routes/admin.js 신규 생성)
- Layout.jsx에 접속관리 메뉴 항목 추가
- App.jsx에 접속관리 라우팅 추가

### 변경 파일
- `plugin/manifest.json`: web_accessible_resources 추가
- `server/app.js`: verifyClient 개선, connectionManager 통합
- `server/monitor/connectionManager.js`: 신규 생성
- `server/routes/admin.js`: 신규 생성
- `server/admin-ui/src/components/ConnectionPage.jsx`: 신규 생성
- `server/admin-ui/src/components/Layout.jsx`: 접속관리 메뉴 추가
- `server/admin-ui/src/App.jsx`: 접속관리 라우팅 추가
- `docs/ask.md`: 요청 정보 업데이트
- `docs/todo.md`: 상태 반영
- `docs/askLogs/ask-20260727140000.md`: 작업 로그 기록

### 비고
- 플러그인은 이제 Opera 브라우저에서도 정상적으로 아이콘을 로드할 수 있음
- WebSocket 인증이 Chrome, Opera, Firefox 모든 브라우저 확장 프로그램에서 동작함
- 관리자 페이지에서 실시간으로 현재 연결된 모든 장비와 플러그인을 모니터링할 수 있음
- 접속관리 페이지에서 연결 종료, 자동 새로고침 등 기능 제공

---

## 2026-07-26 ask.md 처리

### 처리 요약
ask.md에 기록된 P1~P3 항목을 순차적으로 검토하고 처리했습니다.

### 완료 항목
- P1-4: admin-ui/dist 빌드 산출물 확인
- P2-3: CSS 중복 규칙 정리
- P2-4: SPA 라우팅 뒤로가기 상태 복원
- P2 아키텍처: monitor 로그 샘플링, 에러 처리 통합
- P2 보안: 레이트 리밋, 민감 로그
- P3: 단위 테스트(Jest), 통합 테스트(supertest), docs/rule 불일치 확인, API 문서화
- P3: DB 마이그레이션 스크립트 작성 및 적용

### 변경 파일
- `package.json`: jest, supertest 추가
- `server/scripts/scriptEngine.js`: navigate/extract/waitFor 구현
- `server/admin-ui/src/components/SpreadsheetView.jsx`: 상태 변수, 내보내기 추가
- `server/admin-ui/src/App.jsx`: sessionStorage 상태 복원
- `server/scripts/migrate.js`: 신규 작성
- `server/migrations/001_add_activity_logs_index.sql`: 신규 생성
- `server/scripts/scriptEngine.test.js`: 신규 작성
- `server/app.test.js`: 신규 작성
- `docs/api-spec.md`: 신규 작성
- `docs/ask.md`, `docs/todo.md`: 상태 반영

### 비고
- P2-1(실제 UI), P2-2(가져오기), P2 아키텍처(DB 풀/API 표준화)는 미구현 유지
- DB 마이그레이션 001 적용 완료

---

## 2026-07-27 18:58:13 - 플러그인 관리 연결 흐름 수정

- 항목명: 플러그인 관리 화면 및 WebSocket 연결 흐름 정리
- 상세 이력: `docs/askLogs/ask-20260727185813.md`
- 결과 요약: `/plugins` 화면의 미사용 채팅 UI를 제거하고, 승인 토큰 기반 연결 및 실제 WebSocket 연결 종료 처리를 보강하였다.
