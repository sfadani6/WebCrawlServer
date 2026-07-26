# 작업 요청 (docs/ask.md)

> R-008 workflow-management.md 2장: 작업 요청 및 결과 기록

---

## 요청

todo.md 전체 항목을 처리하고 관련 기록을 남겨줘

---

## 처리 결과 (1차: P0 버그 수정 완료)

### 완료된 작업

**P0 버그 3건 — 모두 해결**

1. **app.js WebSocket verifyClient에서 allowedOrigins 참조 오류** ✅
   - `allowedOrigins` 선언을 `verifyClient` 위로 이동
   - `WS_TOKEN`도 함께 상단으로 이동하여 참조 시점 문제 해결

2. **server/logs/logRotator.js 파일 누락** ✅
   - 로그 파일 로테이션 모듈 신규 생성
   - 일자별 로그 파일 자동 생성 (`logs/server-YYYY-MM-DD.log`)
   - 30일 보관 정책 (환경변수 `LOG_RETENTION_DAYS`로 설정 가능)
   - `activity_logs`/`error_logs` DB 레코드 정리 기능 포함
   - 1시간 간격 자동 체크

3. **WS_TOKEN 기본값 하드코딩** ✅
   - 기본값 `'default-ws-token'` 제거
   - 환경변수 미설정 시 `console.warn` 경고 출력
   - WS_TOKEN 없으면 WebSocket 연결 전부 거부 (503)

### 미처리 항목 (24건)
- P1 미구현 페이지 4건 — 프론트엔드 개발 필요
- P1 백엔드 미구현 5건 — 브라우저 자동화, queue 정책, cron 파서, NLP, 빌드
- P2 아키텍처 개선 6건 — DB 연결 풀, 코드 중복, 에러 처리, 응답 형식 등
- P2 프론트엔드 개선 4건 — 페이지네이션, CSV, CSS, 라우팅
- P2 보안 강화 3건 — SQL Injection, 레이트 리밋, 로그 마스킹
- P3 테스트/문서/인프라 5건

### 변경 파일
- server/app.js — allowedOrigins/WS_TOKEN 위치 이동, 보안 경고 추가
- server/logs/logRotator.js — 신규 생성 (로그 로테이터)
- docs/todo.md — P0 항목 상태 ✅ 해결로 갱신