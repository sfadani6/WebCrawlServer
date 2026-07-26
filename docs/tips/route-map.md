# 서버 라우트 맵 (Route Map)

> Version: 1.0.0
> 작성일: 2026-07-27
> 출처: server/app.js, server/routes/*, server/middleware/*

---

## 1. Express 라우트 종합

| 경로 | 메서드 | 설명 | 미들웨어 |
|------|--------|------|----------|
| `/health` | GET | 헬스 체크 | 없음 |
| `/api/stats` | GET | 대시보드 통계 (모듈/워크플로우/잡/로그 카운트) | apiLimiter |
| `/api/activities` | GET | 최근 활동 로그 (limit 파라미터 지원) | apiLimiter |
| `/api/status` | GET | 시스템 상태 (서버/DB/WebSocket/MCP) | apiLimiter |
| `/api/nlp/sql` | POST | 자연어→SQL 변환 (미리보기) | nlpLimiter |
| `/admin/api/databases` | GET | DB 파일 목록 | adminApiLimiter + basicAuth |
| `/admin/api/databases` | POST | 신규 DB 생성 | adminApiLimiter + basicAuth |
| `/admin/api/databases/:name` | DELETE | DB 파일 삭제 (main.db 보호) | adminApiLimiter + basicAuth |
| `/admin/api/tables` | GET | 특정 DB 내 테이블 목록 | adminApiLimiter + basicAuth |
| `/admin/api/tables` | POST | 새 테이블 생성 (DDL) | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name` | DELETE | 테이블 삭제 (코어 테이블 보호) | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name/schema` | GET | 테이블 컬럼 스키마 | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name/rows` | GET | 행 조회 (page/정렬/검색) | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name/rows` | POST | 행 추가 | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name/rows` | DELETE | 다중 행 삭제 | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name/rows/:id` | PUT | 행 수정 | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name/rows/:id` | DELETE | 단일 행 삭제 | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name/backup` | POST | JSON/CSV 백업 내보내기 | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name/restore` | POST | JSON 복원 | adminApiLimiter + basicAuth |
| `/admin/api/tables/:name/restore/csv` | POST | CSV 복원 | adminApiLimiter + basicAuth |
| `/admin/api/config` | GET | config + configattr JOIN 조회 | adminApiLimiter + basicAuth |
| `/admin/api/config` | POST | config 행 추가 | adminApiLimiter + basicAuth |
| `/admin/api/config/:idx` | PUT | config 행 수정 | adminApiLimiter + basicAuth |
| `/admin/api/config/:idx` | DELETE | config 행 삭제 | adminApiLimiter + basicAuth |
| `/admin/api/config_clear` | DELETE | config 전체 초기화 | adminApiLimiter + basicAuth |
| `/admin/api/configattr` | GET | configattr 목록 조회 | adminApiLimiter + basicAuth |
| `/admin/api/configattr` | POST | configattr 항목 추가 | adminApiLimiter + basicAuth |
| `/admin/api/configattr/:idx` | DELETE | configattr 항목 삭제 | adminApiLimiter + basicAuth |
| `/admin/api/auth/info` | GET | 관리자 아이디 조회 | adminApiLimiter + basicAuth |
| `/admin/api/auth/credentials` | PUT | 관리자 아이디/비번 변경 | adminApiLimiter + basicAuth |
| `/admin/api/crawler/targets` | GET | 크롤러 타겟 목록 | adminApiLimiter + basicAuth |
| `/admin/api/crawler/targets/:id` | GET | 크롤러 타겟 상세 | adminApiLimiter + basicAuth |
| `/admin/api/crawler/targets` | POST | 크롤러 타겟 생성 | adminApiLimiter + basicAuth |
| `/admin/api/crawler/targets/:id` | PUT | 크롤러 타겟 수정 | adminApiLimiter + basicAuth |
| `/admin/api/crawler/targets/:id` | DELETE | 크롤러 타겟 삭제 | adminApiLimiter + basicAuth |
| `/admin/api/crawler/items` | GET | 크롤러 아이템 목록 (target_id 필터) | adminApiLimiter + basicAuth |
| `/database` | GET* | SPA 관리 콘솔 | adminUiRouter |
| `/modules` | GET* | SPA 관리 콘솔 | adminUiRouter |
| `/workflows` | GET* | SPA 관리 콘솔 | adminUiRouter |
| `/scheduler` | GET* | SPA 관리 콘솔 | adminUiRouter |
| `/logs` | GET* | SPA 관리 콘솔 | adminUiRouter |
| `/settings` | GET* | SPA 관리 콘솔 | adminUiRouter |
| `/admin` | GET* | SPA 관리 콘솔 | adminUiRouter |
| `/` | GET* | SPA 관리 콘솔 (루트) | adminUiRouter |
| `/static/*` | GET | 정적 파일 (CSS/JS) | express.static |

---

## 2. WebSocket 이벤트

### 2.1 서버 → 클라이언트 (발신)

| 이벤트 타입 | 설명 | 발신 시점 |
|-------------|------|----------|
| `heartbeat` | 연결 확인 메시지 | 연결 직후 |
| `response` | MCP 명령어 응답 | 모든 메시지 처리 후 |
| `type: 'response', status: 'error'` | MCP 필드 검증 오류 | 필수 필드 누락 시 |
| `type: 'response', status: 'error'` | 메시지 파싱 오류 | JSON 파싱 실패 시 |

### 2.2 클라이언트 → 서버 (수신)

| 필드 | 설명 | 필수 |
|------|------|------|
| `messageId` | 메시지 고유 ID | 필수 |
| `type` | 메시지 타입 (`request`, `script`, `response`, `event`, `heartbeat`) | 필수 |
| `module` | 모듈명 | 필수 |
| `action` | 명령어 (`open_browser`, `crawl_page`, `run_process`, `stop_process`, `send_message`, `log_event`, `monitor_status`, `manage_db`) | 필수 |
| `timestamp` | 타임스탬프 | 필수 |
| `protocolVersion` | 프로토콜 버전 | 필수 |
| `scriptId` | 스크립트 ID (type=script 시 필수) | 조건부 |

### 2.3 WebSocket 생명주기

| 이벤트 | 설명 |
|--------|------|
| `wss.on('connection')` | 클라이언트 연결 (verifyClient 검증 통과 후) |
| `ws.on('message')` | 메시지 수신 및 처리 |
| `ws.on('pong')` | keep-alive 응답 |
| `ws.on('close')` | 연결 종료 |
| `ws.on('error')` | 연결 오류 |
| heartbeatInterval (30초) | isAlive=false인 클라이언트 terminate() |

---

## 3. 미들웨어 체인

| 미들웨어 | 적용 범위 | 설명 |
|----------|-----------|------|
| `helmet()` | 전역 | 보안 HTTP 헤더 |
| `cors()` | 전역 | CORS (허용 Origin 목록) |
| `express.json()` | 전역 | JSON 본문 파싱 (1MB 제한) |
| `express.urlencoded()` | 전역 | URL-encoded 본문 파싱 |
| `apiLimiter` | /api/* | 15분당 100회 |
| `nlpLimiter` | /api/nlp/* | 15분당 50회 |
| `adminApiLimiter` | /admin/api/* | 15분당 1000회 |
| `basicAuth()` | /admin/api/* | Basic Auth 인증 |
| `errorHandler` | 전역 (마지막) | 표준 오류 응답 (개발 환경만 상세) |
| `404Handler` | 전역 (최후) | 404 응답 |

---

## 4. 서버 시작 시 백그라운드 서비스

| 서비스 | 함수 | 설명 |
|--------|------|------|
| 스케줄러 | `startScheduler(wss)` | `scheduled_jobs` 테이블 기반 cron 실행 |
| 모니터링 | `startMonitor(wss)` | CPU/메모리 리소스 모니터링 (5분 샘플링) |
| 로그 로테이터 | `startLogRotator()` | 로그 파일 회전 정리 |
| 크롤러 모니터 | `startCrawlerMonitor(wss)` | 크롤러 타겟 자동 폴링 |

---

## 5. DB 연결 패턴

| 함수 | 설명 | 연결 방식 |
|------|------|----------|
| `getDbConnection()` | 싱글톤 공유 연결 | cachedDb (server/db/helper.js) |
| `openReadonly()` | 읽기 전용 새 연결 | 직접 생성 후 반환 |
| `openReadwrite()` | 읽기/쓰기 새 연결 | 직접 생성 후 반환 |
| `queryDatabase(sql, params)` | SELECT 실행 | cachedDb 사용 |
| `queryOne(sql, params)` | 단일 행 조회 | cachedDb 사용 |
| `execute(sql, params)` | INSERT/UPDATE/DELETE | cachedDb 사용 |
| `transaction(queries)` | 트랜잭션 실행 | cachedDb 사용 |
| `getDb(dbName)` | adminDb.js 내부 헬퍼 | 직접 생성 후 반환 |
| `getDb()` (crawler.js) | 크롤러 전용 헬퍼 | 직접 생성 후 반환 |
