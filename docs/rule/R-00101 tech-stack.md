# R-00101 docs/rule/R-00101 tech-stack.md

`WebCrawlServer`는 경량 로컬 개발 환경과 모노레포 통합을 기반으로 설계되었습니다. 개발자는 본 프로젝트에서 사용하는 핵심 기술과 버전 호환성을 준수해야 합니다.

## 플랫폼 및 개발 환경

- 운영체제: Windows 11 Home
- 쉘: PowerShell 7.6.1
- Node.js: v25.9.0
- TypeScript: v5.7.2
- ESLint: v10.x
- 패키지 관리자: npm
- 백그라운드 프로세스 관리: PM2

## 백엔드

- Node.js + Express 5
- WebSocket: `ws`
- SQLite: `better-sqlite3`
- TypeScript ESM 모드 (`type":"module")
- REST API, 정적 파일 서빙, WebSocket 메시지 중계

## 관리자 UI

- React 19
- Vite 5
- Tailwind CSS 3
- React DOM
- 브라우저 개발 환경: Vite dev server

## 브라우저 플러그인

- Chrome/Opera 확장 프로그램 MV3
- `manifest.json` 기반 권한 설정
- `chrome.storage.local`을 통한 UUID 저장
- 백그라운드 서비스 워커, content script, popup UI 구성

## 린트 및 빌드

- `eslint.config.mts` 기반 Flat Config
- `typescript-eslint` 플러그인
- `npm run lint`: 코드 정적 분석
- `npm run admin:dev`, `npm run plugin:basic:dev`, `npm run server:start` 등의 전용 스크립트

## 개발 원칙

- ESM 표준을 우선합니다.
- 글로벌 설치 대신 로컬 node_modules 설치를 지향합니다.
- Docker, 가상 머신, 컨테이너 환경 대신 로컬 PowerShell 기반 작업을 우선합니다.
- `docs/decision/v0.02.개발 환경 셋팅 가이드.md`의 로컬 격리 환경, 경량 컴퓨터 보호, PM2 백그라운드 운영 원칙을 참고합니다.



