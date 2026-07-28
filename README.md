# WebCrawlServer

WebCrawlServer는 브라우저 플러그인, MCP(Modular Control Platform) 서버, 관리자 페이지(Admin UI), 확장 모듈을 하나의 표준 인터페이스로 연결하는 통합 자동화 플랫폼입니다.

브라우저 자동화, 웹 크롤링, 데이터 수집, 이미지 및 영상 처리, 외부 프로그램 실행, 데이터베이스 관리 등을 모듈 단위로 구성하여 하나의 서버에서 통합 관리할 수 있도록 설계되었습니다.

---

# 주요 기능

* **브라우저 플러그인 통합**: 웹 페이지 자동 탐색, 제어 및 백그라운드 데이터 수집
* **MCP 프로토콜 기반 통신**: 서버-플러그인 간 표준화된 WebSocket 및 REST API 기반 실시간 인터랙션
* **모듈 기반 확장 구조**: 독립적 기능 단위(actions, schema, config) 추가 방식
* **YAML 기반 워크플로우**: 코드 변경 없이 시나리오 기반 웹 탐색 및 데이터 파싱 실행
* **예약 실행 (Scheduler)**: Once, Interval, Cron 기반 자동 실행 및 SQLite 영구 저장
* **실시간 모니터링 대시보드**: 활성 소켓 세션, 패킷 트래픽 추이, 서버 프로세스 자원 모니터링
* **SQLite 기반 데이터 관리**: 시스템 테이블 및 모듈별 커스텀 데이터베이스 동적 관리
* **Admin UI (Vite + React)**: 모듈/워크플로우/크롤러/로그/연결 상태 시각화 제어판

---

# 프로젝트 구조

```text
WebCrawlServer/
│
├── AGENTS.md                   # 최상위 AI 개발/운영 규칙
├── README.md                   # 프로젝트 통합 안내 문서
├── package.json                # 루트 패키지 및 워크스페이스 설정
├── ecosystem.config.js         # PM2 프로세스 설정
│
├── server/                     # Express 백엔드 서버
│   ├── app.js                  # 서버 엔트리포인트 (Express + WebSocket)
│   ├── admin-ui/               # 관리자 페이지 React 웹 (Vite)
│   ├── routes/                 # Express API 라우터 (admin, api, crawler 등)
│   ├── monitor/                # 연결 관리 및 WebSocket 모니터링
│   ├── scheduler/              # 스케줄러 및 작업 실행 엔진
│   ├── workflows/              # YAML 워크플로우 실행 엔진
│   └── db/                     # SQLite 데이터베이스 헬퍼
│
├── modules/                    # 확장 기능 모듈 (crawler 등)
│   └── <module_name>/
│       ├── actions/            # 액션 스크립트
│       ├── workflow.yaml       # 모듈 워크플로우
│       ├── schema.sql          # DB 스키마
│       └── config.json         # 모듈 설정
│
├── plugin/                     # Chrome/Edge/Opera 브라우저 확장 플러그인
│   ├── manifest.json
│   ├── background.js
│   ├── contentScript.js
│   └── popup/
│
├── database/                   # SQLite main.db 저장소
├── logs/                       # 서버 및 모듈 로그
└── docs/                       # 지침 및 작업 이력 문서
    ├── rule/                   # 주제별 세부 실무 규칙 (R-000 ~ R-015)
    ├── ask.md / todo.md        # 작업 요청 및 실행 계획
    ├── todo.history.md         # 작업 실행 이력
    └── CHANGELOG.md            # 버전 관리 이력
```

---

# 시스템 구성

```text
┌────────────────────────┐
│     Browser Plugin     │
└───────────┬────────────┘
            │ (MCP Protocol - WebSocket / HTTP)
            ▼
┌────────────────────────┐
│     WebCrawlServer     │  <--->  ┌────────────────────────┐
│    (Express Port 3000) │         │ Admin UI (Vite/React)  │
└─────┬──────────┬───────┘         └────────────────────────┘
      │          │
      ▼          ▼
┌──────────┐ ┌──────────┐
│ Workflow │ │ Scheduler│
│ Engine   │ │ Engine   │
└─────┬────┘ └────┬─────┘
      │          │
      ▼          ▼
┌────────────────────────┐
│    SQLite Database     │
└────────────────────────┘
```

---

# 기술 스택

| 구분 | 기술 / 라이브러리 |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express, WebSocket (`ws`) |
| Frontend | React, Vite, Tailwind CSS (server/admin-ui) |
| Database | SQLite (`sqlite3`) |
| Process Manager | PM2 |
| Communication | WebSocket, REST API (MCP Protocol) |
| Workflow & Cron | YAML Parser, `node-cron` |
| Browser Extension | Chrome Manifest V3 |

---

# 시작하기 (Quick Start)

### 1. 저장소 복제 및 패키지 설치
```bash
git clone <repository-url>
cd WebCrawlServer

# 백엔드 및 Admin UI 패키지 전체 설치
npm install
```

### 2. Admin UI 빌드 (필수)
서버 구동 전 Vite 기반 관리자 UI 프로젝트를 빌드합니다.
```bash
npm run build
# 또는
npm run build:ui
```

---

# 브라우저 플러그인 설치 & Opera/크로미움 권한 설정 가이드

### 1. 개발자 모드 설치 방법 (Chrome / Opera / Edge)
1. 브라우저 주소창에 확장 프로그램 설정 페이지 접속 (`opera://extensions` 또는 `chrome://extensions`)
2. 우측 상단 **"개발자 모드 (Developer mode)"** 활성화
3. **"압축 해제된 확장 프로그램 로드 (Load unpacked)"** 클릭 후 저장소의 `plugin/` 폴더 선택

### 2. Opera / 크로미움 브라우저 모든 권한(All Permissions) 자동 부여 메커니즘 및 체크사항
* **자동 권한 부여 메커니즘 (`manifest.json`)**:
  * `host_permissions: ["<all_urls>"]` 설정이 적용되어 있어 개발자 모드로 로드 시 **모든 웹사이트에 대한 읽기/쓰기 권한이 자동으로 승인**됩니다.
  * `content_scripts`에 `matches: ["<all_urls>"]` 및 `all_frames: true`가 지정되어 모든 탭과 프레임에서 백그라운드 자동화 스크립트가 기본 실행됩니다.
* **추가 권한 토글 설정 (`opera://extensions` -> 세부정보 클릭)**:
  * **사이트 접근**: `모든 사이트에서 (On all sites)` 선택 확인
  * **시크릿 모드에서 허용 (Allow in incognito)**: 토글 ON (시크릿 창 웹 수집 시 필수)
  * **파일 URL에 대한 접근 허용 (Allow access to file URLs)**: 토글 ON (로컬 파일분석 시 필수)

---

# 서버 실행 및 프로세스 관리

## 1. 서버 정보 및 접속 주소
* **기본 포트**: `3000` (`PORT` 환경변수로 변경 가능)
* **네트워크 바인딩**: `0.0.0.0` (로컬 및 원격 네트워크 접속 지원)
* **웹 관리자 UI**: `http://localhost:3000`
* **WebSocket 엔드포인트**: `ws://localhost:3000`
* **헬스 체크**: `http://localhost:3000/health`

---

## 2. 서버 실행 방법 (npm 스크립트)

### ① 일반 표준 실행
Admin UI 빌드 후 Express 백엔드 서버를 직접 실행합니다.
```bash
npm start
```

### ② 개발 모드 실행
UI를 자동 빌드하고 백엔드 서버를 즉시 시동합니다.
```bash
npm run dev
```

### ③ 포트 직접 지정 실행
```bash
# 환경 변수로 포트 변경 (Linux/macOS)
PORT=8080 npm start

# Windows PowerShell
$env:PORT="8080"; npm start
```

---

## 3. PM2 프로세스 관리자 사용 (권장)

PM2를 이용하면 백그라운드 프로세스 무중단 구동, 코드 변경 시 자동 재시작, 단독 프로세스 제어 및 모니터링이 가능합니다.

### ① PM2 환경별 서버 시작
```bash
# 개발 환경 실행 (파일 변경 감시 & 자동 재시작)
npm run dev:pm2
# (내부 명령: npx pm2 start ecosystem.config.js --env_dev)

# 운영(Production) 환경 실행
npm run prod:pm2
# (내부 명령: npx pm2 start ecosystem.config.js --env production)
```

### ② npm 스크립트 기반 PM2 제어
```bash
npm run pm2:start     # PM2 서버 시작
npm run pm2:stop      # PM2 서버 일시 중지
npm run pm2:restart   # PM2 서버 재시작
npm run pm2:reload    # 0초 다운타임 재로드
npm run pm2:list      # 실행 중인 프로세스 목록
npm run pm2:logs      # 실시간 서버 로그 확인
npm run pm2:monitor   # 실시간 모니터링 대시보드
npm run pm2:delete    # PM2 목록에서 프로세스 삭제
```

### ③ PM2 단독/개별 명령어 (`npx pm2` 직접 사용)

```bash
# 1. 프로세스 상태 확인
npx pm2 list
npx pm2 show WebCrawlServer

# 2. 서버 단독 재시작 (코드 수정 적용 시)
npx pm2 restart WebCrawlServer

# 3. 서버 단독 일시 중지 및 다시 시작
npx pm2 stop WebCrawlServer
npx pm2 start WebCrawlServer

# 4. 서버 단독 완전 삭제 (프로세스 완전 종료)
npx pm2 delete WebCrawlServer

# 5. 모든 PM2 프로세스 중지 / 삭제
npx pm2 stop all
npx pm2 delete all

# 6. PM2 실시간 대시보드 및 로그 관찰
npx pm2 monit
npx pm2 logs WebCrawlServer --lines 100
npx pm2 logs WebCrawlServer --follow

# 7. PM2 데몬 프로세스 완전 종료
npx pm2 kill
```

### ④ 부팅 시 서버 자동 시작 등록 (OS 데몬 등록)
```bash
# 1. 현재 프로세스 상태 저장
npx pm2 save

# 2. OS 부팅 자동 시작 스크립트 등록
npx pm2 startup

# 3. 저장된 프로세스 상태 수동 복원
npx pm2 resurrect
```

---

## 4. OS별 백그라운드 구동 (PM2 미사용 시)

### Windows PowerShell 백그라운드 구동
```powershell
# 백그라운드로 실행
Start-Process -FilePath "node" -ArgumentList "server/app.js" -NoNewWindow

# 프로세스 확인 및 종료
Get-Process node
Stop-Process -Name "node" -Force
```

### Linux / macOS 백그라운드 구동 (`nohup`)
```bash
# 백그라운드 프로세스로 시동
nohup node server/app.js > logs/server.log 2>&1 &

# 로그 실시간 확인
tail -f logs/server.log

# 프로세스 종료
kill $(ps aux | grep 'node server/app.js' | grep -v grep | awk '{print $2}')
```

---

# 서버 상태 검증 및 테스트

### 1. HTTP 헬스 체크
```bash
curl http://localhost:3000/health
```

### 2. WebSocket 연결 테스트 (`wscat`)
```bash
# WebSocket 서버 연결
npx wscat -c ws://localhost:3000

# MCP 패킷 테스트 메시지 전송 예시
> {"messageId":"test1","type":"heartbeat","module":"test","action":"ping","timestamp":"2026-07-27T00:00:00Z","protocolVersion":"1.0"}
```

---

# 데이터베이스 및 파일 관리

### 1. SQLite CLI 접근
```bash
# 데이터베이스 직접 조회
sqlite3 database/main.db ".tables"

# 주요 테이블 조회 예시
sqlite3 database/main.db "SELECT * FROM modules;"
sqlite3 database/main.db "SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10;"
```

### 2. DB 백업 및 복원
```bash
# 백업 생성
sqlite3 database/main.db ".dump" > database/backup.sql

# 백업 복원
sqlite3 database/main.db < database/backup.sql
```

---

# 개발 철학 및 지침

본 프로젝트는 다음 원칙을 준수하여 작성됩니다.
* **모듈화**: 기능 단위 독립 모듈 설계 (`modules/<module_name>/`)
* **표준화**: MCP 규격에 기반한 메시지 스펙 준수
* **독립성 & 확장성**: 기존 코드를 수정하기보다 신규 모듈 추가를 권장
* **한글 주석 및 기술 문서화**: 코드 주석, 응답 및 문서는 한글 작성

---

# 개발 규칙 문서 가이드

프로젝트 개발 및 운영에 관한 세부 규정은 `docs/rule/` 디렉터리 내 규칙 문서를 참조합니다.

| 문서 | 역할 |
|---|---|
| `AGENTS.md` | 최상위 AI 개발 및 운영 규칙 |
| `docs/rule/instructions.md` (R-000) | 세부 실무 규칙 인덱스 (R-001 ~ R-015) |
| `docs/ask.md` | 작업 요청사항 문서 |
| `docs/todo.md` | 현재 작업 계획 및 진행 현황 |
| `docs/todo.history.md` | 작업 완료 상세 이력 |
| `docs/CHANGELOG.md` | 버전 관리 및 변경 이력 |

---

# 라이선스

본 프로젝트의 라이선스는 내부에 별도 정의되어 있으며 개인 및 통합 자동화 플랫폼 용도로 사용됩니다.
