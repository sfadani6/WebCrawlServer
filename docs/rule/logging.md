# R-009 로그 기록 정책 (logging.md)

> Version: 1.1.0
> 작성자: 사용자
> 수정일: 2026-07-25
> 검토일: 2026-07-25
> 수정 이유: instructions.md 9장을 별도 문서로 분리. 2장에 `activity_logs`/`error_logs` 외 로그 성격별 분류(감사/성능/스케줄러/워크플로우) 기준 신설 — 다만 즉시 테이블을 분리하지는 않고, 기존 `activity_logs`를 종류(source/category)로 구분해 조회하는 방식을 우선 적용
> 관련 문서: docs/rule/instructions.md(R-000), docs/rule/database.md(R-007), docs/rule/scheduler.md(R-005)
> 영향 범위: 신규 분리 문서, 기존 instructions.md 9장을 대체. 물리적 테이블 분리는 아직 수행하지 않음(2장 참조)
> Breaking Change 여부: 없음 (현재는 분류 기준만 추가, 스키마 변경 없음)

---

## 1. 기본 정책
- 로그는 `logs/` 디렉토리에 `{time:YYYY-MM-DD}.log` 형식으로 날짜별 기록한다.
- 자정 기준 자동 로그 파일 분리를 적용한다.
- 관리자 페이지 로그 뷰어는 활동/에러 로그를 필터링·검색 가능해야 한다.
- 동일 이벤트 반복 기록을 방지하기 위해 이벤트 ID 기반 중복 체크를 적용한다.
- 6장(모니터링, `monitoring.md`)에서 수집하는 리소스 사용량도 동일한 활동 로그(`activity_logs`) 체계를 사용하며, 별도 로그 파일을 만들지 않는다.

## 2. 로그 종류 분류

`activity_logs`, `error_logs` 두 코어 테이블(`database.md` 3장)은 유지하되, 아래처럼 `activity_logs.source` 또는 별도 `category` 컬럼 값으로 로그 성격을 구분해 조회할 수 있도록 한다. 현재는 물리적으로 테이블을 나누지 않으며, 조회 편의를 위한 분류 기준으로만 우선 적용한다. 실제 데이터량이 커져 테이블 분리가 필요해지면 `database.md` 5장 마이그레이션 절차에 따라 분리하고 이 문서를 갱신한다.

| 분류 | 설명 | 기록 대상 |
|---|---|---|
| audit | 관리자 페이지에서 발생한 설정 변경(모듈 생성, 스키마 변경, 스케줄러 등록/수정 등) | `structure.md`, `database.md`, `scheduler.md`에서 규정한 변경 이력 |
| performance | CPU/메모리 등 리소스 사용량, 응답 시간 | `monitoring.md`(R-006)의 수집 대상 |
| scheduler | 스케줄러 트리거/실행/Skip/Queue 이벤트 | `scheduler.md`(R-005) 5장 Overlap 정책에 따른 이벤트 포함 |
| workflow | MCP 워크플로우 단계별 실행 결과 | `mcp.md`(R-004) 스크립트 실행 기록 |

## 3. 에러 로그
- 모듈/워크플로우 실행 실패, 예외 발생 시 `error_logs`에 상세 메시지를 기록한다(`security.md` 참조).
- 어느 `stepId`/`job_id`/`module`에서 실패했는지 반드시 포함한다.
