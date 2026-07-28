# DB 연결 풀(Connection Pool) 도입 가이드

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-27
> 검토일: 2026-07-27
> 수정 이유: SQLite 기반 프로젝트에 맞는 연결 풀 전략 가이드 작성
> 관련 문서: docs/rule/database.md(R-007), docs/rule/tech-stack.md(R-002)

---

## 1. 배경 및 필요성

### 1.1 현재 상황
- `server/db/helper.js`에서 SQLite 싱글톤 패턴 사용 중
- `getDbConnection()`으로 단일 연결 유지, `openReadonly`/`openReadwrite`로 별도 연결 생성 가능
- `better-sqlite3` 또는 `sqlite3` 패키지 사용

### 1.2 연결 풀 도입 고려 사항
- SQLite는 파일 기반 DB로, 여러 연결 간 쓰기 시 serialize 발생
- 동시 읽기는 WAL 모드에서 가능하나, 쓰기 동시성은 제한적
- 진정한 풀(pool)보다는 **연결 재사용 패턴**이 효율적

---

## 2. SQLite 연결 풀 전략

### 2.1 파일 기반 DB의 특성

| 특성 | 영향 |
|---|---|
| 파일 잠금 | 동시 쓰기 시 블로킹 발생 |
| WAL 모드 | 읽기 동시성 향상, 쓰기는 직렬화 |
| 트랜잭션 | LONG TRANSACTION 시 다른 연결 대기 |

### 2.2 권장 접근 방식

#### A. 싱글톤 + 트랜잭션 직렬화 (현재 방식 유지)
```js
// server/db/helper.js 현재 구조 권장
function getDbConnection() {
  if (!cachedDb) {
    cachedDb = new sqlite3.Database(DB_PATH);
    cachedDb.run('PRAGMA journal_mode = WAL');
  }
  return cachedDb;
}
```

**장점**: 연결 오버헤드 최소, SQLite 친화적
**단점**: 장기 트랜잭션 시 전체 차단

#### B. better-sqlite3 + 직렬 실행 큐
```js
// better-sqlite3는 동기식 API로 직렬화에 유리
const Database = require('better-sqlite3');
const db = new Database(DB_PATH, { 
  readonly: false, 
  fileMustExist: true,
  timeout: 5000  // 대기 시간 설정
});
```

#### C. 연결 풀 구현 (multi-connection)
연결 풀 스타일 구현이 필요한 경우:

```js
// 연결 풀 스타일 예시 (최대 5개 연결 유지)
class DbPool {
  constructor(dbPath, maxSize = 5) {
    this.dbPath = dbPath;
    this.maxSize = maxSize;
    this.pool = [];
    this.inUse = new Set();
  }

  getConnection() {
    // 사용 중이지 않은 연결 반환
    for (const db of this.pool) {
      if (!this.inUse.has(db)) {
        this.inUse.add(db);
        return db;
      }
    }
    
    // 새 연결 생성 (풀 한도 내)
    if (this.pool.size < this.maxSize) {
      const db = new sqlite3.Database(this.dbPath);
      this.inUse.add(db);
      this.pool.push(db);
      return db;
    }
    
    // 풀 한도 초과 시 대기 또는 에러
    throw new Error('DB 풀 한도 초과');
  }

  releaseConnection(db) {
    this.inUse.delete(db);
  }
}
```

---

## 3. 적용 시 체크리스트

### 3.1 필수 확인 사항
- [ ] WAL 모드 활성화 여부 확인 (`PRAGMA journal_mode=WAL`)
- [ ] 외래 키 제약 활성화 (`PRAGMA foreign_keys=ON`)
- [ ] 트랜잭션 실행 시간 측정 (100ms 이내 권장)
- [ ] 연결이 10개 이상 동시에 열려 있는지 확인

### 3.2 성능 최적화 옵션
```js
// SQLite 최적화 PRAGMA
cachedDb.run('PRAGMA cache_size = 10000');           // 캐시 크기 증가
cachedDb.run('PRAGMA temp_store = MEMORY');            // 임시 저장소 메모리
cachedDb.run('PRAGMA mmap_size = 268435456');       // 메모리 매핑 (256MB)
cachedDb.run('PRAGMA busy_timeout = 5000');          // 잠금 대기 시간
```

### 3.3 모니터링 포인트
- `activity_logs` 테이블에 DB 연결 수/해제 수 기록
- 긴 트랜잭션(1초 이상) 감지 시 로그 경고
- `sqlite_master`에서 활성 연결 확인 (개발용)

---

## 4. 마이그레이션 가이드

### 4.1 현재 코드에 적용
`server/db/helper.js` 수정 시:

1. `closeDbConnection()` 호출 위치 확인
2. `transaction()` 함수 내 serialize 사용 유지
3. 에러 시 자동 롤백 보장

### 4.2 주의 사항
- SQLite 풀은 **볼륨 기반이므로** 진정한 풀 효과가 제한됨
- 여러 DB 파일(`database/{module}.db`) 사용 시 각각 풀 관리 필요
- 서버 재시작 시 모든 연결이 해제되므로, 풀 재초기화 로직 필요

---

## 5. 판단 기준

| 상황 | 권장 방식 |
|---|---|
| 일반적인 개인용 도구 | 싱글톤 유지 (현재 구조) |
| 동시 실행 워커 10개 이상 | better-sqlite3 + 큐 |
| 다중 DB 파일 동시 접근 | 각 DB별 개별 풀 |
| 읽기 위주 (90% 이상) | 현재 구조 + WAL 유지 |

---

## 6. 참고 사항

- 이 문서는 `docs/tips/` 내 팁/트러블슈팅 문서로, 실무 규칙은 `docs/rule/database.md`(R-007)에 따름
- SQLite 풀 관련 npm 패키지(`sqlite3-pool` 등)는 검증되지 않았으므로 직접 구현 권장
- 추후 `better-sqlite3` 도입 시 이 문서를 업데이트할 예정