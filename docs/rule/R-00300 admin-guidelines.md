# R-00300 docs/rule/R-00300 admin-guidelines.md

`WebCrawlServer` 관리자 기능과 운영 UI에 대한 지침 문서입니다. 본 문서는 관리자 대시보드가 수행해야 할 기능, WebSocket/REST 통신 계약, 관리자 제어 흐름, 예외 처리 및 운영 로그 작성 원칙을 정의합니다.

## 적용 범위

- `admin/src/` 기반 관리자 대시보드 UI 및 기능
- 관리자 명령 송출 흐름과 REST API 호출
- 관리자 세션 식별, 제어 대상 기기 선택, 로그 조회 및 로그 정리 기능
- 관리자 활동 기록 및 예외 처리 지침

## 주요 지침

### 1. 관리자 기능 정의

1.1 관리자 대시보드는 `CRAWL_START`, `CRAWL_STOP` 등 원격 제어 명령을 플러그인으로 송출해야 합니다.
1.2 관리자 대시보드는 `ws://localhost:9600?clientId=admin-main&clientType=admin` 형식으로 서버에 WebSocket을 연결해야 합니다.
1.3 관리자 대시보드는 `GET /api/db/clients`, `GET /api/db/logs`, `DELETE /api/db/logs`, `DELETE /api/db/clients/:clientId` 등의 REST API를 이용해야 합니다.

### 2. 통신 계약

2.1 관리자와 서버 간 WebSocket 메시지는 `senderId`, `targetId`, `action`, `payload`를 포함해야 합니다.
2.2 관리자 명령 패킷은 `targetId`를 특정 클라이언트 ID 또는 `ALL`로 설정하여 전달합니다.
2.3 REST API 응답은 `{ success: true|false, data?, message? }` 형태를 유지해야 합니다.

### 3. 관리자 UI 원칙

3.1 UI는 단순 제어와 상태 확인에 집중해야 합니다.
3.2 관리자 명령 실행 전 사용자 확인(예: 로그 삭제, 클라이언트 추방)을 반드시 요구합니다.
3.3 소켓 연결 상태와 API 상태를 시각적으로 명확하게 표시해야 합니다.
3.4 관리자 UI/UX 디자인은 `docs/rule/R-00302 admin-ui-ux-guidelines.md`를 준수해야 합니다.
3.5 버튼, 배지, 테이블, 카드 등의 시각 요소는 일관된 색상과 타이포그래피를 유지해야 합니다.

### 4. 예외 처리 및 운영 로그

4.1 관리자 명령 송출 실패 시 사용자에게 명확한 오류 메시지를 표시해야 합니다.
4.2 관리자 활동 로그는 서버의 `logs/admin_activity.log`와 연계되어야 합니다.
4.3 관리자 UI는 서버 오프라인, API 실패, 소켓 연결 끊김 상황을 분리하여 처리해야 합니다.

### 5. 접근성 원칙

5.1 모든 UI 요소는 기본적으로 텍스트 선택을 허용해야 합니다.
5.2 `select-none`의 사용은 R-00302 3.4절을 엄격히 준수해야 합니다.
