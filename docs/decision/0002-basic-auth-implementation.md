# ADR-0002: Basic Auth 기반 관리자 인증 도입

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-26
> 검토일: 2026-07-26
> 수정 이유: 관리자 콘솔 보호를 위한 Basic Auth 인증 도입 결정 기록
> 관련 문서: docs/rule/auth.md(R-014), docs/rule/architecture.md(R-001), docs/rule/database.md(R-007)
> 영향 범위: server/middleware/auth.js, server/app.js, server/routes/adminDb.js, docs/rule/auth.md 신규 생성
> Breaking Change 여부: 없음 (신규 기능 추가)

---

## 상태
**채택** — 2026-07-26

---

## 배경

WebCrawlServer 관리자 콘솔(`/admin`, `/database`, `/settings` 등)은 로컬에서만 운영되지만, 브라우저를 통한 접근 시 인증 없이 열람 가능한 상태였다. 

초기 architecture.md 1.4절에는 "인증은 다루지 않는다"고 명시되어 있었으나, 관리자 페이지에서 DB 스키마 변경, 테이블 삭제, 설정 수정 등 민감한 작업이 가능하므로 최소한의 인증이 필요하다고 판단했다.

---

## 검토한 대안

### 1. Session 기반 인증 (JWT)
- **장점**: 세션 만료, 토큰 갱신 등 표준적인 인증 패턴
- **단점**: 세션 저장소(Redis 등) 추가로 운영 복잡도 증가, 1인 도구에는 과도한 설계

### 2. OAuth 2.0 / 소셜 로그인
- **장점**: 외부 서비스 연동, 높은 보안
- **단점**: 외부 의존성, 설정 복잡도, 로컬 도구에는 과도한 설계

### 3. HTTP Basic Authentication
- **장점**: 구현 단순, 서버 지원 기본 제공, 별도 저장소 불필요
- **단점**: HTTPS 없으면 평문 노출 위험, 세션 개념 없음
- **선택 근거**: 1인 로컬 도구, 구현 단순성 우선, localhost 전용 운영에서는 HTTPS 없이도 허용 가능

---

## 선택한 대안

**HTTP Basic Authentication + bcryptjs 해시 저장**

### 구현 내용

1. **인메모리 캐시**: `server/middleware/auth.js`의 `credentialsCache` 객체에 bcrypt 해시를 캐시
2. **DB 저장**: `main.db`의 `admin_credentials` 테이블에 bcryptjs 해시(cost factor 12) 저장
3. **프론트엔드**: localStorage에 자격증명 저장, API 호출 시 Authorization 헤더 자동 생성
4. **변경 API**: `PUT /admin/api/auth/credentials`로 아이디/비밀번호 변경 가능

### 초기값
- 아이디: `adminkim`
- 비밀번호: `akssj#kasjf`
- 환경변수 `ADMIN_USERNAME`, `ADMIN_PASSWORD`로 변경 가능

---

## 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `server/middleware/auth.js` | Basic Auth 미들웨어, credentialsCache 구현 |
| `server/app.js` | admin_credentials 테이블 생성, bcrypt 해시 시딩 |
| `server/routes/adminDb.js` | auth/info, auth/credentials API 추가 |
| `docs/rule/auth.md` | 신규 문서 생성 (R-014) |
| `docs/rule/architecture.md` | 1.4절 문구 수정 (인증 적용 명시) |

---

## 보안 고려사항

1. **HTTPS 미적용 시 평문 노출**: 로컬(`localhost`) 전용 운영에서는 허용, 외부 노출 시 HTTPS 필수
2. **DB 파일 탈취 시 오프라인 크래킹 가능**: `database/` 디렉토리 외부 노출 금지
3. **초기 비밀번호 변경 필수**: 서버 최초 기동 후 설정 페이지에서 변경 필요

---

## 향후 확장 고려사항

- JWT 기반 인증 전환 시 `auth.js`의 `jwtAuthMiddleware` 스텁 활용
- 다중 세션 지원 시 세션 만료机制 구현
- 외부 서비스 전환 시 IP 화이트리스트 적용