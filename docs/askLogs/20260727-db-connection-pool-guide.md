# DB 연결 풀(Connection Pool) 도입 가이드 요청

> Version: 1.0.0
> 요청일: 2026-07-27

---

## 요청 내용
DB 연결 풀(Connection Pool) 도입에 대한 가이드 지침 요청.

---

## 처리 결과
- `docs/tips/db-connection-pool-guide.md` 작성 완료
- SQLite 파일 기반 DB 특성상 연결 풀 한계 분석
- 권장 접근 방식: 싱글톤 패턴 유지 (현재 구조)
- 필요 시 better-sqlite3 또는 직접 구현한 풀 클래스 사용 옵션 제공

---

## 변경 파일
- `docs/tips/db-connection-pool-guide.md`: 신규 작성
- `docs/todo.history.md`: 이력 추가
- `docs/ask.md`: 상태 업데이트 (완료 → 가이드 작성 완료)
- `docs/todo.md`: 완료 항목 반영

---

## 비고
- SQLite는 파일 기반으로 진정한 풀 효과가 제한적
- 현재 `server/db/helper.js`의 싱글톤 구조가 가장 효율적
- 추후 동시 실행 워커 증가 시 better-sqlite3 도입 검토