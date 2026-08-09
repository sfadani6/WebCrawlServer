# R-00103 docs/rule/R-00103 workflow-management.md

`WebCrawlServer`의 ask/todo 운영 절차, 이력 관리, ADR 기준을 정의합니다.

## 작업 흐름

1. `docs/ask.md`에 요청 내용을 기록합니다.
2. `docs/ask.md`는 신규 작업 요청 문서입니다. 작업을 시작할 때 반드시 확인하고, `docs/ask.md`에 기록된 요청은 `docs/askLogs/`에도 함께 남깁니다.
3. ask 요청은 `docs/ask.md` 본문만 확인하고 지시대로 처리합니다. `docs/askLogs/`, `docs/CHANGELOG/`, `docs/decision/`, `docs/tips/` 등은 쓰기 전용 기록 공간이며 읽거나 판단용으로 열람하지 않습니다.
4. `docs/todo.md`에 작업 계획과 상태를 체크박스 형태로 정리합니다.
4. 개선 요청은 `docs/todo.md`에 반영하고, 작업 완료 후에는 `docs/todo.history.md`에 이력과 결과를 기록합니다.
5. 중요한 설계 결정은 `docs/decision/`에 ADR로 저장합니다.

## 이력 관리

- `docs/todo.history.md`에는 작업 완료 일시, 변경 내용, 변경 이유를 기록합니다.
- `docs/askLogs/`에는 모든 질의와 응답 데이터를 `YYYYMMDDHHMMSS.md` 형식으로 기록합니다.
- `docs/askLogs/` 파일에는 요청 원문, 처리 단계, 변경된 파일 목록, 검증 결과를 모두 포함해야 합니다.
- `docs/CHANGELOG.md`는 주요 릴리스 로그를 기록하며 항상 최신 상태로 유지합니다.
- `docs/CHANGELOG/` 상세 변경 이력 파일명은 영어 작업 이름과 `YYYYMMDDHHMMSS` 타임스탬프를 사용하여 생성합니다.
- `docs/askLogs/`, `docs/tips/`, `docs/decision/`은 과거 이력성 데이터로 취급합니다. 새로운 작업을 시작할 때는 이들 폴더의 기존 문서를 자동으로 읽지 않으며, 사용자가 특정 파일을 명시적으로 지정할 때만 그 파일 하나를 열어 확인합니다.

## ADR 기준

- 설계 변경이 프로젝트 구조, 아키텍처, 기술 스택, 인증, 보안 등 주요 사항에 영향을 줄 경우 ADR을 작성합니다.
- ADR은 `docs/decision/`에 저장합니다.
- ADR에는 관련 문서 목록(`AGENTS.md`, `docs/rule/*.md`)을 포함합니다.

## 검토 기준

- 작업 전에 `AGENTS.md`와 관련 규칙 문서를 확인합니다.
- 작업 후 변경 사항이 규칙을 위반하지 않는지 검증합니다.
- 작업 결과를 사용자에게 보고하기 전에 문서화 상태를 점검합니다.



