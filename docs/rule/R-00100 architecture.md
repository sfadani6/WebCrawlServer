# R-00100 docs/rule/R-00100 architecture.md

`WebCrawlServer`는 모노레포 형태로 구성된 분산 크롤링 수집 플랫폼입니다. 브라우저 확장 플러그인, 관리자 대시보드, 백엔드 서버를 하나의 저장소에서 통합 운영합니다.

## 시스템 구성

- `server/`: Express 기반 HTTP 서버 및 WebSocket 서버가 통합된 백엔드
- `admin/`: React + Vite로 구현된 관리자 UI
- `plugins/basic-plugin/`: Chrome/Opera 확장 플러그인 샘플 패키지
- `databases/`: SQLite 데이터베이스 파일 저장소
- `logs/`: 서버 및 관리 활동 로그 저장소
- `docs/`: 규칙, 요청, 결정, 이력 문서

## 데이터 흐름

1. 브라우저 확장 플러그인이 `clientId`를 생성 및 저장합니다.
2. 플러그인 백그라운드 워커가 `ws://localhost:9600?clientId=<uuid>&clientType=plugin`로 WebSocket 연결을 수립합니다.
3. 크롤링 데이터는 content script에서 수집되어 `RAW_DOM_DATA` 메시지로 백그라운드에 전달됩니다.
4. 백그라운드 워커는 `CRAWL_LOG` 패킷을 서버로 전송합니다.
5. 서버는 `crawl_logs` 테이블에 로그를 저장하고, 필요 시 관리자 UI로 브로드캐스트합니다.
6. 관리자 UI는 `ws://localhost:9600?clientId=admin-main&clientType=admin`로 연결하여 실시간 상태를 감시합니다.
7. 관리자는 `CRAWL_START`, `CRAWL_STOP` 명령을 특정 플러그인 또는 전체 클라이언트에 전송합니다.

## 주요 역할

- 백엔드: 실시간 메시지 중계, REST API, 데이터베이스 초기화 및 로그 저장
- 관리자 UI: 클라이언트 리스트 조회, 로그 확인, 원격 제어 명령 송출
- 플러그인: 브라우저 DOM 데이터 수집, 서버 연결 유지, 제어 명령 수신

## 운영 범위

- 현재 시스템은 MCP 서버가 아닌 로컬 WebSocket/REST 통신을 중심으로 동작합니다.
- 로컬 개발 환경은 Windows 11 Home, PowerShell 7.6.1, Node.js v25.9.0을 기준으로 설계되었습니다.
- ESM 기반 TypeScript 코드를 기준으로 하며, 글로벌 패키지 설치를 지양하는 로컬 격리 원칙을 따릅니다.

## 확장 포인트

- 인증/권한을 도입할 때는 `auth.md` 지침에 따라 API 및 관리자 페이지 인증을 구현합니다.
- 테스트 및 자동화는 `testing.md` 지침을 참고하여 추가합니다.
- 운영 및 모니터링 기능 확장은 `monitoring.md`와 `logging.md`를 기준으로 설계합니다.



