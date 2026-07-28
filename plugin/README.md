# WebCrawlServer 브라우저 플러그인

WebCrawlServer MCP(Modular Control Platform) 프로토콜 기반 브라우저 자동화 플러그인입니다.

## 개요

이 플러그인은 WebCrawlServer와 WebSocket으로 연결되어 서버로부터 수신한 스크립트(steps)를 브라우저에서 실행하고, 결과를 서버로 반환합니다. Chrome, Firefox, Opera 등 Manifest V3를 지원하는 모든 브라우저에서 동작합니다.

## 주요 기능

- **WebSocket 통신**: 서버의 MCP 프로토콜을 통한 양방향 실시간 통신
- **브라우저 자동화**: 페이지 이동, 클릭, 입력, 스크롤, 데이터 추출 등
- **스크립트 실행**: 서버로부터 수신한 단계형 스크립트(steps) 순차 실행
- **데이터 수집**: 페이지 정보, 이미지, 링크, 메타데이터 수집
- **조건/반복 처리**: condition, loop 등 워크플로우 제어 구조 지원
- **다중 브라우저 제어**: 여러 브라우저 인스턴스의 프로세스 통제

## 파일 구조

```
plugin/
├── manifest.json          # 브라우저 확장 프로그램 매니페스트
├── background.js          # 서비스 워커 (WebSocket 연결 및 MCP 메시지 처리)
├── contentScript.js       # 콘텐츠 스크립트 (DOM 조작 및 데이터 수집)
├── popup/
│   ├── popup.html         # 팝업 UI
│   ├── popup.js           # 팝업 로직
│   └── popup.css          # 팝업 스타일
├── options/
│   ├── options.html       # 옵션 페이지
│   ├── options.js         # 옵션 로직
│   └── options.css        # 옵션 스타일
├── icons/
│   ├── icon16.svg         # 16x16 아이콘
│   ├── icon48.svg         # 48x48 아이콘
│   └── icon128.svg        # 128x128 아이콘
└── README.md              # 본 파일
```

## 설치 방법 및 권한 설정 가이드

### Chrome / Edge / Opera 개발자 모드 설치

1. 브라우저 주소창에 확장 프로그램 관리 페이지 접속
   - Chrome / Edge: `chrome://extensions`
   - Opera: `opera://extensions`
2. 우측 상단의 **"개발자 모드 (Developer mode)"** 토글 활성화
3. **"압축 해제된 확장 프로그램 로드 (Load unpacked)"** 버튼 클릭
4. 프로젝트의 `plugin/` 디렉토리 선택

### 💡 Opera 및 크로미움 브라우저 모든 권한(All Permissions) 자동 부여 및 설정 가이드

개발자 모드로 로드 시 `manifest.json` 설정에 따라 기본적으로 모든 도메인 권한이 승인되지만, 보안 정책상 완전 무제한 자동 실행을 위해서는 아래 설정을 확인해야 합니다.

1. **Manifest V3 파일 설정 (`manifest.json`)**:
   - `host_permissions`에 `"<all_urls>"`가 지정되어 있으므로 설치 시 모든 웹사이트 접근 권한을 기본으로 가지게 됩니다.
   - `content_scripts`에 `matches: ["<all_urls>"]` 및 `all_frames: true`가 등록되어 모든 탭 및 프레임에서 스크립트가 자동 실행됩니다.

2. **Opera / 크로미움 브라우저 상세 권한 토글 (필수 체크)**:
   - `opera://extensions` (또는 `chrome://extensions`)에서 WebCrawlServer 플러그인의 **"세부정보 (Details)"** 클릭
   - **사이트 접근 (Site access)**: `모든 사이트에서 (On all sites)`로 선택되어 있는지 확인 (기본값)
   - **시크릿 모드에서 허용 (Allow in incognito)**: 켜기 (시크릿 창 자동화 지원 시 필수)
   - **파일 URL에 대한 접근 허용 (Allow access to file URLs)**: 켜기 (로컬 HTML 파일 분석 시 필수)

### Firefox

1. 브라우저 주소창에 `about:debugging#/runtime/this-firefox` 입력
2. "임시 확장 프로그램 로드" 클릭
3. `plugin/manifest.json` 파일 선택

## 설정 방법

1. 플러그인 아이콘 우클릭 → "옵션" 선택
2. 서버 URL 입력 (기본값: `ws://localhost:9600`)
3. WebSocket 토큰 입력 (서버의 `WS_TOKEN` 환경변수 값)
4. "설정 저장" 클릭
5. "연결" 버튼 클릭하여 서버 연결

## MCP 프로토콜 지원

### 표준 명령어
- `open_browser`: 브라우저/탭 열기
- `crawl_page`: 페이지 크롤링 및 데이터 수집
- `run_process`: 스크립트/프로세스 실행
- `stop_process`: 실행 중인 프로세스 중지
- `send_message`: 메시지 전송
- `log_event`: 이벤트 로그 기록
- `monitor_status`: 플러그인 상태 모니터링
- `manage_db`: 로컬 저장소 관리

### 스크립트 스텝 타입
- `navigate`: 페이지 이동
- `waitFor`: 요소/조건 대기
- `extract`: 텍스트/데이터 추출
- `click`: 요소 클릭
- `input`: 텍스트 입력
- `scroll`: 페이지 스크롤
- `collectImages`: 이미지 수집
- `download`: 파일 다운로드
- `condition`: 조건 분기
- `loop`: 반복 실행
- `setVariable`: 변수 설정
- `custom`: 커스텀 액션

## 개발

### 요구사항
- Node.js 18+
- npm (로컬 설치)

### 로컬 테스트
1. WebCrawlServer 실행: `node server/app.js`
2. 브라우저에 플러그인 로드
3. 옵션 페이지에서 서버 설정
4. 연결 테스트

## 라이선스

MIT