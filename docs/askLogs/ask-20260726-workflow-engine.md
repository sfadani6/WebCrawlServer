# askLogs 2026-07-26 - 워크플로우 엔진 및 미구현 기능 구현

> 관련 문서: docs/ask.md (요청사항), docs/rule/workflow-management.md (운영 절차)

---

## 요청사항

ask.md에 명시된 바와 같이:
1. 지금까지 처리한 내역의 항목별 처리 요구사항 및 처리 방식/결과를 CHANGELOG에 기록
2. todo.md 처리역은 askLogs에 기록
3. todo.md 처리내역은 삭제

---

## 처리 내역

### 1. 프로젝트 검수 및 문서 수정
- **요구사항**: AGENTS.md와 Rule Registry 불일치 해결
- **처리 방식**: 11건 중 10건 수정 (architecture.md, structure.md, database.md, adminDb.js, mcp.md, scheduler.md, monitoring.md, logging.md, security.md)
- **결과**: ✅ 성공 (이미 커밋됨)

### 2. MCP 스크립트 엔진 구현
- **요구사항**: mcp.md 9장 미구현 상태 해소
- **처리 방식**: `executeScript()`, `executeStep()` 함수 구현, setVariable/condition/loop 핸들러
- **결과**: ✅ 성공 (`server/scripts/scriptEngine.js` 신규 생성)

### 3. 스케줄러 엔진 구현
- **요구사항**: scheduler.md 6장 미구현 상태 해소
- **처리 방식**: `runJob()`, `startScheduler()` 함수 구현, overlap_policy 정책 적용
- **결과**: ✅ 성공 (`server/scheduler/jobRunner.js`, `cronParser.js` 신규 생성)

### 4. 모니터링 실시간 전송 구현
- **요구사항**: monitoring.md 4장 미구현 상태 해소
- **처리 방식**: `broadcastResourceUsage()` 로 CPU/메모리 사용량 WebSocket 전송
- **결과**: ✅ 성공 (`server/monitor/monitorWs.js` 신규 생성)

### 5. 로그 자동 생성·분리 구현
- **요구사항**: logging.md 4장 미구현 상태 해소
- **처리 방식**: `logs/YYYY-MM-DD.log` 형식으로 일자별 로그 생성, 자동 로테이션
- **결과**: ✅ 성공 (`server/logs/logRotator.js` 신규 생성)

### 6. 자동 재시도 로직 구현
- **요구사항**: security.md 4장 미구현 상태 해소
- **처리 방식**: `withRetry()` 함수로 최대 3회 재시도, error_logs 기록
- **결과**: ✅ 성공 (`server/middleware/retry.js` 신규 생성)

### 7. 워크플로우 엔진 구현
- **요구사항**: YAML 워크플로우 파싱 및 실행
- **처리 방식**: `runWorkflow()` 함수로 YAML 파싱, steps 배열 실행
- **결과**: ✅ 성공 (`server/workflows/workflowEngine.js` 신규 생성)

### 8. server/app.js 연동
- **요구사항**: 신규 모듈들을 서버에 연동
- **처리 방식**: 스케줄러/모니터링/로그 로터이터 시작 로직 추가
- **결과**: ✅ 성공