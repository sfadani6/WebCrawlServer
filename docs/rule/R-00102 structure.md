# R-00102 docs/rule/R-00102 structure.md

`WebCrawlServer` 프로젝트는 명확한 폴더 경계와 문서 위치 규칙을 준수합니다. 모든 코드 및 문서는 프로젝트 루트가 아닌 지정된 위치에 보관합니다.

## 폴더 구조

- `server/`: 백엔드 서버 소스 코드
  - `src/`: 엔트리포인트, 데이터베이스, 로깅 등 서버 구현
  - `package.json`: 서버 전용 의존성
  - `tsconfig.json`: 서버 TypeScript 설정
- `admin/`: 관리자 대시보드 소스 코드
  - `src/`: React 컴포넌트 및 클라이언트 코드
  - `package.json`: 관리자 UI 전용 의존성
  - `tsconfig.json`: 관리자 TypeScript 설정
  - `vite.config.ts`: Vite 번들러 설정
- `plugins/basic-plugin/`: 브라우저 확장 플러그인
  - `src/`: TypeScript 소스 (background, content, popup)
  - `public/`: MV3 manifest 및 정적 파일
  - `package.json`: 플러그인 전용 의존성
  - `tsconfig.json`: 플러그인 TypeScript 설정
- `databases/`: SQLite 데이터베이스 파일 저장소
- `logs/`: 운영 로그 저장소
- `docs/`: 프로젝트 문서
  - `rule/`: 규칙 문서
  - `decision/`: 설계 결정 및 ADR
  - `askLogs/`: 요청 및 처리 이력
  - `CHANGELOG.md`: 변경 이력
  - `todo.md`, `todo.history.md`: 작업 계획 및 기록

## 파일 네이밍 규칙

- TypeScript 파일: `.ts`, `.tsx`
- 구성 파일: `.json`, `.md`, `.mts`
- 브라우저 확장 매니페스트: `manifest.json`
- 문서 파일: `docs/` 하위에 배치
- 부가 문서: `README.md`, `AGENTS.md`는 루트에 허용

## 모듈 구조 기준

- 서버는 `server/src/index.ts`, `server/src/database.ts`, `server/src/logger.ts`로 주요 책임을 분리합니다.
- 관리자 UI는 `admin/src/App.tsx`, `admin/src/main.tsx` 중심으로 구성됩니다.
- 플러그인은 `plugins/basic-plugin/src/background.ts`, `plugins/basic-plugin/src/content.ts`, `plugins/basic-plugin/src/popup.tsx`로 기능을 분리합니다.

## 문서 위치 규칙

- 규칙 문서는 `docs/rule/` 하위에 둡니다.
- ADR 및 설계 결정은 `docs/decision/`에 둡니다.
- `docs/decision/`은 컨텍스트 로딩 예외로 취급하므로 새 작업 시작 시 전체 스캔하지 않습니다.
- 사용자 요청과 계획은 각각 `docs/ask.md`, `docs/todo.md`에서 관리합니다.

## 프로젝트 파일 추가 원칙

- 새 기능 관련 문서는 `docs/rule/` 또는 `docs/decision/`에 추가합니다.
- 코드 단위 변경은 기존 모듈 구조를 확장하는 방식으로 진행합니다.
- 새로운 상위 문서를 추가할 때는 `AGENTS.md`와 `docs/rule/R-00000 instructions.md`를 동시에 갱신합니다.



