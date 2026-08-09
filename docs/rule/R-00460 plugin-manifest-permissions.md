본 문서는 `WebCrawlServer` 브라우저 확장 플러그인의 매니페스트 및 권한 관리 개정 지침입니다. **사이드바(`sidePanel`)** 및 **오프스크린(`offscreen`)** 아키텍처 도입에 따른 매니페스트 V3 필수 권한 선언 규정, 36종 풀 권한(Permissions) 구성, `default_popup` 제거 규정, `manifest.json` 내 주석 작성 금지 규칙, 그리고 **오페라(Opera) 전용 플러그인(`plugins/opera-plugin`)의 `sidebar_action` 사이드바 규정**을 정의합니다.

---

## 1. 개요 및 Manifest V3 기본 원칙

1.1 **버전 규격**: 모든 확장 프로그램 매니페스트는 `"manifest_version": 3` 표준 규격을 준수해야 합니다.  
1.2 **백그라운드 가동**: 백그라운드 스크립트는 MV3 서비스 워커 표준(`"background": { "service_worker": "background.js", "type": "module" }`)으로 등록되어야 합니다.  
1.3 **내부 운영용 풀 권한 세팅**: 스토어 미배포(개발자 모드 direct 로드) 내부 운영 방식이므로, 크롬 웹스토어의 권한 심사 제약 없이 확장 프로그램이 제공하는 36종 전 권한(Permissions)을 활성화하여 수집, 포스팅, 모니터링을 지원합니다. (참고) 깃허브 연동 기능은 현재 보류 항목이며, 별도 보안/운용 검토 후 권한 요구 여부를 확정합니다.
1.4 **오페라(Opera) 브라우저 지원 규정**:
   - 오페라는 크로미움(Chromium) 기반이지만 Chrome 확장 API를 전부 지원하지 않으며, 특히 **`sidePanel` permission을 인식하지 못해 `Permission 'sidePanel' is unknown` 오류**로 확장 프로그램 로드 및 사이드바 표시가 실패합니다.
   - 오페라의 사이드바는 **별도 권한 없이 `sidebar_action` 매니페스트 키**로 동작합니다 (Opera 30+). `default_panel`(필수), `default_title`(선택), `default_icon`(필수) 속성을 사용합니다.
   - 오페라 지원을 위해 `plugins/opera-plugin/`을 별도 플러그인으로 분리 유지하며, 기능은 `plugins/basic-plugin`과 동일하되 오페라 특수 부분(사이드바 방식)만 변경합니다. 배포 방식에 대한 자세한 규정은 `ADR-006` 문서를 참조합니다.

---

## 2. 매니페스트 주석 금지 및 분리 기록 규칙 (절대 규칙)

2.1 **`manifest.json` 주석 작성 엄격 금지**:
   - Chrome 확장 프로그램 매니페스트 파서(`JSON.parse`)는 주석을 허용하지 않으며, `//` 또는 `/* */` 주석 포함 시 **확장 프로그램 로드가 정지(Syntax Error)**됩니다.
2.2 **`manifest.json.md` 분리 설명 문서 작성 필수**:
   - 선언된 36종 권한의 활용 목적 및 보안 영향도는 동일 디렉터리의 **`manifest.json.md`** 마크다운 문서에 상세 기록하여 주석을 대체합니다.

---

## 3. 개정 표준 매니페스트 명세 (`plugins/basic-plugin/public/manifest.json`)

사이드바(`sidePanel`) 권한 및 전 권한이 반영된 36종 풀 권한 매니페스트 전문입니다.

```json
{
  "manifest_version": 3,
  "name": "기본 검증용 수집 플러그인",
  "version": "1.0.0",
  "description": "WebCrawlServer 분산 크롤링, 사이드바 및 오프스크린 무중단 연동 확장 프로그램",
  "permissions": [
    "sidePanel",
    "offscreen",
    "management",
    "activeTab",
    "alarms",
    "bookmarks",
    "browsingData",
    "clipboardRead",
    "clipboardWrite",
    "contextMenus",
    "cookies",
    "declarativeNetRequest",
    "downloads",
    "gcm",
    "geolocation",
    "history",
    "idle",
    "notifications",
    "pageCapture",
    "power",
    "printerProvider",
    "privacy",
    "proxy",
    "scripting",
    "sessions",
    "storage",
    "system.cpu",
    "system.memory",
    "system.storage",
    "tabCapture",
    "tabs",
    "topSites",
    "tts",
    "ttsEngine",
    "webNavigation",
    "webRequest"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "<all_urls>"
      ],
      "js": [
        "content.js"
      ]
    }
  ]
}
```

---

## 4. 매니페스트 주요 구성 요소 가이드

4.1 **`sidePanel` & `side_panel`**:
   - 우측 상시 사이드바 대시보드를 사용하기 위해 필수 선언하며, 기본 진입 HTML을 `"sidepanel.html"`로 지정합니다.
4.2 **`offscreen`**:
   - 24시간 무중단 백그라운드 웹소켓 연결 및 `fetch()` 경량 인출 엔진을 유지하기 위해 필수 선언합니다.
4.3 **`management`**:
   - 설치된 타 확장 프로그램 감지 및 제어를 위해 선언합니다.
4.4 **`action` 항목의 `default_popup` 제거**:
   - 툴바 아이콘 클릭 시 팝업 대신 사이드바가 즉시 열리도록 `default_popup` 속성을 완전히 삭제합니다.
4.5 **`host_permissions` (`<all_urls>`)**:
   - 모든 웹사이트의 DOM 데이터 수집, 세션 쿠키 활용, 백그라운드 `fetch()` 고속 인출을 위해 전체 도메인 허용을 유지합니다.

---

## 5. 검증 절차

- `manifest.json` 수정 후 빌드 명령(`npm run build --workspace=basic-plugin`)을 단행합니다.
- 크롬 확장 프로그램 관리 페이지(`chrome://extensions/`)에서 [새로고침]을 클릭하여 구문 에러 없이 정상 로드되는지 검증합니다.
- `manifest.json` 내부에 어떠한 주석 구문(`//` 또는 `/* */`)도 포함되지 않았는지 확인합니다.

---

## 6. 오페라 전용 매니페스트 명세 (`plugins/opera-plugin/public/manifest.json`)

오페라 브라우저는 `sidePanel` permission을 인식하지 못하므로, 오페라 전용 플러그인은 다음 규정을 따릅니다.

### 6.1 오페라 전용 매니페스트 차이점 (basic-plugin 대비)

| 구분 | basic-plugin (Chrome) | opera-plugin (Opera) |
|---|---|---|
| permissions | `"sidePanel"` 포함 36종 | `"sidePanel"` **제거** (unknown 오류 소거) |
| 사이드바 선언 | `"side_panel": { "default_path": "sidepanel.html" }` | `"sidebar_action": { "default_panel": "sidepanel.html", ... }` |
| 아이콘 클릭 오픈 | `chrome.sidePanel.setPanelBehavior` | 오페라 아이콘 클릭 자동 오픈 (`sidebar_action`) |

### 6.2 오페라 전용 매니페스트 전문

```json
{
  "manifest_version": 3,
  "name": "오페라 검증용 수집 플러그인",
  "version": "1.0.0",
  "description": "WebCrawlServer 분산 크롤링, 오페라 사이드바 및 오프스크린 무중단 연동 확장 프로그램",
  "permissions": [
    "offscreen",
    "management",
    "activeTab",
    "alarms",
    "bookmarks",
    "browsingData",
    "clipboardRead",
    "clipboardWrite",
    "contextMenus",
    "cookies",
    "declarativeNetRequest",
    "downloads",
    "gcm",
    "geolocation",
    "history",
    "idle",
    "notifications",
    "pageCapture",
    "power",
    "printerProvider",
    "privacy",
    "proxy",
    "scripting",
    "sessions",
    "storage",
    "system.cpu",
    "system.memory",
    "system.storage",
    "tabCapture",
    "tabs",
    "topSites",
    "tts",
    "ttsEngine",
    "webNavigation",
    "webRequest"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "sidebar_action": {
    "default_title": "WebCrawlServer 수집 대시보드",
    "default_panel": "sidepanel.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "<all_urls>"
      ],
      "js": [
        "content.js"
      ]
    }
  ]
}
```

### 6.3 오페라 전용 코드 가드 규정

- `src/background.ts`의 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 호출은 오페라에서 `chrome.sidePanel`이 `undefined`이므로 **옵셔널 체이닝(`chrome.sidePanel?.setPanelBehavior(...)`)으로 가드**하여 예외를 방지합니다.
- 오페라에서 `chrome.offscreen` 및 `chrome.runtime.getContexts` 지원 여부는 오페라 버전에 따라 상이할 수 있으며, 오프스크린 미지원 시 무중단 웹소켓 폴백 대응은 로드 테스트 결과에 따라 별도 ADR로 규정합니다.

---

## 7. 오페라 플러그인 검증 절차

- 빌드: `npm run build --workspace=opera-plugin`
- 오페라 확장 프로그램 관리 페이지(`opera://extensions/`)에서 개발자 모드로 `dist/` 폴더를 로드하여 `Permission 'sidePanel' is unknown` 오류 없이 정상 로드되는지 검증합니다.
- `dist/manifest.json`에 `sidebar_action` 키가 존재하고, `sidePanel` permission 및 `side_panel` 키가 포함되지 않았는지 확인합니다.
- 툴바 아이콘 클릭 시 오페라 사이드바(`default_panel`로 지정한 `sidepanel.html`)가 정상 표시되는지 검증합니다.
