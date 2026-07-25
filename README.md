# WebCrawlServer

WebCrawlServer는 브라우저 플러그인, MCP(Modular Control Platform) 서버, 관리자 페이지, 확장 모듈을 하나의 표준 인터페이스로 연결하는 통합 자동화 플랫폼입니다.

브라우저 자동화, 웹 크롤링, 데이터 수집, 이미지 및 영상 처리, 외부 프로그램 실행, 데이터베이스 관리 등을 모듈 단위로 구성하여 하나의 서버에서 관리할 수 있도록 설계되었습니다.

---

# 주요 기능

* 브라우저 플러그인을 이용한 웹 자동화
* MCP 프로토콜 기반 서버-플러그인 통신
* 모듈 기반 확장 구조
* YAML 기반 워크플로우 실행
* 예약 실행(Scheduler)
* 실행 상태 모니터링
* SQLite 기반 데이터 관리
* 관리자 페이지를 통한 모듈 및 워크플로우 관리

---

# 프로젝트 구조

```text
WebCrawlServer/
│
├── AGENTS.md
├── README.md
├── package.json
│
├── server/
│   ├── app.js
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   └── utils/
│
├── modules/
│   └── <module_name>/
│       ├── actions/
│       ├── workflow.yaml
│       ├── schema.sql
│       ├── config.json
│       └── README.md
│
├── plugin/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   └── popup/
│
├── workflows/
├── database/
├── public/
├── logs/
├── config/
│
└── docs/
    ├── rule/
    ├── ask.md
    ├── todo.md
    ├── todo.history.md
    ├── CHANGELOG.md
    ├── CHANGELOG/
    ├── askLogs/
    └── tips/
```

---

# 시스템 구성

```text
Browser Plugin
        │
        ▼
MCP Protocol
        │
        ▼
WebCrawlServer
        │
 ┌──────┼──────────┐
 │      │          │
 ▼      ▼          ▼
Module Workflow Scheduler
Engine Engine
        │
        ▼
SQLite Database
        │
        ▼
Admin UI
```

---

# 기술 스택

| 항목                | 기술                 |
| ----------------- | ------------------ |
| Runtime           | Node.js 18+        |
| Framework         | Express            |
| Database          | SQLite             |
| Communication     | WebSocket, HTTP    |
| Workflow          | YAML               |
| Scheduler         | node-cron          |
| Browser Extension | Chrome Manifest V3 |
| Video Processing  | FFmpeg             |

---

# 시작하기

## 1. 저장소 복제

```bash
git clone <repository>
cd WebCrawlServer
```

## 2. 패키지 설치

```bash
npm install
```

## 3. 서버 실행

```bash
npm start
```

또는

```bash
node server/app.js
```

**PowerShell 백그라운드 실행:**
```powershell
Start-Process -FilePath "node" -ArgumentList "server/app.js" -NoNewWindow
```

**PowerShell 가상환경 (.venv) 생성 및 사용:**
```powershell
# 1. 가상환경 생성 (한 번만 실행)
python -m venv .venv

# 2. 활성화 (PowerShell)
.\.venv\Scripts\Activate.ps1

# 3. 비활성화
deactivate

# 4. 가상환경에서 서버 백그라운드 실행
Start-Process -FilePath ".\.venv\Scripts\node.exe" -ArgumentList "server/app.js" -NoNewWindow
```

**cmd.exe용 활성화:**
```cmd
.\.venv\Scripts\activate.bat
```

**서버 정보:**
- **기본 포트**: 9600 (R-001 architecture.md 기준)
- **환경 변수**: `PORT` (예: `PORT=8080 node server/app.js`)

**접속 주소:**
- HTTP 서버: `http://localhost:9600`
- WebSocket 서버: `ws://localhost:9600`
- 헬스 체크: `http://localhost:9600/health`

**npx 사용:**
```bash
# npx로 직접 실행 (global package 설치 없이)
npx node server/app.js
```

---

# 서버 관리 명령어

## 서버 실행

### 기본 실행
```bash
# npm scripts 사용 (권장)
npm start

# 또는 직접 Node.js 실행
node server/app.js

# npx 사용 (글로벌 설치 없이)
npx node server/app.js
```

### 개발 모드 (자동 재시작)
```bash
# nodemon 사용 (변경 시 자동 재시작)
npm run dev

# 또는 직접 nodemon 실행
npx nodemon server/app.js
```

### PM2 프로세스 관리

> **⚠️ PM2 설치 필요** (로컬 설치된 pm2 사용)
> ```bash
> npm install
> ```

**PM2로 서버 시작:**
```bash
# 개발 환경 (파일 변경 감시, 자동 재시작)
npm run dev:pm2

# 또는 pm2 직접 사용 (개발 환경)
npx pm2 start ecosystem.config.js --env_dev

# production 환경
npm run prod:pm2
# 또는
npx pm2 start ecosystem.config.js --env production
```

**PM2 기본 명령어:**
```bash
# PM2로 서버 시작
npm run pm2:start

# 서버 중지
npm run pm2:stop

# 서버 재시작 (코드 변경 시)
npm run pm2:restart

# graceful 재시작 (0초 다운타임)
npm run pm2:reload

# 프로세스 목록 확인
npm run pm2:list

# 로그 확인
npm run pm2:logs

# 실시간 모니터링 대시보드
npm run pm2:monitor

# PM2에서 완전 삭제
npm run pm2:delete
```

**PM2 직접 명령어 (npx 사용):**
```bash
# 모든 PM2 프로세스 목록
npx pm2 list

# 특정 프로세스 로그 보기
npx pm2 logs WebCrawlServer

# 로그 출력 (--lines로 줄 수 제한)
npx pm2 logs WebCrawlServer --lines 100

# 실시간 로그 스트림
npx pm2 logs WebCrawlServer --follow

# 프로세스 모니터링
npx pm2 monit

# CPU/메모리 사용량 확인
npx pm2 show WebCrawlServer

# 프로세스 중지
npx pm2 stop WebCrawlServer

# 모든 프로세스 중지
npx pm2 stop all

# 프로세스 삭제 (PM2 목록에서 제거)
npx pm2 delete WebCrawlServer

# 모든 프로세스 삭제
npx pm2 delete all

# PM2 데몬 종료
npx pm2 kill
```

**PM2 저장 및 부팅 시 자동 시작:**
```bash
# 현재 프로세스 저장 (부팅 시 자동 시작)
npx pm2 save

# 저장된 프로세스 불러오기
npx pm2 resurrect

# 자동 시작 설정 (시스템 부팅 시)
npx pm2 startup
# STARTUP SCRIPT 생성 후 다음 명령을 실행하라는 메시지 출력
# 출력된 명령어 실행 (예: install -g pm2 이 필요한 경우)
# Windows의 경우 관리자 권한이 필요할 수 있음

# 저장된 프로세스 자동 시작 확인
npx pm2 dump
```

### 특정 포트에서 실행
```bash
# 환경 변수 사용
PORT=8080 npm start

# 또는 직접 포트 지정
node server/app.js --port 8080
```

## 서버 상태 확인

### 헬스 체크
```bash
# curl로 헬스 체크
curl http://localhost:9600/health

# 또는 브라우저에서 확인
# http://localhost:9600/health
```

### WebSocket 테스트
```bash
# wscat으로 WebSocket 연결 테스트 (wscat 설치 필요)
npx wscat -c ws://localhost:9600

# 메시지 전송 테스트
npx wscat -c ws://localhost:9600
> {"messageId":"test1","type":"heartbeat","module":"test","action":"ping","timestamp":"2026-07-26T00:00:00Z","protocolVersion":"1.0"}
```

## 프로세스 관리

### 서버 재시작
```bash
# 현재 실행 중인 서버 종료 (Ctrl+C)
# 그리고 다시 시작
npm start
```

### 백그라운드 실행 (Windows)
```powershell
# PowerShell에서 백그라운드로 실행
Start-Process -FilePath "node" -ArgumentList "server/app.js" -NoNewWindow

# 프로세스 확인
Get-Process node

# 프로세스 종료
Stop-Process -Name "node" -Force
```

### 백그라운드 실행 (Linux/macOS)
```bash
# nohup으로 백그라운드 실행
nohup node server/app.js > server.log 2>&1 &

# 프로세스 확인
ps aux | grep node

# 프로세스 종료
kill $(ps aux | grep 'node server/app.js' | grep -v grep | awk '{print $2}')
```

## 로그 관리

### 서버 로그 확인
```bash
# 서버 콘솔 로그 (직접 실행 시)
# 표준 출력에서 확인

# 파일 로그 확인 (백그라운드 실행 시)
tail -f server.log

# database 로그 (SQLite)
sqlite3 database/main.db "SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10;"
```

### 로그 파일을 통한 모니터링
```bash
# 실시간 로그 확인
# Linux/macOS
tail -f server.log

# Windows (PowerShell)
Get-Content -Path server.log -Wait

# Windows (cmd)
type server.log | more
```

```bash
# 특정 오류 로그 찾기
# Linux/macOS
grep -i "error" server.log

# Windows (PowerShell)
Select-String -Path server.log -Pattern "error" -CaseSensitive:$false

# Windows (cmd)
findstr /i "error" server.log
```

## 데이터베이스 관리

### SQLite 데이터베이스

> **⚠️ SQLite3 CLI 설치 필요**
> - Windows: `npm install -g sqlite3` 또는 [SQLite Download](https://www.sqlite.org/download.html)
> - Linux: `sudo apt-get install sqlite3` (Ubuntu/Debian)
> - macOS: `brew install sqlite`

```bash
# 데이터베이스 파일 위치
# database/main.db

# SQLite3 셸로 접근
sqlite3 database/main.db

# 테이블 목록 확인
sqlite3 database/main.db ".tables"

# 데이터 백업
sqlite3 database/main.db ".dump" > database_backup.sql

# 데이터 복원
sqlite3 database/main.db < database_backup.sql
```

**Windows PowerShell 예시:**
```powershell
# SQLite3 모듈 사용
sqlite3 database/main.db ".tables"
```

### 주요 테이블 쿼리
```bash
# 모듈 목록 확인
sqlite3 database/main.db "SELECT * FROM modules;"

# 워크플로우 목록 확인
sqlite3 database/main.db "SELECT * FROM workflows;"

# 스케줄러 작업 확인
sqlite3 database/main.db "SELECT * FROM scheduled_jobs;"

# 최근 활동 로그
sqlite3 database/main.db "SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 20;"

# 오류 로그 확인
sqlite3 database/main.db "SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 20;"
```

## 의존성 관리

### 패키지 설치
```bash
# 로컬 패키지 설치 (모든 의존성)
npm install

# 특정 패키지 설치
npm install express

# devDependencies 설치
npm install --save-dev nodemon
```

### 패키지 업데이트
```bash
# 모든 패키지 업데이트
npm update

# 특정 패키지 업데이트
npm update express

# 최신 버전으로 업데이트
npm install express@latest
```

### 패키지 삭제
```bash
# 특정 패키지 삭제
npm uninstall express

# devDependencies 삭제
npm uninstall --save-dev nodemon
```

### 패키지 정보 확인
```bash
# 설치된 패키지 목록
npm list

# package.json의 전체 의존성 Trees
npm ls

# 특정 패키지 정보
npm view express

# 설치된 패키지 버전 확인
npm list express
```

## 정리 및 초기화

### 캐시 및 임시 파일 삭제
```bash
# Linux/macOS
rm -rf node_modules
rm package-lock.json
npm install
```

```powershell
# Windows (PowerShell)
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

```cmd
# Windows (cmd)
rmdir /s /q node_modules
Del package-lock.json
npm install
```

### database 초기화
```bash
# Linux/macOS
rm -rf database
npm start
```

```powershell
# Windows (PowerShell)
Remove-Item -Recurse -Force database
npm start
```

```cmd
# Windows (cmd)
rmdir /s /q database
npm start
```

### 로그 파일 삭제
```bash
# Linux/macOS
rm -rf logs/*
npm start
```

```powershell
# Windows (PowerShell)
Remove-Item -Path logs\* -Recurse -Force
npm start
```

```cmd
# Windows (cmd)
Del /q logs\*.*
npm start
```

---

# 개발 철학

# 개발 철학

본 프로젝트는 다음 원칙을 기준으로 개발합니다.

* 모듈화
* 표준화
* 확장성
* 독립성
* 유지보수성

기존 코드를 수정하기보다 새로운 모듈을 추가하여 기능을 확장하는 것을 기본 원칙으로 합니다.

---

# 모듈 구조

모든 기능은 독립적인 모듈로 구성됩니다.

예시

```text
modules/
    crawler/
    image_editor/
    note_manager/
    video_editor/
    db_monitor/
```

각 모듈은 다음 파일을 포함합니다.

* workflow.yaml
* schema.sql
* config.json
* actions/
* README.md

---

# Workflow

모든 자동화는 YAML 기반 Workflow를 통해 실행됩니다.

지원 기능

* navigate
* click
* input
* waitFor
* extract
* download
* scroll
* condition
* loop
* setVariable
* custom

---

# Scheduler

지원 방식

* Once
* Interval
* Cron
* Condition

모든 예약 작업은 SQLite에 저장되며 서버 시작 시 자동으로 다시 등록됩니다.

---

# 데이터베이스

기본 데이터베이스는 SQLite를 사용합니다.

주요 시스템 테이블

* modules
* workflows
* scheduled_jobs
* activity_logs
* error_logs

모듈 전용 테이블은 관리자 페이지에서 동적으로 생성합니다.

---

# 개발 문서

프로젝트 운영 규칙은 아래 문서를 기준으로 합니다.

| 문서                        | 역할            |
| ------------------------- | ------------- |
| AGENTS.md                 | 최상위 AI 운영 규칙  |
| docs/rule/instructions.md | 개발 및 운영 세부 규칙 |
| docs/ask.md               | 작업 요청         |
| docs/todo.md              | 현재 작업 계획      |
| docs/CHANGELOG.md         | 버전 관리         |

README는 프로젝트 소개 문서이며, 세부 개발 규칙은 위 문서를 기준으로 합니다.

---

# 개발 흐름

```text
사용자 요청
      │
      ▼
docs/ask.md
      │
      ▼
docs/todo.md
      │
      ▼
개발
      │
      ▼
테스트
      │
      ▼
todo.history.md
      │
      ▼
CHANGELOG
      │
      ▼
Git Commit
```

---

# 라이선스

본 프로젝트의 라이선스는 별도로 정의되지 않았습니다.

필요 시 LICENSE 파일을 추가하여 적용합니다.
