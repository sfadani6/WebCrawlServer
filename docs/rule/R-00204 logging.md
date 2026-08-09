# R-00204 docs/rule/R-00204 logging.md

`WebCrawlServer`는 로컬 로그 파일 기반의 운영 기록과 별개로 `databases/serverlogs.db`에 DB 기반 시스템 로그를 함께 보관합니다. 본 문서는 로그 분류, 저장 위치, 기록 규칙을 정의합니다.

## 로그 분류

- `logs/server_system.log`: 서버 상태, 예외, 포트 바인딩, WebSocket 연결 상태 기록
- `logs/admin_activity.log`: 관리자 명령 송출, 블랙리스트 처리, 관리 작업 기록
- `logs/plugins_comm.log`: 플러그인 통신 이벤트, 수집 패킷 송수신 기록
- `databases/serverlogs.db` > `systemlog` 테이블: 서버 기동 검증 등 이벤트성 DB 기반 시스템 로그

## 기록 규칙

- 로그는 동기식 `appendFileSync` 방식으로 기록합니다.
- 로그 파일이 존재하지 않으면 자동으로 생성해야 합니다.
- 로그 라인은 타임스탬프, 레벨, 식별자, 메시지를 포함해야 합니다.
- **로그 기록 실패 예외 격리**: `logPluginComm()`/`logServerSystem()`은 내부적으로 `appendFileSync` 실패 예외를 삼켜, 파일 쓰기 오류가 소켓 통신·DB 처리·별칭 저장 등 상위 운영 흐름을 중단시키지 않도록 합니다. 로그 기록은 부가 기능이며 실패가 핵심 처리 파이프라인을 죽이면 안 됩니다.
- **빈 catch 금지**: 패킷/이벤트 처리의 예외 구문은 `catch {}`로 조용히 삼키지 않고 최소 `logServerSystem("WARN", ...)`을 통해 실패 사유를 남겨 원인 추적이 가능하도록 합니다.

## DB 기반 시스템 로그(systemlog)

- `systemlog` 테이블은 `databases/serverlogs.db`에 위치하며 `insertSystemLog()` 함수로 기록합니다.
- 스키마:
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT (PK ID)
  - `msg_type` TEXT NOT NULL (메세지 종류, 예: `INIT`, `CONFIG`, `ERROR`)
  - `message` TEXT NOT NULL (메세지 본문)
  - `code` INTEGER NOT NULL DEFAULT 1 (숫자 구분 코드)
- 조회는 `getSystemLogs(limit, offset)` 함수를 사용하며 최신순(id DESC)으로 반환합니다.

## 초기 환경 설정 값 검증

- 서버 기동 시 `runStartupValidation()`이 `configs.data_path`(데이터 저장 디렉토리)의 실존 여부를 검증합니다.
- 디렉토리가 없으면 ① 부재 발견 ② 생성 완료 순으로 `systemlog`에 2건 기록하고 디렉토리를 자동 생성합니다.
- 디렉토리가 이미 존재하면 systemlog에 기록을 남기지 않습니다.

## 운영 지침

- 오류와 예외는 `server_system.log`에 기록합니다.
- 관리자 작업은 `admin_activity.log`에 기록합니다.
- 플러그인 통신은 `plugins_comm.log`에 기록합니다.
- 로그 파일은 `logs/` 폴더에 위치해야 합니다.
- DB 기반 시스템 로그는 `databases/serverlogs.db`의 `systemlog` 테이블에 기록합니다.



