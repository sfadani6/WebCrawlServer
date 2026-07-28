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

## 설치 방법

### Chrome / Edge / Opera

1. 브라우저 주소창에 `chrome://extensions` 입력
2. 우측 상단의 "개발자 모드" 활성화
3. "압축 해제된 확장 프로그램 로드" 클릭
4. `plugin/` 디렉토리 선택

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