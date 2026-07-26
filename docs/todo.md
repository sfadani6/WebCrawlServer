# 현재 작업 (docs/todo.md)

> 본 문서는 AI가 진행 중인 작업의 계획과 상태를 관리하는 문서입니다.
> AGENTS.md 1.6절에 따라 작업 시작 전에 반드시 확인합니다.

---

## 작업 개요

| 항목 | 내용 |
|------|------|
| 프로젝트 | WebCrawlServer |
| 현재 주기 | **ask.md 처리 완료** |
| **환경 요구사항** | **모든 설치는 로컬만 허용, 글로벌 설치 금지** |

---

## 완료된 항목

### P1-4: admin-ui/dist 빌드 산출물 확인
- `server/admin-ui/dist/index.html` 존재 확인

### P2-3: CSS 중복 규칙 정리
- `App.css`와 `index.css` 중복 없음 확인

### P2-4: SPA 라우팅 뒤로가기 상태 복원
- `sessionStorage`에 선택된 DB/테이블 저장, `popstate` 시 복원 구현

### P2 아키텍처: monitorWs.js 리소스 로그 과다 기록
- 5분 간격 샘플링으로 개선 확인

### P2 아키텍처: 에러 처리 미들웨어 통합
- `server/app.js` 표준 에러 핸들러 적용 확인

### P2 보안: 레이트 리밋 바이패스 가능성
- `/api`, `/admin/api`, `/api/nlp`에 각각 리미터 적용 확인

### P2 보안: 민감 정보 로그 노출
- 구조적 필드만 출력 확인

### P3: 단위 테스트 도입
- Jest 설치, `npm test` 스크립트 추가, `server/scripts/scriptEngine.test.js` 작성

### P3: 통합 테스트 도입
- supertest 설치, `server/app.test.js` 작성

### P3: docs/rule/ 문서와 코드 불일치 확인
- R-005, R-006, R-007, R-009 코드와 일치 확인

### P3: API 문서화
- `docs/api-spec.md` 작성 완료

### P3: 데이터베이스 마이그레이션 스크립트
- `server/scripts/migrate.js` 작성 완료
- `server/migrations/001_add_activity_logs_index.sql` 생성 및 적용 완료

### P2 아키텍처: DB 연결 풀 가이드 작성
- `docs/tips/db-connection-pool-guide.md` 작성 완료
- SQLite 특성상 싱글톤 유지 권장, 필요 시 선택적 적용 가능

---

## 실행 중 / 대기 중

### P2-1: 테이블 데이터 페이지네이션, 정렬, 검색 필터 UI
- `SpreadsheetView.jsx` 상태 변수 추가 완료
- 실제 UI/로직 추가 필요

### P2-2: 테이블 CSV/JSON 내보내기/가져오기
- 내보내기 구현 완료
- 가져오기는 백엔드 미구현으로 UI 제한

### P2 아키텍처: API 응답 형식 표준화
- 에러 응답은 표준화됨
- 성공 응답 형식이 `/api`, `/admin/api`마다 다름

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