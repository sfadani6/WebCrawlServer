# R-00202 docs/rule/R-00202 monitoring.md

`WebCrawlServer`는 로컬 개발 환경을 기준으로 서버 및 클라이언트 상태 모니터링을 지원해야 합니다. 본 문서는 핵심 관찰 지표와 수집 방법을 정의합니다.

## 모니터링 대상

- WebSocket 연결 상태
- 활성 클라이언트 수
- 수집 로그 저장 상태
- 백엔드 서버 예외 로그
- 관리자 UI와 플러그인 간 통신 상태

## 수집 방식

- 실시간 WebSocket 이벤트를 통해 연결/종료 상태를 감시합니다.
- 로그 파일(`logs/server_system.log`, `logs/admin_activity.log`, `logs/plugins_comm.log`)을 통해 에러 및 활동을 추적합니다.
- 관리자 UI에서는 REST API로 `clients`와 `crawl_logs` 데이터를 조회합니다.

## 권장 지침

- 서버는 `activeClients` 맵을 통해 클라이언트 수를 실시간으로 추적합니다.
- WebSocket 연결 실패나 파싱 오류는 `server_system.log`에 기록합니다.
- 플러그인 통신 로그는 `plugins_comm.log`로 저장되어야 합니다.
- 관리자 UI는 통신 상태를 시각적으로 표시해야 합니다.

## 네트워크 진단 명령 (REST `POST /api/admin/network/diagnostic`)

관리자 네트워크 모니터링(`/network`)의 "패널 3 - 플러그인 소켓 검증" 드롭다운에서 실행하며, 응답은 `{ command, executedCommand, output }` 구조를 반환합니다.

- `node_sockets` (Node 소켓 목록): 가동 중인 모든 `node.exe` 프로세스가 점유한 소켓/포트 목록을 일괄 출력합니다. netstat에는 프로세스명이 없고 PID만 있으므로, Windows에서는 `tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH`로 node.exe PID를 수집한 뒤 `netstat -ano` 출력과 교차 매칭해 해당 PID 라인만 필터링합니다. 반환 구조: `{ nodePids, socketCount, sockets }` (비-Windows: `pgrep -x node` + `ss -tunap` best-effort).
- `system_listen_ports` (시스템 Listen 포트): 컴퓨터 전체에서 접속 대기 중(State = Listen)인 포트와 PID를 스캔합니다. Windows는 `netstat -ano | findstr LISTENING`(`-o` 포함으로 PID 표시), 비-Windows는 `netstat -anp | grep LISTEN || true`를 사용합니다.

주의: 셸 명령 실행은 `runShellCommand` 헬퍼를 거치며 Windows에서는 `euc-kr` 인코딩으로 디코딩해 한글 로케일 출력이 깨지지 않도록 합니다.

## 네트워크 모니터링 패널 드롭다운 표기 규격

관리자 `/network`의 4개 패널(패널 1 netstat 분석 / 패널 2 서버 & OS 모니터 / 패널 3 플러그인 소켓 검증 / 패널 4 범용 네트워크 검증) 드롭다운 옵션은 아래 규칙을 따릅니다.

- **순번 + 명령명 + 기능 설명**: 각 옵션 라벨은 `N. 명령명 — 기능 설명` 형태로 표기합니다. 예) `11. Node 소켓 목록 — 가동 중인 모든 node.exe가 점유한 소켓/포트 목록 일괄 출력`, `12. 시스템 Listen 포트 — 컴퓨터 전체에서 접속 대기 중(LISTEN)인 포트 및 PID 스캔`.
- **레지스트리 단일 소스**: admin `NetworkMonitorView.tsx`에 패널별 `DiagCommandMeta { command, label, description }` 레지스트리(`NETSTAT_COMMANDS`/`SERVER_OS_COMMANDS`/`SOCKET_VERIFY_COMMANDS`/`NETWORK_VERIFY_COMMANDS`)를 정의하고, 드롭다운 옵션과 설명 출력은 이 레지스트리에서만 렌더링합니다.

## 터미널 콘솔 출력 규격

명령 실행 시 콘솔에는 아래 순서로 출력합니다.

1. **명령 설명**: `[실행] <명령명> — <기능 설명>` (선택 직후)
2. **실행 중 표시**: `[진행] <명령명>(<command>) 실행 중...`
3. **실제 실행된 명령 전체 파라미터**: `$ <executedCommand>`
   - PowerShell/셸 명령이면 전체 명령(예: `netstat -ano | findstr LISTENING`, `powershell -Command "..."`)
   - Node.js 스크립트면 수행 스크립트(예: `Node.js: os.cpus() + os.loadavg() + process.cpuUsage()`)
4. **구분선**: `--------------`
5. **명령 결과**: 응답 `output` 본문 (최대 `MAX_OUTPUT_CHARS` = 4000자 초과 시 잘림 안내)
6. **구분선 + 완료 요약**: `--------------` 후 `[완료: <명령명>] 소요 <ms>ms, 출력 <n>자`

서버는 모든 진단 케이스에서 `executedCommand`에 실제 실행 명령(Node.js 스크립트 또는 전체 셸 명령)을 채워야 하며, 빈 문자열로 응답해서는 안 됩니다.



