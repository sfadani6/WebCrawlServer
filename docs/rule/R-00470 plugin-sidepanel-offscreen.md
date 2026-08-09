본 문서는 `WebCrawlServer` 프로젝트의 브라우저 확장 플러그인에 **사이드바 통합 UI(Side Panel)**와 **24시간 무중단 웹소켓 엔진(Offscreen Document)**을 구축하고, 크롬 포트 연결 기반으로 사이드바 생명주기를 정밀 추적하기 위한 기술 지침서입니다.

---

## 1. 개요 및 구현 목적

1.1 **개요**: Chrome MV3 서비스 워커의 30초 비활성화(Sleep) 제약을 극복하고, 유저 UI 조작 환경을 다변화하기 위해 오프스크린 문서와 사이드 패널을 기존 `plugins/basic-plugin/` 모듈에 통합 구축합니다.  
1.2 **구현 목적**:
   - **무중단 수집 엔진 (Offscreen)**: 브라우저 가동 중 24시간 끊기지 않는 영속적 단일 웹소켓 소유.
   - **상시 유저 대시보드 (Side Panel)**: 탭을 이동해도 닫히지 않는 우측 상시 노출형 제어 대시보드 제공 (기존 팝업 UI 대체).
   - **크롬 포트 연결 기반 생명주기 추적**: 사이드바 창 닫힘 시 패킷 유실을 방지하도록 `chrome.runtime.connect` 포트를 통한 정밀 감시 구현.

---

## 2. 시스템 아키텍처 및 역할 분담 (Architecture)

```
[ WebCrawlServer (포트 9600) ]
            ▲
            │ (1) 24시간 영속적 단일 웹소켓 통신 (WebSocket Owner)
            ▼
┌──────────────────────────────────────────────────────────┐
│  offscreen.ts (Offscreen Document)                       │
│  - 화면에 안 보이는 백그라운드 헤드리스 DOM               │
│  - WebSocket 소켓 객체를 독점 소유 및 수신 패킷 릴레이   │
└────────────────────────────▲─────────────────────────────┘
                             │ (2) chrome.runtime.connect 포트 생명주기 추적
                             ▼
┌──────────────────────────────────────────────────────────┐
│  background.ts (Service Worker)                          │
│  - 브라우저 기동 시 오프스크린 문서 자동 생성/유지 관리  │
│  - offscreen, sidepanel, popup, content 간 패킷 라우팅  │
└───────▲────────────────────▲─────────────────────▲───────┘
        │                    │                     │
        ▼                    ▼                     ▼
[ sidepanel.tsx ]     [ popup.tsx ]         [ content.ts ]
(사이드바 UI 대시보드)   (삭제/대체됨)        (타깃 페이지 DOM 수집)
```

---

## 3. 디렉터리 및 파일 구조 명세 (Directory Structure)

기존 모듈화 아키텍처(`R-00410`)를 확장하여 소스 파일을 다음과 같이 배치합니다.

```
plugins/basic-plugin/
├── public/
│   ├── manifest.json            # permissions ("offscreen", "sidePanel", "management") 및 side_panel 설정
│   ├── sidepanel.html           # 사이드바 메인 HTML 엔트리
│   └── offscreen.html           # 오프스크린 백그라운드 HTML 엔트리
├── src/
│   ├── config/
│   │   └── pluginConfig.ts      # 빌드 타임 주입 상수 및 소켓 URL 생성 모듈
│   ├── types/
│   │   └── index.ts             # 확장형 패킷 봉투(WebSocketPacket<T>) 타입 정의
│   ├── services/
│   │   ├── chromeService.ts     # 크롬 API 및 오프스크린 상태 질의 모듈
│   │   ├── githubService.ts     # 깃허브 REST API 커밋/푸시 모듈 (보류: 백로그 항목)
│   │   └── backgroundScraper.ts # 백그라운드 fetch() + DOMParser 인출 모듈
│   ├── hooks/
│   │   └── usePopupState.ts     # 사이드바 UI용 공통 비즈니스 로직 훅
│   ├── components/              # Header, TabBar, Footer, Tabs 프레젠테이션 컴포넌트
│   ├── background.ts            # 오프스크린 생성 관리 및 패킷 라우팅 모듈
│   ├── content.ts               # DOM 수집 및 선언형 페이징 순차 수집 엔진
│   ├── sidepanel.tsx            # 단일 메인 사이드바 대시보드 UI 엔트리
│   └── offscreen.ts             # 24시간 무중단 단일 웹소켓 전담 엔진 엔트리
└── vite.config.ts               # Rollup input에 sidepanel, offscreen 엔트리 지정
```

---

## 4. 매니페스트 설정 규정 (`public/manifest.json`)

4.1 **권한 선언**: `"permissions"` 배열에 `"offscreen"`, `"sidePanel"`, `"management"`를 필수 등록합니다.  
4.2 **사이드 패널 및 팝업 제거**: `"side_panel"` 경로를 선언하고, 아이콘 클릭 시 사이드바가 바로 켜지도록 `"action"`의 `"default_popup"`을 제거합니다.  

```json
{
  "manifest_version": 3,
  "name": "WebCrawlServer 통합 수집기",
  "version": "1.0.0",
  "permissions": [
    "offscreen",
    "sidePanel",
    "management",
    "storage",
    "activeTab",
    "scripting",
    "tabs"
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
  }
}
```

---

## 5. 백그라운드 서비스 워커 지침 (`src/background.ts`)

`background.ts`는 직접 웹소켓을 연결하지 않고, 오프스크린 문서의 생성 및 메시지 중계 라우팅만 담당합니다.

```typescript
// plugins/basic-plugin/src/background.ts

/**
 * 크롬 백그라운드에 오프스크린 문서가 미생성 상태일 경우 동적으로 자동 생성합니다.
 */
async function ensureOffscreenDocument(): Promise<void> {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.BLOB],
    justification: "WebCrawlServer 분산 크롤링 24시간 무중단 웹소켓 유지",
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // 아이콘 클릭 시 팝업 대신 사이드바가 즉시 열리도록 크롬 설정
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  ensureOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreenDocument();
});

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  // 오프스크린 문서 생존 보장: 크롬은 일정 시간 후 오프스크린 문서를 임의 종료할 수 있으므로,
  // 소켓 관련 내부 메시지(GET_SOCKET_STATUS / SEND_SOCKET_PACKET / SOCKET_PACKET_RECEIVED)가
  // 백그라운드에 도달할 때마다 ensureOffscreenDocument()를 선행 호출합니다.
  // 오프스크린이 이미 존재하면 no-op이며, 종료된 상태면 즉시 재생성되어
  // offscreen.ts의 connectOffscreenSocket 실행(무중단 재연결)으로 이어집니다.
  if (
    message &&
    (message.type === "GET_SOCKET_STATUS" ||
      message.type === "SEND_SOCKET_PACKET" ||
      message.type === "SOCKET_PACKET_RECEIVED")
  ) {
    ensureOffscreenDocument();
  }
  // ... 이후 SOCKET_PACKET_RECEIVED 중계 로직
});
```

> **주의**: `onInstalled`/`onStartup` 이벤트는 브라우저 재시작·확장 설치 시점에만 발생하므로, 오프스크린 문서가 실행 중 크롬에 의해 닫히는 시나리오는 위 `onMessage` 진입부 재생성 보장이 유일한 복구 경로입니다. 소켓 관련 메시지 라우팅을 추가할 때는 반드시 진입부에 `ensureOffscreenDocument()` 선행 호출을 유지해야 합니다.

---

## 6. 오프스크린 24시간 소켓 전담 엔진 지침 (`src/offscreen.ts`)

`offscreen.ts`는 웹소켓의 **단독 소유자(Single Owner)**로 동작하며, 크롬 포트 연결로 사이드바 생명주기를 감시합니다.

```typescript
// plugins/basic-plugin/src/offscreen.ts

import { PLUGIN_CONFIG, getWebSocketUrl } from "./config/pluginConfig.js";
import { WebSocketPacket } from "./types/index.js";

let socket: WebSocket | null = null;

async function getOrCreateClientId(): Promise<string> {
  const result = await chrome.storage.local.get(["clientId"]);
  if (result && typeof result.clientId === "string") return result.clientId;
  const generatedId = crypto.randomUUID();
  await chrome.storage.local.set({ clientId: generatedId });
  return generatedId;
}

async function sendSidebarStatusToServer(isOpen: boolean): Promise<void> {
  const clientId = await getOrCreateClientId();
  const statusPacket: WebSocketPacket = {
    senderId: clientId,
    targetId: "SERVER",
    action: "CLIENT_STATUS_UPDATE",
    payloadType: "json",
    payload: { isSidebarOpen: isOpen },
    meta: { timestamp: Date.now() },
  };

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(statusPacket));
  }
}

async function connectOffscreenSocket(): Promise<void> {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const clientId = await getOrCreateClientId();
  const wsUrl = getWebSocketUrl(clientId);
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    const helloPacket: WebSocketPacket = {
      senderId: clientId,
      targetId: "SERVER",
      action: "CRAWL_LOG",
      payloadType: "json",
      payload: { system: "오프스크린 24시간 무중단 수집 엔진 정상 가동" },
      meta: { timestamp: Date.now() },
    };
    socket?.send(JSON.stringify(helloPacket));
  };

  socket.onmessage = async (event) => {
    try {
      const packet: WebSocketPacket = JSON.parse(event.data);

      if (packet.action === "UPDATE_AUTH_TOKEN" && packet.payload) {
        const { tokenType, token } = packet.payload as { tokenType: string; token: string };
        await chrome.storage.local.set({ [tokenType]: token });
      }

      // 사이드바 미오픈 시의 메시징 예외 차단 가드
      chrome.runtime.sendMessage({ type: "SOCKET_PACKET_RECEIVED", packet }).catch(() => {
        // 사이드바 닫혀있을 때 수신자 부재 예외 흡수
      });
    } catch {
      // 가드
    }
  };

  socket.onclose = () => {
    socket = null;
    setTimeout(connectOffscreenSocket, 3000);
  };
}

// 크롬 포트 연결로 사이드바 닫힘을 100% 확실하게 추적 감시
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel-port") {
    sendSidebarStatusToServer(true);

    port.onDisconnect.addListener(() => {
      sendSidebarStatusToServer(false);
    });
  }
});

connectOffscreenSocket();
```

---

## 7. 사이드바 메인 UI 대시보드 지침 (`src/sidepanel.tsx`)

사이드바는 마운트 시 크롬 전용 포트를 연결하여 생명주기를 오프스크린으로 알립니다.

```tsx
// plugins/basic-plugin/src/sidepanel.tsx

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

import { usePopupState } from './hooks/usePopupState';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { Footer } from './components/Footer';
import { BasicTab } from './components/tabs/BasicTab';
import { InfoTab } from './components/tabs/InfoTab';
import { DebugTab } from './components/tabs/DebugTab';

export default function SidePanel() {
  const state = usePopupState();

  useEffect(() => {
    // 포트 연결을 통해 사이드바 오픈 생명주기 연결
    const port = chrome.runtime.connect({ name: "sidepanel-port" });

    return () => {
      port.disconnect();
    };
  }, []);

  return (
    <div className="w-full h-screen bg-[#0d131f] text-slate-100 flex flex-col p-4 box-border overflow-hidden select-text">
      <Header />
      <div className="my-2">
        <TabBar activeTab={state.activeTab} onSelectTab={state.setActiveTab} />
      </div>

      <div className="flex-1 overflow-y-auto my-2 pr-1">
        {state.activeTab === 'basic' && (
          <BasicTab
            isServerOnline={state.isServerOnline}
            currentUrl={state.currentUrl}
            isSending={state.isSending}
            statusMessage={state.statusMessage}
            onSendFullDom={state.handleSendFullDom}
          />
        )}
        {state.activeTab === 'info' && (
          <InfoTab browserInfo={state.browserInfo} processorInfo={state.processorInfo} />
        )}
        {state.activeTab === 'debug' && (
          <DebugTab
            debugMessage={state.debugMessage}
            debugStatus={state.debugStatus}
            onChangeDebugMessage={state.setDebugMessage}
            onSendDebugMessage={state.handleSendDebugMessage}
          />
        )}
      </div>

      <Footer clientId={state.clientId} />
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) ReactDOM.createRoot(rootElement).render(<SidePanel />);
```

---

## 8. 검증 체크리스트

- [ ] `offscreen.ts`가 백그라운드에서 24시간 소켓을 단독 소유하는가?
- [ ] 사이드바 창을 닫았을 때 `chrome.runtime.connect` 포트 `onDisconnect`를 통해 `isSidebarOpen: false` 상태가 유실 없이 전송되는가?
- [ ] 사이드바가 닫혀있을 때 `sendMessage().catch()` 가드가 작동하여 콘솔 예외가 방지되는가?
