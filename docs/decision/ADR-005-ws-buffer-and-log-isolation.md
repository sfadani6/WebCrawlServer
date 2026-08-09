# ADR-005: 웹소켓 수신 메시지 Buffer 처리 및 로그 예외 격리 채택

> **상태**: 승인됨 (Accepted)
> **날짜**: 2026-08-09
> **결정자**: 시스템 아키텍트 & 개발 팀
> **관련 문서**: AGENTS.md, R-00203, R-00204, R-00207, R-00420

---

## 1. 배경 및 문제 정의 (Context & Problem Statement)

cycle 7(클라이언트 4컬럼 재구성 + 플러그인 메시지 원장/파일 저장) 검증 중 다음 장애가 확인되었습니다.

1. **플러그인 환경설정(별칭) 미저장 + ACK 미수신**: `CLIENT_CONFIG_UPDATE` 패킷을 보내도 DB `clients.alias`에 저장되지 않고 `CLIENT_CONFIG_UPDATE_ACK`가 수신되지 않았습니다.
2. **원인 은폐**: 메시지 핸들러의 `catch {}` 빈 구문이 예외를 조용히 삼켜 `plugins_comm.log`에는 기록이 없고, 실패 원인을 로그/콘솔로 추적할 수 없는 상태였습니다.
3. **로그 실패 전파 취약성**: `logPluginComm()`/`logServerSystem()`이 내부에서 `appendFileSync`를 그대로 호출해, 로그 파일 쓰기 실패 시 예외가 상위 소켓 통신·DB 처리 파이프라인으로 전파되어 후속 처리를 중단시킬 수 있었습니다.
4. **구버전 스키마 비호환**: `CREATE TABLE IF NOT EXISTS`는 기존 `crawl_logs` 테이블의 스키마를 갱신하지 않아, 신규 `action`/`file_path` 등 컬럼이 없는 구버전 테이블이 유지되어 `no such column` 예외가 발생할 수 있었습니다.

### 근본 원인 (Root Cause)

`ws`의 `message` 이벤트 `data`는 기본적으로 **Buffer** 타입입니다. `JSON.parse`는 Buffer를 암시 변환해 동작하지만, `logPluginComm(..., rawData.substring(0, 200))`처럼 문자열 API(`substring`)를 Buffer에 호출하면 `rawData.substring is not a function` 예외가 발생합니다. 이 예외가 핸들러 중간에서 던져져 이후 별칭 저장·ACK 전송이 중단되었고, 빈 `catch`가 이를 은폐했습니다.

---

## 2. 고려된 대안들 (Considered Options)

### 대안 1: 예외 발생 지점만 수정 (기존 방식 유지)
- **장점**: `substring` 호출부만 `toString()`을 붙이면 당장 예외는 해결됨.
- **단점**: 빈 `catch`가 계속 예외를 은폐하고, 향후 다른 Buffer 문자열 API 사용 시 동일 장애 재발 가능. 로그 실패 시 파이프라인 중단 위험 잔존.

### 대안 2: 근본 가드 도입 (선택안)
- **장점**:
  - 핸들러 진입 직후 수신 데이터를 string으로 보장하여 Buffer API 오용을 차단.
  - 빈 `catch` 금지 + 최소 `WARN` 로그로 원인 추적 보장.
  - 로그 함수 내부 예외 격리로 파일 쓰기 실패가 핵심 처리 흐름을 죽이지 않음.
  - 구버전 테이블에 대한 PRAGMA 기반 컬럼 마이그레이션으로 스키마 비호환 제거.
- **단점**: 유틸 함수 및 마이그레이션 로직 추가 구현 필요.

---

## 3. 아키텍처 결정 사항 (Decision)

**대안 2 (근본 가드 도입)를 채택합니다.**

### 상세 결정 규정:
1. **수신 데이터 string 보장**: `ws.on("message")` 핸들러 진입 직후 `const rawData = typeof data === "string" ? data : data.toString();`으로 변환합니다. 이후 모든 코드는 문자열 API를 안전하게 사용합니다.
2. **빈 catch 금지**: 패킷 파싱/처리 예외 구문은 `logServerSystem("WARN", \`플러그인 패킷 처리 예외 ...\`)`으로 실패 사유를 기록하며 무중단을 유지합니다.
3. **로그 실패 예외 격리**: `logPluginComm()`/`logServerSystem()` 내부에서 `appendFileSync` 호출을 try/catch로 감싸, 로그 기록 실패가 소켓 통신·DB 처리·별칭 저장·ACK 전송을 중단하지 않도록 합니다. 호출부에서도 개별 가드를 추가해 이중 방어합니다.
4. **구버전 테이블 컬럼 마이그레이션**: `ensureCrawlLogsTableSchema()`가 `PRAGMA table_info(crawl_logs)`를 기준으로 최신 컬럼(`domain`/`action`/`worker_name`/`url`/`title`/`file_path`/`file_size`)이 없으면 부재 컬럼만 `ALTER TABLE ... ADD COLUMN`으로 추가합니다. `clients`는 `ensureClientsTableSchema()`에서 6컬럼→4컬럼 재생성 및 `alias` 누락 보완을 수행합니다.

---

## 4. 파급 효과 및 이점 (Consequences)

### 긍정적 이점:
- **신뢰성**: 별칭 저장·ACK·수집 액션 처리가 로그 실패나 패킷 타입 오용으로 중단되지 않음.
- **관측성**: 예외가 WARN 로그로 남아 `server_system.log`에서 실패 원인을 즉시 추적 가능.
- **스키마 정합**: 구버전 DB를 가진 환경에서도 기동 시 자동 마이그레이션으로 최신 스키마 보장.

### 적용 위치:
- `server/src/index.ts` (ws message 핸들러: string 변환, 빈 catch → WARN, logPluginComm 호출부 가드)
- `server/src/logger.ts` (logPluginComm/logServerSystem 내부 예외 격리)
- `server/src/database.ts` (ensureCrawlLogsTableSchema 전체 컬럼 마이그레이션)

### 검증 결과 (2026-08-09):
- `CLIENT_CONFIG_UPDATE` → `CLIENT_CONFIG_UPDATE_ACK` 수신 성공, `clients.alias` 저장 확인.
- `plugins_comm.log`에 "수신 패킷 처리"/"별칭 저장 완료" 기록 정상, `rawData.substring` WARN 소거.
- `crawl_logs` 최종 컬럼: `id, client_id, log_message, timestamp, action, domain, worker_name, url, title, file_path, file_size`.
- 원장(`plugin_messages`) + 평면 구조 파일 저장(`clients/<clientId>/<action>/`) 정상.
