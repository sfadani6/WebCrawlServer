# WebCrawlServer

## 프로젝트 개요

Node.js + Express 기반의 웹 크롤링/자동화 통합 플랫폼입니다.

- **브라우저 플러그인** ↔ **MCP 프로토콜** ↔ **서버** 구조
- 모듈 단위 확장 구조 (YAML 워크플로우)
- 예약 실행(Scheduler), 실행 상태 모니터링
- SQLite 기반 데이터 관리
- 관리자 페이지 (`/public`)

## 스택

| 항목 | 내용 |
|------|------|
| 런타임 | Node.js ≥ 18 |
| 프레임워크 | Express 4 |
| DB | SQLite3 |
| 실시간 통신 | WebSocket (`ws`) |
| 워크플로우 | js-yaml, node-cron |

## 실행 방법

```bash
npm install
npm start        # node server/app.js (포트 9600)
npm run dev      # nodemon (핫 리로드)
```

기본 포트: **9600**

## 주요 경로

| 경로 | 역할 |
|------|------|
| `server/app.js` | 서버 진입점 |
| `modules/` | 확장 모듈 (각 모듈은 actions/, workflow.yaml 등 포함) |
| `plugin/` | 브라우저 플러그인 소스 |
| `public/` | 관리자 페이지 정적 파일 |
| `database/` | SQLite DB 파일 |
| `docs/` | 개발 문서 (ask.md, todo.md, CHANGELOG.md 등) |
| `config/` | 설정 파일 |
| `workflows/` | 워크플로우 정의 |

## 개발 문서

- `AGENTS.md` — AI 운영 규칙
- `docs/rule/instructions.md` — 세부 개발 규칙
- `docs/ask.md` — 작업 요청
- `docs/todo.md` — 현재 작업 계획
- `docs/CHANGELOG.md` — 버전 관리

## User Preferences

- 주석 및 문서는 한글로 작성 (AGENTS.md 규칙)
