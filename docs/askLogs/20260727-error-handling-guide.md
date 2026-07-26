# 에러 처리 미들웨어 통합 가이드 요청

> Version: 1.0.0
> 요청일: 2026-07-27

---

## 요청 내용
에러 처리 미들웨어 통합에 대한 가이드 지침 요청.

---

## 처리 결과
- `docs/tips/error-handling-guide.md` 작성 완료
- 기존 `server/middleware/response.js` 구조 정리
- Express/WebSocket 에러 처리 패턴 정리

---

## 변경 파일
- `docs/tips/error-handling-guide.md`: 신규 작성
- `docs/todo.history.md`: 이력 추가

---

## 비고
- `response.js`의 `success`/`fail`/`paginated` 래퍼 사용 표준화
- WebSocket 에러에는 `type: 'response'` 필수 포함