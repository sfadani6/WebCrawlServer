# 단위 테스트 가이드 (R-015)

> 프로젝트: WebCrawlServer
> 버전: 0.1.0
> AGENTS.md 1.3절: 모든 규칙 문서는 docs/rule/ 하위에 생성
> 관련 문서: R-011 (coding.md), R-003 (structure.md)

---

## 1. 테스트 도구 및 환경

| 항목 | 값 |
|------|-----|
| 테스트 러너 | Jest (`jest` 패키지, v30) |
| 슈퍼테스트 | `supertest` (API 통합 테스트) |
| 설정 파일 | `jest.config.js`, `babel.config.js` |
| 실행 명령 | `npm test` (`node --experimental-vm-modules node_modules/jest/bin/jest.js`) |
| 테스트 위치 | 테스트 대상 파일과 동일한 디렉토리에 `*.test.js` 파일 생성 |

---

## 2. 테스트 파일 규칙

### 2.1 파일 위치 및 명명

```
server/
├── routes/
│   ├── api.js
│   └── api.test.js        ← 동일 디렉토리, .test.js 접미사
├── middleware/
│   ├── auth.js
│   └── auth.test.js
└── app.test.js             ← 루트 레벨 통합 테스트
```

- 테스트 파일은 **테스트 대상 파일과 같은 디렉토리**에 생성한다.
- 파일명은 `{대상파일명}.test.js` 형식을 따른다.
- 통합 테스트는 `server/` 루트의 `app.test.js`에 작성한다.

### 2.2 파일 구조

```javascript
/**
 * {모듈명} 단위 테스트
 * R-015 (testing.md) 2장: 테스트 파일 구조
 */

const { 대상함수 } = require('./{대상파일}');

describe('{모듈명} 단위 테스트', () => {
  // 정상 동작 테스트
  test('{함수명} - {설명}', () => {
    // given
    const input = ...;
    
    // when
    const result = 대상함수(input);
    
    // then
    expect(result).toEqual(...);
  });

  // 예외/경계 테스트
  test('{함수명} - {에러 상황}', () => {
    expect(() => {
      대상함수(잘못된_입력);
    }).toThrow(/* 에러 메시지 */);
  });

  // ...
});
```

---

## 3. 테스트 작성 원칙

### 3.1 AAA 패턴 (Arrange-Act-Assert)

모든 테스트는 다음 세 단계로 구성한다:

```javascript
test('extractFromHtml - 텍스트 추출', () => {
  // Arrange (준비)
  const html = '<div class="title">Hello</div>';
  
  // Act (실행)
  const result = extractFromHtml(html, '.title', 'text');
  
  // Assert (검증)
  expect(result).toEqual(['Hello']);
});
```

### 3.2 Given-When-Then 주석 (선택)

복잡한 테스트는 주석으로 구분한다:

```javascript
test('트랜잭션 실패 시 롤백', async () => {
  // Given: 유효하지 않은 SQL 쿼리
  const queries = [{ sql: 'INVALID SQL', params: [] }];
  
  // When: 트랜잭션 실행
  const promise = transaction(queries);
  
  // Then: 에러 발생
  await expect(promise).rejects.toThrow();
});
```

### 3.3 테스트 격리

- 각 테스트는 독립적으로 실행되어야 하며, 다른 테스트에 영향을 주지 않아야 한다.
- 테스트 간 상태 공유가 필요한 경우 `beforeEach()`에서 초기화한다.
- 외부 의존성(DB, 네트워크)이 필요한 테스트는 모킹(mocking)한다.

---

## 4. Jest 설정 가이드

### 4.1 `jest.config.js`

```javascript
module.exports = {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'require']
  },
  transformIgnorePatterns: [
    'node_modules/(?!(필요한_ESM_패키지))'
  ]
};
```

### 4.2 `babel.config.js` (ESM 변환 필요 시)

```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }]
  ]
};
```

### 4.3 `package.json` test 스크립트

```json
{
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:watch": "node --experimental-vm-modules node_modules/jest/bin/jest.js --watch"
  }
}
```

> **참고:** Windows 환경에서 `--experimental-vm-modules`는 일부 ESM 모듈(`jsdom`, `parse5`, `@csstools`)의 `export` 구문 파싱 문제를 해결하기 위해 필요하다. 완전한 ESM 호환성이 보장되지 않을 수 있으므로, 테스트 대상 모듈이 ESM 패키지에 의존하는 경우 별도로 확인이 필요하다.

---

## 5. 단위 테스트 대상 우선순위

### 5.1 우선순위 1 - 순수 함수 (Pure Functions)
- `server/db/helper.js`의 헬퍼 함수
- `server/middleware/response.js`의 응답 래퍼 함수
- `server/scripts/scriptEngine.js`의 `extractFromHtml`, `getExecutionContext`

### 5.2 우선순위 2 - 비즈니스 로직
- `server/scheduler/jobRunner.js`의 스케줄러 로직
- `server/routes/nlp.js`의 SQL 변환 로직
- `server/monitor/monitorWs.js`의 데이터 수집 로직

### 5.3 우선순위 3 - 통합 테스트
- `server/app.test.js`의 API 엔드포인트 테스트 (supertest 사용)
- `server/routes/api.test.js`의 라우터 단위 테스트

---

## 6. 모킹(Mocking) 가이드

### 6.1 DB 모킹

```javascript
// server/db/helper.js 모킹
jest.mock('../db/helper', () => ({
  queryDatabase: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
  transaction: jest.fn()
}));
```

### 6.2 WebSocket 모킹

```javascript
// WebSocket 서버 모킹
const mockWss = {
  clients: {
    size: 0,
    forEach: jest.fn()
  }
};
```

---

## 7. 주의사항

1. **Jest ESM 호환성**: `jsdom`, `json2csv` 등 ESM 전용 패키지를 `require()`로 가져오는 모듈은 Jest의 기본 설정에서 파싱 오류가 발생할 수 있다. 테스트 실패 시 `transformIgnorePatterns`에 해당 패키지를 추가하거나, 모듈을 동적 `import()`로 변경하는 것을 고려한다.
2. **DB 의존성**: SQLite DB에 의존하는 테스트는 실제 DB 파일을 사용하거나 `:memory:` 모드를 사용한다. 테스트 간 데이터 오염을 방지하기 위해 `beforeEach`에서 데이터를 초기화한다.
3. **비동기 테스트**: `async/await`를 사용하는 테스트는 반드시 `async` 함수로 선언하고, `await`로 Promise가 완료될 때까지 기다린다.