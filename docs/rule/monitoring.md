# R-006 모니터링(Monitoring) 규칙 (monitoring.md)

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-26
> 검토일: 2026-07-26
> 수정 이유: instructions.md 6장을 별도 문서로 분리. 4장에 현재 구현 상태 명시 추가
> 관련 문서: docs/rule/instructions.md(R-000), docs/rule/scheduler.md(R-005), docs/rule/logging.md(R-009)
> 영향 범위: 신규 분리 문서, 기존 instructions.md 6장을 대체. 구현 상태 명시 추가
> Breaking Change 여부: 없음 (기존 내용 유지 + 상태 명시 추가)

기존 `activity_logs`의 `cpu_usage`/`memory_usage` 컬럼(`database.md` 참조)과 연결된다. 초기 설계 수준이므로 구현 중 세부사항이 달라지면 즉시 갱신한다.

---

## 1. 수집 대상
- 모듈/워크플로우 실행 상태: `running` / `success` / `error` / `stopped`
- `run_process`로 실행한 로컬 프로세스의 CPU/메모리 사용량
- 스케줄러 작업 상태: `next_run_at`, `last_run_at`, 최근 실행 결과, `status`(`scheduler.md` 2.1 참조)

## 2. 수집 방식
- 실행 상태 조회는 MCP `monitor_status` 명령(`mcp.md` 2장)을 사용한다.
- 리소스 사용량은 주기적으로 폴링해 `activity_logs`에 갱신한다. 폴링 주기는 `config/`에서 설정하며 기본값은 구현 시점에 정해 이 문서에 반영한다.

## 3. 관리자 페이지 노출
- 관리자 페이지는 모듈별 실행 상태, 리소스 사용량, 스케줄러 다음 실행 시각과 상태(`scheduler.md` 2.1)를 목록/상세 화면에서 조회할 수 있어야 한다.
- 임계치(threshold) 기반 자동 알림 기능은 현재 범위에 포함하지 않는다. 필요해지면 별도로 논의한 뒤 이 장에 반영한다.

---

## 4. 현재 구현 상태

### 4.1 구현 완료
- `activity_logs` 테이블에 `cpu_usage`, `memory_usage` 컬럼 포함
- MCP `monitor_status` 명령어 정의 (서버에서 수신 대기 중)

### 4.2 미구현 (향후 개발 예정)
- **리소스 사용량 폴링 로직**: 주기적 CPU/메모리 사용량 수집 및 `activity_logs`에 기록하는 로직 미구현
- **process 모듈 연동**: `run_process`로 실행한 외부 프로세스의 리소스 사용량 수집 미구현
- **WebSocket 실시간 전송**: 수집된 리소스 사용량을 WebSocket으로 실시간 전송 로직 미구현

> **참고**: 위 미구현 항목은 `architecture.md` 1.4절의 현재 개발 범위에 따라 순차적으로 개발 예정이며, 구현 시 이 문서를 갱신한다.