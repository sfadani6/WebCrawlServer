# API 스펙 (docs/api-spec.md)

> 프로젝트: WebCrawlServer
> 작성일: 2026-07-26
> AGENTS.md 1.3절: 모든 문서는 docs/ 하위에 생성

---

## 1. 개요

| 항목 | 값 |
|------|-----|
| 베이스 URL | `http://localhost:9600` |
| 인증 방식 | Basic Auth (관리자 계정) |
| 응답 형식 | JSON (`{ status, data, ... }` 또는 `{ status, error, message }`) |
| 레이트 리밋 | `/api`: 100회/15분, `/admin/api`: 1000회/15분, `/api/nlp`: 50회/15분 |

---

## 2. API 엔드포인트

### 2.1 공통 API (`/api`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api` | 모듈, 워크플로, 스케줄러, 크롤러 요약 정보 반환 |
| GET | `/api/modules` | 모듈 목록 조회 |
| GET | `/api/workflows` | 워크플로 목록 조회 |
| GET | `/api/scheduler` | 스케줄러 작업 목록 조회 |
| GET | `/api/crawler` | 크롤러 타겟 목록 조회 |

### 2.2 NLP API (`/api/nlp`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/nlp/sql` | 자연어 입력을 SQL로 변환 (미리보기) |

**요청 예시:**
```json
POST /api/nlp/sql
{
  "prompt": "회원 검색"
}
```

**응답 예시:**
```json
{
  "status": "ok",
  "sql": "SELECT id, name, email, created_at FROM users WHERE name LIKE ?",
  "params": ["%회원%"],
  "requiresConfirmation": false
}
```

### 2.3 관리자 DB API (`/admin/api`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/admin/api/db` | DB 파일 목록 조회 |
| GET | `/admin/api/tables/:name` | 테이블 목록/스키마 조회 |
| GET | `/admin/api/tables/:name/rows` | 행 목록 조회 (`?limit=N&offset=M`) |
| POST | `/admin/api/tables/:name/rows` | 행 추가 |
| PUT | `/admin/api/tables/:name/rows/:id` | 행 수정 |
| DELETE | `/admin/api/tables/:name/rows/:id` | 행 삭제 |
| GET | `/admin/api/tables/:name/backup` | 테이블 백업 (CSV/JSON) |
| GET | `/admin/api/admin/account` | 관리자 계정 조회 |
| PUT | `/admin/api/admin/account` | 관리자 계정 변경 |

### 2.4 크롤러 API (`/admin/api/crawler`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/admin/api/crawler` | 크롤러 타겟 목록 조회 |
| POST | `/admin/api/crawler` | 크롤러 타겟 추가 |
| PUT | `/admin/api/crawler/:id` | 타겟 수정 |
| DELETE | `/admin/api/crawler/:id` | 타겟 삭제 |

### 2.5 헬스 체크

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |

---

## 3. 응답 형식

### 3.1 성공 응답
```json
{
  "status": "ok",
  "data": { ... }
}
```

### 3.2 에러 응답
```json
{
  "status": "error",
  "message": "에러 메시지"
}
```

### 3.3 WebSocket 응답 (MCP 프로토콜)
```json
{
  "type": "response",
  "status": "success",
  "messageId": "msg_123",
  "timestamp": "2026-07-26T10:00:00.000Z",
  "protocolVersion": "1.0",
  "data": { ... }
}
```

---

## 4. 인증

- 관리자 API(`/admin/api`)는 Basic Auth 필요
- WebSocket은 `?token=` 쿼리 파라미터로 토큰 인증
- CORS: `ALLOWED_ORIGINS` 환경변수로 허용 Origin 설정

---

</arg_value>
<task_progress>
- [x] 규칙 문서 확인 (R-000)
- [x] docs/ask.md 요청 내용 확인
- [x] docs/todo.md 기존 작업 계획 확인
- [x] P1-1~P1-3 완료
- [x] P1-4: dist/index.html 확인 완료
- [x] P2-1~P2-4, P2 아키텍처/보안 상태 반영 완료
- [x] P3: Jest 설치, docs/rule 불일치 확인 완료
- [x] P3: API 문서화 스펙 작성 완료
- [x] docs/ask.md 정리 완료
- [x] docs/todo.md 실행 계획 기록 완료
- [x] 이력 기록 완료
</task_progress>
</write_to_file></tool_call>