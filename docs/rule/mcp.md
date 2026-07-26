# R-004 MCP(Modular Control Platform) 프로토콜 규칙 (mcp.md)

> Version: 1.1.1
> 작성자: 사용자
> 수정일: 2026-07-26
> 검토일: 2026-07-26
> 수정 이유: 4장(워크플로우 엔진)에 현재 미구현 상태 명시 — 스크립트 페이로드(steps 배열), condition/loop 처리, 워크플로우 실행 엔진이 아직 구현되지 않았음을 문서에 반영
> 관련 문서: docs/rule/instructions.md(R-000), docs/rule/structure.md(R-003), docs/rule/scheduler.md(R-005)
> 영향 범위: 문서 상태 명시 추가, 기존 내용 변경 없음
> Breaking Change 여부: 없음

---

## 1. 메시지 헤더 필수 필드
`messageId`, `type`(`request`/`script`/`response`/`event`/`heartbeat`), `module`, `action`, `timestamp`, `scriptId`(스크립트 관련 메시지), `protocolVersion`(버전 호환성 관리용)을 반드시 포함한다.

## 2. 표준 명령어 집합
`open_browser`, `crawl_page`, `run_process`, `stop_process`, `send_message`, `log_event`, `monitor_status`, `manage_db`를 공통 명령어로 정의하며, 신규 명령어 추가 시 기존 명령어와 이름이 충돌하지 않아야 한다.

클릭/입력/스크롤/다운로드/이미지 수집/DOM 추출 등 브라우저 자동화의 세부 동작은 별도의 MCP 명령어를 만들지 않고, 3장의 스크립트 단계(`steps[].type`)로 처리한다. 이는 세부 동작이 늘어날 때마다 표준 명령어 집합이 무한히 늘어나는 것을 막기 위한 설계 결정이다. 명령어 레벨 확장이 필요한 경우(예: 새로운 실행 채널 추가)만 이 표에 추가한다.

## 3. 요청/응답 포맷
- 모든 요청/응답은 JSON 기반이며, 응답은 `status`(`success`/`error`)와 `message`(또는 `data`)를 반드시 포함한다.
- 실패 시 `status: "error"`와 상세 에러 메시지를 반환한다.

## 4. 스크립트 페이로드
단계형 스크립트(`steps` 배열) 구조를 사용하며, 각 단계는 아래 필드를 포함한다.

- `stepId`: 단계 식별자
- `type`: 아래 스텝 타입 표를 따른다.
- `target`: 대상 선택자/URL/변수명 등 (타입별 의미가 다름)
- `params`: 타입별 부가 파라미터
- `timeout`: 단계별 제한 시간(ms). 미지정 시 6장의 전역 기본값을 적용한다.
- `onSuccess` / `onFailure`: 다음 단계 분기(옵션)

**스텝 타입 (사용 중)**

| type | 용도 | target / params |
|---|---|---|
| `navigate` | 페이지 이동 | `target`=URL |
| `waitFor` | 요소/조건 대기 | `target`=선택자, `params.timeout` |
| `extract` | 텍스트/데이터 추출 | `target`=선택자 |
| `click` | 클릭 | `target`=선택자 |
| `input` | 입력 | `target`=선택자, `params.value` |
| `scroll` | 스크롤 | `params.direction`, `params.amount` |
| `collectImages` | 이미지 수집 | `params.selector`, 저장 경로는 모듈 `config.json` 기준 |
| `download` | 파일 다운로드 | `params.url` 또는 `target`=선택자 |
| `condition` | 조건 분기 | `params.expression` (5장 참조) |
| `loop` | 반복 실행 | `params.times` 또는 `params.until`, 내부에 중첩 `steps` (5장 참조) |
| `setVariable` | 변수 설정 | `target`=변수명, `params.value` 또는 이전 단계 결과 참조 |
| `custom` | 위 항목으로 표현되지 않는 동작 | 모듈 `actions/`의 스크립트에 위임 |

**스텝 타입 (예약, 미사용)**

아래 타입명은 향후 확장을 대비해 예약만 해 둔 상태이며, 현재 워크플로우 엔진은 이를 처리하지 않는다. 구현 전까지 이 이름으로 다른 용도의 타입을 만들지 않는다. 실제 구현 시 이 표의 상태를 "사용 중"으로 변경하고 동작 정의를 4장 형식에 맞춰 채운다.

| type | 예정 용도(초안) |
|---|---|
| `parallel` | 여러 하위 `steps`를 동시 실행 |
| `race` | 여러 하위 `steps` 중 가장 먼저 끝나는 것만 채택 |
| `delay` | 지정 시간만큼 대기 후 다음 단계 진행 |
| `retry` | 특정 하위 단계를 실패 시 재시도(전역 재시도 정책과 별개로 단계 단위 지정) |
| `switch` | 값에 따라 여러 분기 중 하나를 선택 실행(`condition`의 다중 분기 버전) |
| `foreach` | 배열 변수를 순회하며 하위 `steps`를 반복 실행 |

## 5. 워크플로우 제어 구조 상세

- **Condition(조건)**: `condition` 타입 단계의 `params.expression`은 이전 단계 결과값 또는 `setVariable`로 설정한 변수만 참조하는 단순 비교식으로 제한한다. 복잡한 로직(다중 조건 조합, 외부 함수 호출)이 필요하면 `custom` 타입으로 위임하고 액션 스크립트에서 처리한다.
- **Loop(반복)**: `params.times`(고정 횟수 반복) 또는 `params.until`(조건식이 참이 될 때까지 반복) 중 하나만 지정한다. 두 값을 동시에 지정한 스크립트는 등록 시점에 검증 오류로 거부한다. 무한 루프를 막기 위해 `params.maxIterations` 기본값(예: 1000)을 강제 적용하며, 초과 시 스텝 실패로 처리하고 `error_logs`에 기록한다.
- **Variable(변수)**: `setVariable`로 설정한 값은 동일 워크플로우 실행(같은 `scriptId`) 범위 안에서만 유효하다. 다른 워크플로우나 모듈과 값을 공유하지 않는다. 실행이 끝난 뒤에도 남겨야 하는 값은 `database.md`(R-007) 방식으로 모듈 테이블을 만들어 저장한다.
- **Timeout(제한 시간)**: 단계별 `timeout`을 지정하지 않으면 전역 기본값(예: 30000ms)을 적용한다. 전역 기본값은 `config/`의 설정 파일에서 관리하며, 값을 바꾸면 이 문서 대신 설정 파일이 최신 값을 대표한다.
- **Exception(예외)**: 단계 실행 중 발생한 예외는 6장의 오류/재시도 정책을 따른다. 재시도 초과 시 어느 `stepId`에서 실패했는지 포함해 `error_logs`에 기록한다.

## 6. 전송 채널
- 실시간 양방향 통신이 필요한 경우 WebSocket, 단순 폴링이면 HTTP POST를 사용한다.
- 헬스 체크는 `heartbeat` 메시지로 수행하며, 연결 끊김 시 지수 백오프로 재연결한다.

## 7. 오류/재시도 정책
- 단계 실패 시 지정된 횟수만큼 즉시 재시도하고, `onFailure`에 대체 경로가 정의된 경우 이를 우선 실행한다.
- 전역 재시도는 지수 백오프를 적용하며, 최대 재시도 횟수 초과 시 스크립트 실패로 처리하고 `error_logs`에 기록한다.

## 8. 워크플로우 예시 시나리오 (참고용)
대표적인 흐름(로그인 → 검색 → 페이지 이동 → 데이터 추출 → DB 저장 → 결과 반환)을 4장의 스텝 타입으로 표현하면 다음과 같다. 실제 선택자/URL/액션명은 모듈별 `workflow.yaml` 작성 시 채운다.

1. `navigate` — 로그인 페이지로 이동
2. `input` (아이디), `input` (비밀번호) — 로그인 정보 입력
3. `click` — 로그인 버튼 클릭
4. `waitFor` — 로그인 완료 후 나타나는 요소 대기
5. `input` + `click` — 검색어 입력 및 검색 실행
6. `waitFor` 또는 `navigate` — 결과 페이지 로딩 대기/이동
7. `extract` → `setVariable` — 데이터 추출 후 변수에 저장
8. `custom` — `database.md`(R-007) 지침에 따라 모듈 테이블에 저장(`manage_db` 명령 또는 액션 스크립트 경유)
9. `type: response` 메시지로 결과 반환 (3장 요청/응답 포맷 준수)

각 단계에서 실패하면 7장 재시도 정책이 적용되고, 조건 분기가 필요하면 5장의 `condition`/`loop` 타입을 단계 사이에 추가한다.

---

## 9. 현재 구현 상태

### 9.1 구현 완료
- WebSocket 메시지 수신 및 필수 필드 검증 (1장)
- 표준 명령어 처리 (2장, switch 문 스텁)
- 요청/응답 포맷 (3장)
- heartbeat 메시지 및 연결 유지

### 9.2 미구현 (향후 개발 예정)
- **스크립트 페이로드(steps 배열) 처리**: 4장의 단계형 스크립트 구조를 파싱하고 순차 실행하는 엔진
- **condition/loop 처리**: 5장의 조건 분기 및 반복 실행 로직
- **setVariable 변수 관리**: 워크플로우 범위 내 변수 저장소
- **onSuccess/onFailure 분기**: 단계별 성공/실패 시 다음 단계 분기
- **timeout 처리**: 단계별 제한 시간 적용 및 강제 종료
- **재시도 정책**: 7장의 지수 백오프 재시도 로직
- **워크플로우 실행 엔진**: YAML 워크플로우 파일 파싱 및 실행

> **참고**: 위 미구현 항목은 `architecture.md` 1.4절의 현재 개발 범위에 따라 순차적으로 개발 예정이며, 구현 시 이 문서를 갱신한다.
