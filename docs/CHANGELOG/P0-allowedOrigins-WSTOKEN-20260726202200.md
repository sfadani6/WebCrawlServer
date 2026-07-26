# P0 버그 수정: allowedOrigins 참조 오류 및 WS_TOKEN 보안 강화

> 처리 일시: 2026-07-26 20:22:00
> 관련 askLogs: docs/askLogs/ask-20260726202200.md

---

## 변경 개요

server/app.js의 WebSocket verifyClient 콜백에서 allowedOrigins 변수가 정의되기 전에 참조되던 JavaScript 호이스팅 버그 수정. WS_TOKEN 기본값 하드코딩 제거 및 환경변수 필수화.

---

## 변경된 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| server/app.js | 수정 | allowedOrigins/WS_TOKEN 선언을 verifyClient 위로 이동, ENV_VARS 검증 추가 |

---

## 상세 변경 내용

### 1. server/app.js
- **변경 전**: `allowedOrigins`가 42행 verifyClient에서 참조됐지만 실제 선언은 79행에 위치 → `undefined` 상태로 평가
- **변경 후**: `allowedOrigins`와 `WS_TOKEN` 선언을 verifyClient 위로 이동. ENV_VARS 배열로 7개 환경변수 누락 검증 추가
- **변경 이유**: WebSocket 연결이 전부 차단되는 치명적 버그 수정. WS_TOKEN 기본값 하드코딩 제거로 보안 강화

---

## 변경 이유

P0 버그로 서버 WebSocket 기능이 완전히 동작하지 않았음. WS_TOKEN 기본값이 소스코드에 노출되어 보안 취약점.