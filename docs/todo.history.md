# 작업 이력

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