# R-001 아키텍처 규칙 (architecture.md)

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-25
> 검토일: 2026-07-25
> 수정 이유: instructions.md 1장(프로젝트 개요)을 별도 문서로 분리. 기존 내용은 그대로 유지하고 형식만 독립 문서로 전환
> 관련 문서: docs/rule/instructions.md(R-000, 인덱스), docs/rule/structure.md(R-003)
> 영향 범위: 신규 분리 문서, 기존 instructions.md 1장을 대체
> Breaking Change 여부: 없음 (내용 이관만 수행)

이 문서는 `docs/rule/instructions.md`(R-000)가 위임한 세부 규칙 문서다. 우선순위·문서 간 충돌 처리는 `AGENTS.md` 1.5를 따른다.

---

## 1. 프로젝트 개요

WebCrawlServer는 브라우저 플러그인, MCP(Modular Control Platform) 서버, 관리자 페이지, 확장 모듈(메모장/영상 편집/이미지 에디터/외부 DB 모니터링)을 하나의 표준 API로 연결하는 통합 자동화 플랫폼이다.

- **플러그인 계층**: 브라우저에서 DOM 수집, 사용자 행위 자동화 수행
- **MCP 계층**: 통신/명령어/데이터 포맷 표준화
- **서버 관리자 계층**: 모듈/워크플로우/프로세스/DB/스케줄러 관리
- **확장 모듈 계층**: 메모장, 영상 편집, 이미지 에디터, 외부 DB 모니터링 등 (모듈은 관리자 페이지에서 동적 생성)

### 1.1 개발 목적
- 브라우저 자동화 방식을 표준화한다.
- 웹 크롤링 기능을 모듈 단위로 분리한다.
- 크롤링/이미지/영상/DB 모니터링 등 여러 자동화 기능을 하나의 서버와 관리자 페이지에서 관리한다.
- YAML 기반 워크플로우로 다단계 작업을 자동 실행한다.
- 브라우저 플러그인과 서버를 MCP 프로토콜 하나로 연결한다.
- 기존 코드 수정 없이 모듈 추가만으로 기능을 확장할 수 있는 구조를 유지한다.

### 1.2 설계 원칙
- **모듈화**: 크롤링, 이미지, 영상 편집, DB 모니터링 등 개별 기능은 각각 독립된 모듈로 분리한다.
- **표준화**: 플러그인-서버 간 통신은 `mcp.md`(R-004)에 정의된 MCP 메시지 규격만 사용한다.
- **확장성**: 신규 기능은 기존 모듈 코드를 수정하지 않고 새 모듈 추가로 구현하는 것을 원칙으로 한다.
- **독립성**: 모듈 간 직접 참조를 최소화하고, 연동이 필요하면 MCP 메시지(`mcp.md`) 또는 공용 워크플로우(`workflows/`)를 통해 처리한다.
- **범위 우선**: 위 원칙은 1.4의 현재 개발 범위를 벗어나지 않는 선에서 적용한다. 범위를 넘어서는 설계(다중 사용자 대응 등)는 그 시점에 별도로 논의하고 이 문서에 반영한다.

### 1.3 시스템 구성 (개략도)
```
브라우저 플러그인 → MCP 프로토콜 → WebCrawlServer
                                    ├─ Module Engine (modules/)
                                    ├─ Workflow Engine (workflow.yaml)
                                    ├─ Scheduler (scheduler.md, R-005)
                                    └─ SQLite (database/main.db)
                                          ├─ 관리자 페이지(public/)
                                          ├─ 모니터링(monitoring.md, R-006)
                                          └─ 로컬 프로세스/외부 프로그램 실행(run_process)
```

**서버 포트:**
- 기본 포트: **9600**
- 환경 변수: `PORT` (예: `PORT=8080 node server/app.js`)

각 구성요소의 세부 규칙은 `structure.md`(구조), `mcp.md`(MCP), `scheduler.md`(스케줄러), `monitoring.md`(모니터링), `database.md`(DB)를 따른다.

### 1.4 현재 개발 범위 (확정)
- **로컬 단독 실행, 1인 개발자(본인) 전용 도구**로 개발한다. 여러 사용자 동시 접속, 외부 공개 서비스, 클라우드 배포, 멀티 리전 운영은 현재 범위에 포함하지 않는다.
- 위 전제에 따라 인증, 권한 분리(RBAC), TLS, 로드밸런싱, 컨테이너 오케스트레이션 관련 설계는 다루지 않는다. 해당 요구가 실제로 발생하면 그 시점에 별도로 논의하고 이 문서에 반영한다.
- 이 범위 제한은 `security.md`(R-013)와 `database.md`(R-007)에도 동일하게 적용된다.

세부 기능/화면 설계, DB 스키마, MCP 메시지 규격의 전체 내용은 각 세부 규칙 문서(`mcp.md`, `database.md` 등)를 기준으로 삼는다. 실제 구현 중 명시되지 않은 사항이 발견되면 사용자에게 확인 후 해당 문서에 내용을 보강한다.

### 1.5 프로젝트 범위 (영역별 정리)

| 영역 | 설명 | 세부 규칙 문서 | 비고 |
|---|---|---|---|
| Browser Plugin | DOM 접근, 클릭, 입력, 스크롤, 이미지/데이터 수집, 다운로드 | structure.md, mcp.md | |
| MCP Server | 메시지 처리, 프로토콜 표준화 | mcp.md | |
| Workflow Engine | YAML 기반 워크플로우 실행, 조건/반복/변수 처리 | mcp.md | |
| Module Engine | 모듈 동적 로드/실행 | structure.md, mcp.md | |
| Scheduler | 예약/주기/조건/Cron 실행 | scheduler.md | |
| Database | SQLite 기반 데이터 관리 | database.md | |
| Admin UI | 모듈/워크플로우/스케줄러/로그/DB 관리 화면 | structure.md, scheduler.md, database.md, logging.md | |
| Logging | 활동/에러 로그 기록 | workflow-management.md, logging.md | |
| Monitoring | 실행 상태·리소스 사용량 조회 | monitoring.md | |
| Extension Apps | 로컬 프로그램/외부 프로세스 연동(`run_process`) | mcp.md, security.md | |

> **주의:** 본 지침을 위반하는 코드/문서는 작성하지 않으며, 구조 변경이 필요할 경우 반드시 `AGENTS.md`와 대조 후 수정한다.
