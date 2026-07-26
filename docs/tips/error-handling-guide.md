# 에러 처리 미들웨어 통합 가이드

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-27
> 검토일: 2026-07-27
> 수정 이유: 에러 처리 미들웨어 표준 구조 가이드 작성
> 관련 문서: docs/rule/security.md(R-013), docs/rule/communication.md(R-012)

---

## 1. 배경 및 필요성

### 1.1 현재 상황
- `server/middleware/response.js`에서 `success`, `fail`, `paginated` 응답 래퍼 제공
- `server/app.js` 349~356줄에 Express 오류 처리 미들웨어 적용
- WebSocket 에러 처리: 306~316줄, 325~327줄

### 1.2 표준화 목적
- 일관된 API 응답 형식 유지
- 민감 정보 노출 방지
- 프론트엔드에서 예측 가능한 에러 처리

---

## 2. 표준 응답 형식

### 2.1 성공 응답
```json
{
  "status": "success",
  "data": {...},
  "timestamp": "2026-07-27T01:00:00.000Z"
}
```

### 2.2 실패 응답
```json
{
  "status": "error",
  "message": "에러 메시지",
  "timestamp": "2026-07-27T01:00:00.000Z"
}
```

### 2.3 개발 환경 상세 응답
```json
{
  "status": "error",
  "message": "에러 메시지",
  "details": {
    "error": "Error message",
    "stack": "Stack trace..."
  },
  "timestamp": "..."
}
```

---

## 3. Express 에러 처리 미들웨어

### 3.1 사용 예시
```js
// server/app.js
const { fail } = require('./middleware/response');

// 모든 라우터 뒤에 위치
app.use((err, req, res, next) => {
  console.error('[Express] 서버 오류:', err);
  const isDev = process.env.NODE_ENV === 'development';
  const details = isDev ? { error: err.message, stack: err.stack } : undefined;
  return fail(res, '내부 서버 오류', 500, details);
});
```

### 3.2 404 처리
```js
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: '페이지를 찾을 수 없습니다.'
  });
});
```

---

## 4. 사용 규칙

### 4.1 필수 적용 사항
- 모든 라우터에서 `try/catch` 또는 `async (req, res, next)` 사용
- 에러는 반드시 `next(err)`로 전달
- `response.js`의 `success`/`fail` 함수만 사용

### 4.2 비허용 사항
- 응답 형식이 다른 커스텀 에러 객체 반환 금지
- 스택 트레이스를 운영 환경에서 노출 금지
- 민감 정보(비밀번호, 키 등) 로그 출력 금지

### 4.3 모듈별 적용 예시
```js
// routes/api.js
async function handler(req, res, next) {
  try {
    const result = await someOperation();
    return success(res, result);
  } catch (err) {
    next(err); // 미들웨어로 전달
  }
}
```

---

## 5. WebSocket 에러 처리

### 5.1 메시지 처리 오류
```js
// server/app.js
ws.on('message', (message) => {
  try {
    // 메시지 처리
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'response',
      status: 'error',
      message: '메시지 파싱 또는 처리 오류',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }
});
```

### 5.2 연결 오류
```js
ws.on('error', (error) => {
  console.error('[WebSocket] 클라이언트 오류:', error);
});
```

---

## 6. 체크리스트

- [ ] 모든 라우터에서 `try/catch` 또는 `next(err)` 사용
- [ ] 응답 형식이 `response.js` 표준 준수
- [ ] 개발 환경 외 스택 트레이스 미노출
- [ ] WebSocket 오류 응답에 `type: 'response'` 포함
- [ ] 민감 정보 로그 출력 안 함

---

## 7. 참고 사항

- 이 문서는 `docs/tips/` 내 팁 문서로, 실무 규칙은 `docs/rule/security.md`(R-013) 참조
- 표준화된 응답 형식은 `communication.md`(R-012)와 연동