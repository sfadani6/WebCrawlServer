# 작업 요청 (docs/ask.md)

> 작업 완료: 2026-07-26 19:30:00
> R-008 workflow-management.md 2장: 처리 완료 후 결과를 함께 정리

---

## 요청

프로젝트 전체를 분석하고 미처리 항목과 개선사항 추가사항을 매우 자세하게 todo.md 에 기록해줘

---

## 처리 결과

### 수행 내용
- server/ 디렉토리 내 15개 주요 소스 코드 파일 전면 분석
- 기존 todo.md(5개 항목)를 7개 우선순위 레벨(P0~P3)로 구조화된 27개 작업 항목으로 확장

### 주요 발견 사항

**P0 (긴급 버그)** — 3건
1. app.js WebSocket verifyClient에서 allowedOrigins 참조 오류 (변수 정의 전 사용)
2. server/logs/logRotator.js 파일 누락 (서버 크래시 원인)
3. WS_TOKEN 기본값 하드코딩 보안 위험

**P1 (미구현 기능)** — 9건
- 4개 관리자 콘솔 페이지(/modules, /workflows, /scheduler, /logs) 미구현
- scriptEngine.js 브라우저 자동화 액션 5개 스텁 상태
- scheduler queue 정책, cron 파서, NLP 패턴 미완성

**P2 (개선 사항)** — 13건
- DB 연결 풀 부재, 6개 파일에 DB 연결 코드 중복
- API 응답 형식/에러 처리/환경변수 검증 체계 미흡
- 프론트엔드 페이지네이션/정렬/필터 기능 부재
- SQL Injection 화이트리스트 보안 강화 필요

**P3 (테스트/문서/인프라)** — 5건
- 단위/통합 테스트 완전 부재, Swagger API 문서 부재
- Docker 환경, DB 마이그레이션, 로그 로테이터 미구현

### 관련 파일
- docs/todo.md — 상세 작업 목록
- docs/askLogs/ask-20260726193000.md — 분석 상세 로그
- docs/todo.history.md — 작업 이력 추가