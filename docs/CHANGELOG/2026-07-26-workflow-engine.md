# Changelog 2026-07-26 - 워크플로우 엔진 및 미구현 기능 구현

## 기능 구현 (feat)

### MCP 스크립트 엔진 (R-004)
- `server/scripts/scriptEngine.js` 신규 생성
- `executeScript()`, `executeStep()` 함수 구현
- `setVariable`, `condition`, `loop` 핸들러 구현
- `error_logs` 테이블 연동

### 스케줄러 엔진 (R-005)
- `server/scheduler/jobRunner.js` 신규 생성
- `runJob()`, `startScheduler()` 함수 구현
- `overlap_policy`(skip/queue/parallel) 정책 구현
- cron 파서 `server/scheduler/cronParser.js` 추가

### 모니터링 실시간 전송 (R-006)
- `server/monitor/monitorWs.js` 신규 생성
- CPU/메모리 사용량 실시간 WebSocket broadcast
- `activity_logs` 테이블에 리소스 사용량 기록

### 로그 자동 생성·분리 (R-009)
- `server/logs/logRotator.js` 신규 생성
- `logs/YYYY-MM-DD.log` 형식 일자별 로그 파일 생성
- 자동 로테이션 로직 (자정 기준)

### 자동 재시도 로직 (R-013)
- `server/middleware/retry.js` 신규 생성
- 최대 3회 재시도 (`withRetry()`)
- `error_logs` 기록, Slack Webhook 옵션

### 워크플로우 엔진 (R-008)
- `server/workflows/workflowEngine.js` 신규 생성
- YAML 파싱 및 steps 배열 실행
- `validateWorkflow()` 함수로 워크플로우 검증

## 코드 변경 (server/app.js)
- 스케줄러 모듈 연동 (`startScheduler(wss)`)
- 모니터링 모듈 연동 (`startMonitor(wss)`)
- 로그 로터이터 모듈 연동 (`startLogRotator()`)

## 문서 변경
- `docs/rule/architecture.md`: 인증 명시 추가
- `docs/rule/structure.md`: 디렉토리 구조 실제 반영
- `docs/rule/database.md`: admin_credentials 보호 테이블 추가
- `docs/rule/mcp.md`: 미구현 상태 명시
- `docs/rule/scheduler.md`: 미구현 상태 명시
- `docs/rule/monitoring.md`: 미구현 상태 명시
- `docs/rule/logging.md`: 미구현 상태 명시
- `docs/rule/security.md`: 미구현 상태 명시
- `docs/decision/0002-basic-auth-implementation.md`: ADR 작성