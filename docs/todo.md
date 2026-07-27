# 현재 작업 (docs/todo.md)

> 본 문서는 AI가 진행 중인 작업의 계획과 상태를 관리하는 문서입니다.
> AGENTS.md 1.6절에 따라 작업 시작 전에 반드시 확인합니다.

---

## 작업 개요

| 항목 | 내용 |
|------|------|
| 프로젝트 | WebCrawlServer |
| 현재 주기 | **브라우저 플러그인 개발 완료** |
| **환경 요구사항** | **모든 설치는 로컬만 허용, 글로벌 설치 금지** |

---

## 완료된 항목

### 브라우저 플러그인 개발 (plugin/)
- `plugin/manifest.json` 생성 (Manifest V3, Chrome/Firefox/Opera 호환)
- `plugin/background.js` 생성 (WebSocket 연결, MCP 메시지 처리, 스크립트 실행 엔진)
- `plugin/contentScript.js` 생성 (DOM 조작, 데이터 수집, 브라우저 자동화)
- `plugin/popup/` 구현 (연결 상태 표시, 명령어 전송, 로그 표시)
- `plugin/options/` 구현 (서버 URL, WS_TOKEN, 연결 설정 관리)
- `plugin/icons/` 생성 (16x16, 48x48, 128x128 SVG 아이콘)
- `plugin/README.md` 작성 (설치 방법, 설정 방법, MCP 프로토콜 설명)

### 플러그인 주요 기능
- WebSocket MCP 프로토콜 완전 구현 (요청/응답, 스크립트, heartbeat, 이벤트)
- 8개 표준 명령어 지원 (open_browser, crawl_page, run_process, stop_process 등)
- 12개 스크립트 스텝 타입 지원 (navigate, click, input, extract, scroll, loop, condition 등)
- 지수 백오프 재연결, heartbeat 유지, 타임아웃 처리
- 다중 브라우저 프로세스 통제 (여러 탭/브라우저 인스턴스)
- 서버 확장 모듈 스크립트 실행 및 결과 반환

---

## 개선 필요 사항 (분석 결과)

### P1: DB 연결 패턴 통일
- `server/db/helper.js`의 싱글톤(cachedDb)과 `adminDb.js`/`crawler.js`의 직접 생성 패턴 혼재
- `adminDb.js`의 `getDb(dbName)`는 매 요청마다 새 연결 생성 후 `db.close()` 호출
- `crawler.js`의 `getDb()`도 동일한 문제
- **제안**: `helper.js`에 `getDbForPath(dbPath)` 함수 추가하여 통일

### P2: adminDb.js 응답 형식 표준화
- 일부 엔드포인트만 `success`/`fail` 래퍼 사용 (restore, crawler)
- 대부분의 엔드포인트는 `res.json()` 직접 사용
- **제안**: 모든 엔드포인트를 `success`/`fail`로 통일

### P2: NLP 라우터 응답 형식 불일치
- `{status: 'ok', sql, params}` 형식 사용
- 다른 API는 `{status: 'success', data}` 또는 `{status: 'error', message}` 형식
- **제안**: `response.js`의 `success`/`fail` 래퍼로 통일

### P3: adminDb.js 복원 시 DB close 조건 버그
- 496, 559줄: `if (dbName.toLowerCase() !== 'main.db') db.close();`
- main.db인 경우 close되지 않아 연결 누수 발생
- **제안**: 조건 제거하고 항상 `db.close()` 호출

### P3: 에러 처리 미들웨어 require 위치
- `server/app.js` 354줄: `app.use` 내부에서 `require('./middleware/response')` 호출
- 모듈 캐싱되지만 가독성을 위해 상단으로 이동 권장

### P3: WebSocket MCP action 더미 응답
- switch-case (275~302줄)가 실제 구현 없이 문자열만 반환
- **제안**: 각 action별 실제 핸들러 연결 또는 제거

### P4: SPA 라우팅 catch-all 범위
- `adminUiRouter`의 `*`가 모든 경로를 잡아 404 핸들러에 도달하지 못함
- 현재는 문제없으나, 향후 REST API 추가 시 충돌 가능

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