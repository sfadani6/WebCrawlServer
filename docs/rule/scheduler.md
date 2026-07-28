# R-005 스케줄러(Scheduler) 규칙 (scheduler.md)

> Version: 1.1.0
> 작성자: 사용자
> 수정일: 2026-07-25
> 검토일: 2026-07-25
> 수정 이유: instructions.md 5장을 별도 문서로 분리. 5.2에 작업 상태(status) 값 정의 신설, 5.5에 동시 실행/Overlap/Skip/Queue 정책 신설 — 기존 문서에는 상태값과 중복 실행 처리 기준이 없어 구현 시 임의 판단 여지가 있었음
> 관련 문서: docs/rule/instructions.md(R-000), docs/rule/mcp.md(R-004), docs/rule/database.md(R-007), docs/rule/monitoring.md(R-006)
> 영향 범위: 신규 분리 문서, 기존 instructions.md 5장을 대체. `scheduled_jobs` 테이블에 `status` 컬럼 추가 필요(database.md 갱신 필요, 실제 스키마 반영은 구현 시점에 진행)
> Breaking Change 여부: 있음 — `scheduled_jobs` 테이블에 `status` 컬럼이 필요하므로 기존 스키마 대비 컬럼 추가가 필요하다. 실제 DB 반영 전까지는 설계 초안으로만 취급한다.

이 문서는 초기 설계 수준이며, 구현 중 세부사항이 달라지면 즉시 갱신한다.

---

## 6. 현재 구현 상태

### 6.1 구현 완료
- `scheduled_jobs` 테이블 생성 (status, overlap_policy 컬럼 포함)
- status 값: waiting, running, paused, disabled, completed, failed (문서와 일치하도록 DEFAULT 'waiting' 적용)

### 6.2 미구현 (향후 개발 예정)
- **cron 라이브러리 연동**: node-cron 또는 동급 라이브러리가 아직 연동되지 않음
- **스케줄러 엔진**: 예약 작업 등록, 실행, 상태 관리 로직 미구현
- **Overlap/Queue/Skip 정책 실행**: protectedTables에 명시된 정책 로직만 있고 실제 실행 로직 미구현
- **서버 시작 시 작업 등록**: `enabled = true`인 작업들을 스케줄러에 자동 등록하지 않음

> **참고**: 위 미구현 항목은 `architecture.md` 1.4절의 현재 개발 범위에 따라 순차적으로 개발 예정이며, 구현 시 이 문서를 갱신한다.

---

## 1. 실행 방식
- **예약 실행(once)**: 지정한 특정 일시에 1회 실행
- **주기 실행(interval)**: 고정 간격(예: n분/n시간마다)으로 반복 실행
- **Cron 실행(cron)**: `분 시 일 월 요일` 형식의 cron 표현식 기반 실행, `tech-stack.md`(R-002)의 cron 라이브러리로 등록
- **조건 실행(condition)**: 특정 이벤트(예: 특정 모듈의 `activity_logs` 상태 변화)를 트리거로 실행하며, 트리거 조건식은 `mcp.md`(R-004) 5장 Condition 규칙을 따른다.

## 2. 등록 및 저장
- 예약 작업은 `scheduled_jobs` 코어 테이블(`database.md` 참조)에 저장한다.
- 필수 컬럼: `job_id`, `module`, `action_or_script_id`, `schedule_type`(`once`/`interval`/`cron`/`condition`), `schedule_value`(일시/간격/cron 표현식/조건식), `status`(2.1 참조), `enabled`, `overlap_policy`(5장 참조), `last_run_at`, `next_run_at`, `created_at`.
- 서버 시작 시 `scheduled_jobs`의 `enabled = true` 항목을 모두 읽어 스케줄러에 등록한다. 서버가 꺼져 있던 동안 지난 `once` 작업의 재실행 여부는 관리자 페이지에서 수동으로 결정한다(자동 소급 실행하지 않음).

### 2.1 작업 상태(status) 정의

작업 자체의 등록 상태(`enabled`)와는 별개로, 실행 시점의 상태를 아래 값 중 하나로 표시한다. 관리자 페이지 목록/상세 화면에서 이 값을 노출한다.

| status | 의미 |
|---|---|
| `waiting` | 등록되어 다음 실행 시각을 대기 중 |
| `running` | 현재 실행 중 |
| `paused` | 사용자가 일시 중지시킴(자동 재개되지 않으며 수동으로 `waiting`으로 전환) |
| `disabled` | `enabled = false`로 등록만 되어 있고 스케줄러에 올라가지 않은 상태 |
| `completed` | `once` 작업이 정상 종료되어 더 이상 재실행되지 않는 상태 |
| `failed` | 최근 실행이 실패로 종료된 상태(재시도 정책은 `security.md` R-013 및 4장을 따르되, 재시도 소진 후 최종 상태는 `failed`로 기록) |

- `interval`/`cron`/`condition` 작업은 `completed` 상태로 전이하지 않는다. 사용자가 `enabled`를 끄기 전까지 `waiting` ↔ `running` ↔ `failed` 사이를 반복한다.
- `paused`는 `enabled = true`이지만 스케줄러가 트리거하지 않도록 별도로 표시하는 상태다. `disabled`(등록 자체를 끔)와는 구분한다.

## 3. 실행과 로그
- 스케줄러가 트리거한 작업은 일반 워크플로우 실행과 동일하게 `mcp.md`(R-004) 메시지(`type: request` 또는 `type: script`)로 처리하고, 결과를 `activity_logs`(`logging.md` 참조)에 기록한다.
- 실행 실패 시 `mcp.md` 7장(오류/재시도) 및 `security.md`(예외 처리)를 그대로 따른다. 스케줄러 전용 재시도 규칙은 별도로 두지 않는다.
- 매 실행 후 `scheduled_jobs.last_run_at`을 갱신하고, `schedule_type`에 따라 `next_run_at`을 재계산한다. 실행 종료 시점의 `status`도 함께 갱신한다(2.1 참조).

## 4. 범위 제한
- `architecture.md`(R-001) 1.4절의 개발 범위에 따라 사용자별 스케줄 분리, 원격/외부 트리거 수신은 다루지 않는다. 스케줄러는 로컬 서버 프로세스 안에서만 동작한다.

## 5. 동시 실행 및 Overlap/Skip/Queue 정책

기존 문서에는 동일 작업의 이전 실행이 끝나기 전에 다음 실행 시각이 도래했을 때의 처리 기준이 없었다. 아래를 기본 정책으로 신설한다.

- **기본 정책은 Skip이다.** 동일 `job_id`의 이전 실행이 아직 `running` 상태인데 다음 실행 시각이 도래하면, 기본적으로 이번 회차는 건너뛴다(Skip). 건너뛴 사실은 `activity_logs`에 `status: skipped`로 기록한다.
- `scheduled_jobs.overlap_policy` 컬럼으로 작업별로 아래 값 중 하나를 선택할 수 있다.
  - `skip`(기본값): 이전 실행이 끝나지 않았으면 이번 회차를 건너뛴다.
  - `queue`: 이번 회차를 대기열에 넣고 이전 실행이 끝난 직후 순차 실행한다. 대기열은 작업당 최대 1건만 유지하며, 대기 중에 또 다음 회차가 도래하면 오래된 대기 항목을 새 항목으로 교체한다(대기열이 무한히 쌓이는 것을 방지).
  - `parallel`: 이전 실행과 무관하게 동시에 새 실행을 시작한다. 리소스 경쟁 위험이 있으므로 CPU/메모리 사용량이 낮은 작업에만 사용을 권장한다.
- 정책 선택 기준에 대한 세부 가이드는 아직 없다. 실제 운영하며 특정 모듈에 어떤 정책이 적합한지 판단되면 이 절에 사례를 추가한다.
- Queue/Parallel 정책을 사용하는 작업이 늘어나면 리소스 사용량을 `monitoring.md`(R-006)에서 함께 확인한다.
