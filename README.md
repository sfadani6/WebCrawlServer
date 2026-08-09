# WebCrawlServer

> **주의(보류)**: 문서 및 코드베이스 곳곳에 깃허브(GitHub) 자동 커밋/푸시 관련 내용이 기술되어 있으나, 해당 자동화 기능은 현재 우선순위에서 제외(백로그)되어 있습니다. 즉시 구현·배포 권고에서는 제외해 주십시오.

WebCrawlServer는 브라우저 확장 플러그인, React 기반 관리자 대시보드, Express/SQLite 백엔드를 하나의 모노레포로 통합한 분산 크롤링 수집 플랫폼입니다.

플러그인은 웹 페이지 DOM 데이터를 수집하여 서버로 실시간 전송하고, 관리자는 수집 기기를 제어하며 수집 로그를 확인할 수 있습니다.

---

## 핵심 기능

- 브라우저 확장 플러그인(MV3)으로 현재 탭 DOM 데이터를 수집
- WebSocket 기반 실시간 통신으로 플러그인/관리자/서버 간 메시지 중계
- SQLite 기반 영구 저장소에 크롤링 로그와 클라이언트 연결 정보 기록
- 관리자 UI에서 클라이언트 목록 조회, 강제 추방, 로그 일괄 삭제 지원
- `PM2` 기반 백그라운드 서버 운영을 위한 명령어 제공

---

## 프로젝트 구성

### 루트

- `package.json`: 워크스페이스 설정 및 전체 실행 스크립트
- `tsconfig.base.json`, `tsconfig.json`: TypeScript 공통 설정
- `AGENTS.md`: AI 에이전트 통합 지침 최상위 문서
- `README.md`: 프로젝트 개요 및 운영 안내
- `.agents/`: 사용자 정의 스킬 및 에이전트 확장 파일
- `docs/`: 규칙, 요청, 결정, 이력 문서
- `databases/`: SQLite 데이터베이스 저장 위치
- `logs/`: 운영 로그 저장소

### 하위 워크스페이스

- `server/`: Express + WebSocket 백엔드 서버
- `admin/`: React + Vite 관리자 대시보드
- `plugins/basic-plugin/`: 브라우저 확장 플러그인 개발 샘플

---

## 시스템 아키텍처

1. 브라우저 확장 플러그인(`plugins/basic-plugin/`) 백그라운드 워커가 `ws://localhost:9600?clientId=<uuid>&clientType=plugin`로 서버에 연결합니다.
2. content script는 현재 페이지 제목과 링크 목록을 수집하고 `RAW_DOM_DATA` 메시지로 백그라운드에 전달합니다.
3. 백그라운드 워커는 `CRAWL_LOG` WebSocket 패킷을 서버로 전송합니다.
4. 서버(`server/src/index.ts`)는 `crawl_logs` 테이블에 저장하고, 플러그인 통신 로그를 `logs/plugins_comm.log`에 기록합니다.
5. 관리자 대시보드(`admin/src/App.tsx`)는 `ws://localhost:9600?clientId=admin-main&clientType=admin`로 연결하고 REST API로 클라이언트 및 로그 데이터를 조회합니다.
6. 관리자는 `CRAWL_START`, `CRAWL_STOP` 명령을 타깃 클라이언트에 전송하여 원격 제어를 수행합니다.

---

## 주요 기술 스택

- Node.js + TypeScript + ESM
- Express 5, ws, better-sqlite3
- React 19, Vite 5, Tailwind CSS 3
- Chrome/Opera 확장 프로그램 MV3
- SQLite, PM2

---

## 문서 참조

- `AGENTS.md`: AI 에이전트 통합 지침 최상위 문서 (프로젝트 루트)
- `README.md`: 프로젝트 개요 및 운영 안내 (프로젝트 루트)
- `replit.md`: Replit 환경 문서 (프로젝트 루트)
- `docs/rule/R-00000 instructions.md`: 규칙 문서 인덱스
- `docs/rule/R-00100 architecture.md` ~ `docs/rule/R-00108 testing.md`: 개별 규칙 문서
- `docs/decision/v0.02.개발 환경 셋팅 가이드.md`: 로컬 PowerShell/Node.js 개발 환경 기준
- `docs/ask.md`, `docs/todo.md`: 작업 요청 및 계획

> 주의: `AGENTS.md`, `README.md`, `replit.md`는 반드시 프로젝트 루트에 위치해야 하며 `docs/rule/` 등에 복제본을 만들면 안 됩니다.
## 정리 및 유지보수

- `.gitignore`는 빌드 산출물, 생성된 JS 소스 아티팩트, 데이터베이스 파일, 로그를 추적에서 제외하도록 관리합니다.
- 개발 중 생성된 `admin/src/*.js`, `admin/src/*.js.map`, `plugins/basic-plugin/src/*.js`, `plugins/basic-plugin/src/*.js.map` 파일은 소스 디렉토리에 남기지 않고 제거해야 합니다.
- `package-lock.json`은 워크스페이스 의존성 잠금을 위해 유지하되, 의존성 변경 시 `npm install` 후 lock 파일 상태를 정리합니다.
---

## 실행 및 개발

### 전체 환경 설치

```powershell
npm install
```

### 관리자 개발 서버

```powershell
npm run admin:dev
```

### 플러그인 개발 빌드 감시

```powershell
npm run plugin:basic:dev
```

### 백엔드 서버 운영

```powershell
npm run server:start
npm run server:status
npm run server:logs
npm run server:stop
```

### 관리자 대시보드 운영

```powershell
npm run admin:start
npm run admin:status
npm run admin:logs
npm run admin:stop
```

### 정리 및 초기화

```powershell
npm run clean-reset
```

---

## 데이터 및 로그

- 데이터베이스: `databases/data.db`
- 서버 시스템 로그: `logs/server_system.log`
- 관리자 활동 로그: `logs/admin_activity.log`
- 플러그인 통신 로그: `logs/plugins_comm.log`

---

## 개발 가이드

- 모든 코드와 문서는 ESM 기준으로 작성합니다.
- Windows 11 / PowerShell 7 환경을 기준으로 명령어를 안내합니다.
- 프로젝트 문서 우선순위는 `AGENTS.md` > `docs/rule/*.md` > `docs/ask.md` > `docs/todo.md` > `README.md`입니다.
- AI 기반 협업 시 `docs/decision/v0.02.개발 환경 셋팅 가이드.md`와 `AGENTS.md`를 함께 참조합니다.

---

## 폴더 요약

- `server/src/`: 백엔드 엔트리포인트, WebSocket 및 REST API, DB 초기화, 로그 기능
- `admin/src/`: 관리자 UI 구성, WebSocket 연결, REST API 호출, 로그/클라이언트 관리
- `plugins/basic-plugin/src/`: 브라우저 플러그인 백그라운드, content script, popup UI
- `plugins/basic-plugin/public/`: MV3 확장 매니페스트 및 정적 자산
- `docs/`: 개발 규칙, 이력, 요청 문서



