# R-014 페이지 인증 가이드라인 (auth.md)

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-26
> 검토일: 2026-07-26
> 수정 이유: 관리자 계정 bcryptjs 해시 저장 방식 도입, 설정 페이지 계정 변경 UI 구현에 따른 신규 문서 작성
> 관련 문서: docs/rule/database.md(R-007), docs/rule/security.md(R-013), docs/rule/structure.md(R-003)
> 영향 범위: 신규 문서. 기존 security.md(R-013)의 인증 항목을 대체·확장
> Breaking Change 여부: 없음 (기존 security.md는 유지, 인증 세부 규정만 이 문서로 이동)

---

## 1. 인증 구조 개요

본 프로젝트의 관리자 콘솔(`/admin`, `/database`, `/settings` 등)은 **HTTP Basic Authentication** 기반으로 보호된다.

```
[브라우저]
  └─ Authorization: Basic base64(username:password)
      └─ [server/middleware/auth.js] basicAuthMiddleware
              └─ bcryptjs.compare(입력비번, 해시캐시)
                    └─ [main.db] admin_credentials 테이블 (id=1 단일 행)
```

- 자격증명은 `main.db`의 `admin_credentials` 테이블에 **bcryptjs 해시**로 저장된다.
- 서버 시작 시 DB에서 해시를 읽어 **인메모리 캐시**(`credentialsCache`)에 보관한다.
- 요청마다 DB를 읽지 않고 캐시를 사용하여 I/O를 최소화한다.

---

## 2. 초기 관리자 계정

서버 최초 기동 시 `admin_credentials` 테이블에 행이 없으면 아래 값으로 자동 초기화된다.

| 항목 | 값 |
|---|---|
| 아이디 | `adminkim` |
| 비밀번호 | `akssj#kasjf` |
| 저장 방식 | bcryptjs 해시 (cost factor 12) |

- 초기값은 `server/app.js`의 `initializeDatabase()` 내부에서 처리한다.
- 환경변수 `ADMIN_USERNAME`, `ADMIN_PASSWORD`가 설정된 경우 해당 값을 우선 사용한다.
- **운영 환경에서는 반드시 설정 페이지에서 변경한다.**

---

## 3. 자격증명 저장 원칙

### 3.1 비밀번호 해시

```js
// 저장 시 (cost factor 12)
const hash = await bcrypt.hash(plainPassword, 12);

// 검증 시 (비동기)
const valid = await bcrypt.compare(plainPassword, storedHash);
```

- 평문 비밀번호는 절대 DB에 저장하지 않는다.
- cost factor는 최소 10 이상, 기본값 12를 유지한다.
- 해시 알고리즘: `bcryptjs` (순수 JS 구현, 네이티브 컴파일 불필요)

### 3.2 인메모리 캐시 구조

`server/middleware/auth.js`의 `credentialsCache` 객체:

```js
const credentialsCache = {
  username: null,       // 현재 관리자 아이디
  passwordHash: null,   // bcrypt 해시
  loaded: false         // 캐시 로딩 완료 여부
};
```

- `setCredentialsCache(username, passwordHash)`: 캐시 설정 함수 (app.js, adminDb.js에서 사용)
- `getCredentialsCache()`: 캐시 읽기 함수

### 3.3 캐시 갱신 시점

| 시점 | 처리 |
|---|---|
| 서버 최초 기동 | `admin_credentials` 테이블 → 읽어서 캐시 설정 |
| 비밀번호 변경 API 성공 | DB 업데이트 후 캐시 즉시 갱신 |
| 서버 재시작 | 항상 DB에서 재로드 |

---

## 4. 인증 미들웨어 (`basicAuthMiddleware`)

`server/middleware/auth.js`의 `basicAuthMiddleware`가 `/admin/api/**` 경로 전체에 적용된다.

```js
// server/app.js
app.use('/admin/api', adminApiLimiter, basicAuth(), adminDbRouter);
```

### 4.1 인증 실패 응답

| 상황 | HTTP 상태 | 응답 |
|---|---|---|
| Authorization 헤더 없음 | 401 | `WWW-Authenticate: Basic realm="Admin Area"` |
| 아이디 불일치 | 401 | `{ message: '인증 실패' }` |
| 비밀번호 불일치 | 401 | `{ message: '인증 실패' }` |
| 캐시 미로딩 (서버 초기화 중) | 503 | `{ message: '서버 초기화 중' }` |

### 4.2 인증 성공 시

```js
req.user = {
  username: credentials.name,
  authenticated: true,
  roles: ['admin']
};
```

---

## 5. 프론트엔드 자격증명 관리

### 5.1 localStorage 기반 저장

브라우저 `localStorage`에 현재 자격증명을 저장하여 API 호출 시 Authorization 헤더를 자동 생성한다.

```js
// src/api.js
const LS_KEY = 'wcs_admin_credentials';
const DEFAULT_CREDS = { username: 'adminkim', password: 'akssj#kasjf' };

export function getStoredCredentials() {
  // localStorage → 없으면 DEFAULT_CREDS 반환
}

export function saveCredentials(username, password) {
  localStorage.setItem(LS_KEY, JSON.stringify({ username, password }));
}

function makeAuthHeader() {
  const { username, password } = getStoredCredentials();
  return 'Basic ' + btoa(`${username}:${password}`);
}
```

### 5.2 자격증명 갱신 흐름

```
설정 페이지 [비밀번호 변경 폼]
  └─ PUT /admin/api/auth/credentials
        ├─ 성공: saveCredentials(newUsername, newPassword) → localStorage 갱신
        └─ 실패: 오류 메시지 표시
```

- 변경 성공 시 브라우저 새로고침 없이 이후 API 요청부터 즉시 새 자격증명 적용.
- 변경 후 다른 탭이나 기기에서 접속 시에는 해당 환경의 localStorage를 수동 갱신하거나 재로그인 필요.

---

## 6. 자격증명 변경 API

### `GET /admin/api/auth/info`

현재 관리자 아이디 및 마지막 변경 일시를 반환한다 (비밀번호는 반환하지 않음).

**응답:**
```json
{
  "username": "adminkim",
  "updated_at": "2026-07-26 01:28:44"
}
```

### `PUT /admin/api/auth/credentials`

관리자 아이디 및 비밀번호를 변경한다.

**요청 Body:**
```json
{
  "currentPassword": "현재 비밀번호 (필수)",
  "newUsername": "새 아이디",
  "newPassword": "새 비밀번호 (6자 이상)"
}
```

**처리 흐름:**
1. `currentPassword`를 캐시된 해시와 bcryptjs로 비교
2. 불일치 시 `403 Forbidden` 반환
3. `newPassword`를 bcryptjs로 해시화 (cost=12)
4. `admin_credentials` 테이블 UPDATE
5. 인메모리 캐시 즉시 갱신 (`setCredentialsCache`)
6. 성공 응답 반환

**유효성 검증:**
- `currentPassword`: 필수
- `newUsername`: 필수, 공백 불가
- `newPassword`: 필수, 6자 이상

---

## 7. 레이트 리밋

`/admin/api` 전체에 `adminApiLimiter`가 적용된다.

```js
const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 1000,                  // 15분당 최대 1000회
});
```

- 그리드 인라인 편집처럼 다수 API 요청이 발생하는 작업을 고려하여 1000회로 설정.
- 브루트포스 공격 방지가 필요한 경우 `/admin/api/auth/**` 경로만 별도 엄격한 리밋을 적용할 수 있다.

---

## 8. 보안 주의사항

- `admin_credentials`의 해시는 평문이 아니지만, DB 파일 자체가 탈취되면 오프라인 크래킹이 가능하다. `database/` 디렉토리는 외부에 노출되지 않도록 한다.
- `database/` 디렉토리는 `.gitignore`에 포함하거나, 최소한 `*.db` 파일이 저장소에 올라가지 않도록 한다.
- 초기 비밀번호(`akssj#kasjf`)는 서버 최초 기동 후 반드시 설정 페이지(`/settings`)에서 변경한다.
- 현재 인증 방식(HTTP Basic Auth)은 HTTPS 없이 사용 시 네트워크 구간에서 base64 디코딩으로 평문 노출이 가능하다. 로컬(`localhost`) 전용 운영에서는 허용하되, 외부 노출 시 HTTPS를 반드시 적용한다.

---

## 9. 향후 확장 고려사항 (현재 미구현)

- **JWT 기반 인증**: `auth.js`에 `jwtAuthMiddleware` 스텁이 있으나 현재는 basicAuth로 위임됨. 다중 세션 지원 시 구현.
- **세션 만료**: Basic Auth는 세션 개념이 없음. 만료가 필요하면 JWT 전환 시 구현.
- **IP 화이트리스트**: 외부 서비스로 전환 시 `verifyClient` 확장.
- **2FA(2단계 인증)**: 운영 환경 전환 시 검토.
