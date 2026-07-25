## 3. 🚨 심각한 개선 필요사항 (Critical)

### 🔴 3.1. NLP 라우터의 치명적 SQL Injection 취약점

`server/routes/nlp.js`에서 사용자 입력을 문자열 연결로 SQL을 생성하고 있습니다.

```js
// ❌ 현재 코드 (매우 위험)
sql = `DELETE FROM users WHERE name LIKE '${name}%';`;
```

**공격 예시**: prompt에 `"'; DROP TABLE users; --"` 같은 문자열이 들어오면 그대로 DELETE 문에 삽입됩니다.

**개선안**:
```js
// ✅ 파라미터화 + 실행이 아닌 미리보기만 반환
const stmt = { sql: 'DELETE FROM users WHERE name LIKE ?', params: [`${name}%`] };
// 관리자가 확인 후 실행하도록 confirm 단계 추가
```
추가로 **LLM 기반의 안전한 NL→SQL 파이프라인**(예: parameter binding + SELECT-only 화이트리스트)으로 교체를 권장합니다.

### 🔴 3.2. 인증/인가 부재

- `/admin/api/*`, `/api/nlp/sql`, `/admin/*` SPA 등 관리자 엔드포인트에 **인증 미들웨어가 전혀 없습니다**.
- 서버가 외부에 노출되면 누구나 DB 백업·복원, 레코드 삭제, SQL 실행이 가능합니다.

**개선안**:
```js
// server/middleware/auth.js 신설
const jwt = require('jsonwebtoken');
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ status:'error', message:'인증 필요' }); }
}
// app.use('/admin/api', requireAuth, adminDbRouter);
```
- 최소한 **BASIC AUTH** 또는 **API Key** + **CSRF 토큰**을 즉시 추가하고
- 이상적으로는 **JWT + RBAC(role)** 도입

### 🔴 3.3. adminDb의 동적 컬럼 필터 — Injection 잔존

```js
// ❌ 컬럼명이 사용자 입력에서 그대로 사용됨
sql += ' AND (' + filterCols.map(col => `${col} LIKE ?`).join(' AND ') + ')';
```
값은 파라미터화되었지만 **컬럼명은 그대로 SQL에 삽입**됩니다. `?col=1) OR 1=1--` 형태의 공격 가능성.

**개선안**: 테이블 스키마에서 얻은 실제 컬럼 리스트로 화이트리스트 검증:
```js
const schema = await getTableColumns(tableName);
const allowed = filterCols.filter(c => schema.includes(c));
```

### 🔴 3.4. WebSocket 인증·Origin 검증 부재

```js
const wss = new WebSocketServer({ server });
wss.on('connection', (ws, req) => { ... });
```
- Origin 검사 없음 → **CSWSH(WebSocket Hijacking)** 가능
- 토큰/세션 검증 없음 → 누구나 MCP 명령 송신 가능

**개선안**:
```js
const wss = new WebSocketServer({ server, verifyClient: (info, cb) => {
  const origin = info.origin;
  const token = new URL(info.req.url, 'http://x').searchParams.get('token');
  if (!ALLOWED_ORIGINS.includes(origin)) return cb(false, 403, 'Forbidden');
  if (!isValidToken(token)) return cb(false, 401, 'Unauthorized');
  cb(true);
}});
```

---

## 4. 🟠 아키텍처·구조 개선 (High)

### 4.1. `app.js`가 너무 많은 책임을 가짐 (God File)

현재 12.7KB의 `app.js`가 다음을 모두 처리:
- Express 설정 · 라우팅 마운트
- WebSocket 서버 · MCP 프로토콜 검증 · 액션 라우팅 (switch-case)
- DB 초기화 · 스키마 생성

**개선안 — 계층 분리**:
```
server/
├── app.js                (부트스트랩만, ~50줄)
├── config/index.js       (PORT, DB_PATH, JWT_SECRET, ALLOWED_ORIGINS)
├── ws/
│   ├── server.js         (WebSocketServer 생성 + verifyClient)
│   ├── mcpValidator.js   (필수 필드 검증)
│   └── handlers/         (open_browser.js, crawl_page.js, ...)
├── db/
│   ├── connection.js     (단일 커넥션 풀)
│   └── migrations/       (버전 관리된 SQL 파일)
├── middleware/
│   ├── auth.js
│   ├── rateLimit.js
│   └── errorHandler.js
└── routes/ ...
```

### 4.2. WebSocket 액션 switch-case → 핸들러 맵 패턴

```js
// ❌ 현재 (확장할수록 커짐)
switch (data.action) { case 'open_browser': ...; case 'crawl_page': ... }

// ✅ 개선
const handlers = {
  open_browser: require('./handlers/openBrowser'),
  crawl_page:   require('./handlers/crawlPage'),
};
const handler = handlers[data.action] ?? handlers.default;
const result = await handler(data, { ws, wss, db });
```

### 4.3. DB 스키마 하드코딩 → 마이그레이션 시스템

현재 `app.js`의 `coreTables` 배열에 CREATE TABLE이 하드코딩되어 있습니다. `schema_migrations` 테이블은 만들어져 있지만 실제 마이그레이션 러너는 없어 보입니다.

**개선안**: `database/migrations/001_init.sql`, `002_add_xxx.sql` 파일 기반으로 **umzug** 또는 **node-pg-migrate** 스타일 러너 도입.

### 4.4. `queryDatabase`의 연결 관리

`adminDb.js`에서 요청마다 `new sqlite3.Database(...)`를 열고 닫는 패턴이 반복됩니다. **커넥션 풀** 또는 **싱글턴 인스턴스**를 도입해 성능·자원 낭비 개선.

`better-sqlite3` 로 교체 시 동기 API + 훨씬 빠른 성능(약 5~10배)도 검토해볼 만합니다.

---

## 5. 🟡 보안·안정성 강화 (Medium)

| 항목 | 현재 | 개선안 |
|------|------|--------|
| **보안 헤더** | 없음 | `helmet` 미들웨어 추가 |
| **CORS** | 없음 | `cors` + 허용 Origin 명시 |
| **레이트 리밋** | 없음 | `express-rate-limit` (특히 `/api/nlp`) |
| **요청 본문 크기** | 기본값 무제한에 가까움 | `express.json({ limit: '1mb' })` |
| **에러 노출** | 개발 환경에서 `err.message` 반환 | 프로덕션에서 스택도 완전 마스킹 (이미 부분 적용) |
| **에러 응답 오탈자** | `'오류 detalles 사용 불가'` (스페인어 혼입) | `'오류 상세 정보 사용 불가'` |
| **로깅** | `console.log` 전용 | `winston` / `pino` 로 파일·JSON 구조화, 로그 레벨 분리 |
| **테스트** | `"test": "echo \"Error: no test specified\""` | Jest/Vitest + Supertest 도입, 최소 라우터 통합 테스트 |
| **환경변수** | `PORT`만 사용 | `dotenv` + `.env.example` 로 시크릿 관리 |
| **입력 검증** | 필드 존재만 검증 | `zod` / `joi` 로 타입·형식 스키마 검증 |

---

## 6. 🟢 성능·확장성 (Low-Med)

### 6.1. WebSocket Heartbeat

현재는 연결 시 1회만 heartbeat을 전송합니다. **끊긴 좀비 커넥션 감지**를 위해 `ping`/`pong` 주기 체크가 필요합니다.

```js
const interval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);
ws.on('pong', () => { ws.isAlive = true; });
```

### 6.2. `/api/status`의 웹소켓 상태 하드코딩

```js
websocket: 'active',   // 항상 'active'
mcp:       'ready',    // 항상 'ready'
```
실제 상태를 반영하도록 개선(예: 스케줄러 실행 중인 잡 개수, MCP 미처리 큐 크기 등).

### 6.3. `Promise.all`로 `queryDatabase` 4회 병렬 실행

`api.js`의 `/stats`가 4개의 COUNT를 병렬 실행하는데, SQLite는 **단일 라이터** 특성상 오히려 하나의 쿼리(UNION ALL)로 묶는 것이 더 빠릅니다.
```sql
SELECT 'modules' AS k, COUNT(*) AS c FROM modules
UNION ALL SELECT 'workflows', COUNT(*) FROM workflows
UNION ALL SELECT 'jobs',      COUNT(*) FROM scheduled_jobs
UNION ALL SELECT 'logs',      COUNT(*) FROM activity_logs;
```

### 6.4. 로그 테이블 인덱스

`activity_logs`, `error_logs`가 커질수록 `ORDER BY created_at DESC` 는 느려집니다.
```sql
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at    ON error_logs(created_at DESC);
```
로그 **자동 파티셔닝/롤오버**(예: 30일 초과 삭제 크론 잡) 정책도 추천.

---

## 7. 📈 개선 우선순위 로드맵

| 단계 | 기간 | 작업 |
|------|------|------|
| **Sprint 0 (즉시)** | 1~2일 | ① NLP 라우터 파라미터화 or 비활성화 ② 관리자 API에 최소 BASIC AUTH ③ `helmet` + `cors` + `express-rate-limit` 추가 ④ 요청 본문 크기 제한 |
| **Sprint 1** | 1주 | ⑤ JWT 기반 인증/RBAC ⑥ WebSocket `verifyClient` + heartbeat ⑦ 입력 검증 라이브러리(zod) 도입 ⑧ 로그 라이브러리(pino) 전환 |
| **Sprint 2** | 2주 | ⑨ `app.js` 리팩토링(계층 분리) ⑩ WebSocket 액션 핸들러 맵 ⑪ DB 마이그레이션 러너 ⑫ 커넥션 풀·better-sqlite3 검토 |
| **Sprint 3** | 지속 | ⑬ Jest/Supertest 테스트 ⑭ CI/CD (GitHub Actions) ⑮ OpenAPI(Swagger) 자동 문서화 ⑯ 관측 도구(Prometheus 메트릭 엔드포인트) |

---
