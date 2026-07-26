# R-000 규칙 문서 인덱스 (instructions.md)

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-25
> 검토일: 2026-07-25
> 수정 이유: 기존 13장짜리 단일 통합 문서를 주제별 문서로 분리하고, 본 문서는 인덱스(Rule Registry) 역할만 담당하도록 전면 재작성. 매 작업마다 13장 전체를 읽어야 했던 토큰 소모 문제를 해소하기 위함
> 관련 문서: AGENTS.md 0.2(Rule Registry, 동일 표를 최상위 문서에도 유지), docs/rule/ 하위 전체 문서
> 영향 범위: 기존 instructions.md(0.02)를 대체. 기존 13개 장의 본문은 아래 R-001~R-013 문서로 이관되었으며 삭제된 내용은 없음
> Breaking Change 여부: 있음 — 기존에 "instructions.md 4장", "instructions.md 7.2" 식으로 절대 절 번호를 인용하던 문서/이력 파일이 있다면, 해당 절은 이제 다른 파일(mcp.md 4장, database.md 2장 등)에 있다. 과거 askLogs/CHANGELOG의 절 번호 인용은 소급 수정하지 않으며, 새 인용부터 신규 형식(파일명 + 장 번호)을 사용한다.

---

## 0. 이 문서의 역할

`docs/rule/instructions.md`는 더 이상 세부 규칙을 직접 담지 않는다. 세부 규칙은 아래 Rule Registry의 각 문서(R-001~R-014)에 있으며, 이 문서는 다음 역할만 담당한다.

1. 어떤 주제가 어느 문서에 있는지 안내(Rule Registry)
2. 문서 분리 원칙과 신규 문서 추가 절차 안내
3. `AGENTS.md`가 위임한 "통합 세부 규칙 문서"라는 위치 자체를 대표

작업 시 필요한 주제의 문서만 열람한다. 예를 들어 MCP 프로토콜 작업이면 `mcp.md`만 읽으면 되고, 이 인덱스와 `mcp.md` 외 나머지 12개 문서를 함께 읽을 필요는 없다.

---

## 1. Rule Registry

| Rule ID | 문서 | 범위 |
|---|---|---|
| R-000 | docs/rule/instructions.md | 규칙 문서 인덱스 (본 문서) |
| R-001 | docs/rule/architecture.md | 프로젝트 개요, 시스템 구성, 개발 범위 |
| R-002 | docs/rule/tech-stack.md | 기술 스택 |
| R-003 | docs/rule/structure.md | 폴더 구조, 명명 규칙, 모듈 생성/구조 |
| R-004 | docs/rule/mcp.md | MCP 프로토콜, 워크플로우 스텝 타입 |
| R-005 | docs/rule/scheduler.md | 스케줄러, 작업 상태, 동시 실행 정책 |
| R-006 | docs/rule/monitoring.md | 모니터링, 리소스 사용량 수집 |
| R-007 | docs/rule/database.md | DB 스키마, 마이그레이션, 백업, 관리자 UI API |
| R-008 | docs/rule/workflow-management.md | ask/todo 운영 절차, 이력 관리, ADR |
| R-009 | docs/rule/logging.md | 로그 기록 정책, 로그 분류 |
| R-010 | docs/rule/versioning.md | Git, 버전 관리, 문서 버전 형식 |
| R-011 | docs/rule/coding.md | 코드 작성 규칙 |
| R-012 | docs/rule/communication.md | 커뮤니케이션 가이드, 응답 구조 |
| R-013 | docs/rule/security.md | 예외 처리 및 일반 보안 정책 |
| R-014 | docs/rule/auth.md | 페이지 인증, Basic Auth, bcryptjs, 자격증명 변경 API |

동일한 표가 `AGENTS.md` 0.2에도 있다. 두 표가 어긋나면 `AGENTS.md`가 우선하며(`AGENTS.md` 1.5 우선순위 규칙), 발견 즉시 이 표를 `AGENTS.md`에 맞춰 갱신한다.

## 2. 문서 분리 원칙

- 각 R-00N 문서는 하나의 주제만 다룬다. 주제가 여러 문서에 걸쳐 섞이면 안내가 어려워지므로, 새 규칙을 추가할 때는 먼저 이 Registry에서 가장 근접한 주제의 문서를 찾아 그 문서에 추가한다.
- 기존 14개 주제 어디에도 속하지 않는 완전히 새로운 영역이 생기면, 새 파일을 `docs/rule/`에 추가하고 이 문서와 `AGENTS.md` 0.2 표에 R-015 이후 번호로 함께 등록한다. 신규 문서 추가는 `AGENTS.md` 1.3(문서 작성 위치 규칙), `AGENTS.md` 1.7(불확실 사항 확인 원칙)에 따라 사용자에게 위치와 번호를 보고한 뒤 확정한다.
- 문서 하나가 지나치게 커지면(예: 300줄 이상, 서로 다른 하위 주제가 뒤섞임) 추가 분리를 검토한다. 반대로 서로 밀접하게 연관된 문서를 합치는 것도 가능하며, 두 경우 모두 `docs/decision/`(ADR, `workflow-management.md` 5장)에 근거를 남기는 것을 권장한다.
- 각 문서의 버전 헤더 형식은 `versioning.md` 4장을 따른다.

## 3. 우선순위 및 충돌 처리

문서 간 우선순위, 문서 위치 규칙, 작업 시작 시 파일 확인 순서, 불확실 사항 처리 원칙은 `AGENTS.md` 1장을 우선 적용하며, 세부 규칙 문서(R-001~R-013)와 충돌 시 `AGENTS.md`가 우선한다.
