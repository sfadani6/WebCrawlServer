본 문서는 `WebCrawlServer` 브라우저 확장 플러그인의 네트워크 통신 및 크롬 내부 메시징 개정 지침입니다. 백엔드 웹소켓 통신 소유권이 **`offscreen.ts`로 단독 이관**되고 **크롬 포트 연결 기법**이 도입됨에 따라, 오프스크린-백그라운드-사이드바 간 메시지 라우팅 규격, 포트 기반 생명주기 감지, 비동기 응답 채널 가드 및 실시간 토큰 동기화 처리 지침을 재정의합니다.

---

## 1. 개정 통신 아키텍처 개요

플러그인은 외부 소켓 관로와 내부 메시징 관로를 철저히 분리하여 운영합니다.

```
[ WebCrawlServer (포트 9600) ]
            ▲
            │ (1) External WebSocket (ws://localhost:9600?clientId=<UUID>&clientType=plugin)
            │     *오프스크린(offscreen.ts)이 24시간 단독 소유*
            ▼
[ offscreen.ts (Offscreen Engine) ]
            ▲
            │ (2) Internal Runtime Messaging (chrome.runtime)
            │     + 크롬 전용 포트 연결 (chrome.runtime.connect) -> 사이드바 열림/닫힘 감지
            ▼
[ background.ts (Service Worker) ]
    ▲                      ▲
    │ (Internal Messaging) │ (3) Tab Messaging (chrome.tabs)
    ▼                      ▼
[ sidepanel.tsx ]   [ content.ts ]
```

---

## 2. 백엔드 WebSocket 단독 소유 지침 (`offscreen.ts`)

2.1 **단일 소유권 원칙**: 백엔드 포트(9600)와의 외부 웹소켓 연결은 **오직 `offscreen.ts`에서만 단독 생성 및 유지**합니다. `background.ts`나 `sidepanel.tsx`가 직접 웹소켓을 연결하는 것을 금지합니다.  
2.2 **접속 URL 규격**: `ws://<host>:<port>?clientId=<UUID>&clientType=plugin` 규격을 준수합니다.  
2.3 **무중단 재연결 루프**: 소켓 절단(`onclose`) 감지 시 `socket = null` 초기화 후 3초 주기로 재귀 재연결을 단행합니다.  
2.4 **초기 안착 패킷**: 소켓 연결 성공(`onopen`) 즉시 `CRAWL_LOG` 액션의 안착 알림 패킷을 서버로 송출합니다.  

---

## 3. 크롬 내부 메시지 라우팅 및 예외 가드 규정

### 3.1 패킷 전달 파이프라인
- **사이드바 -> 서버**: `sidepanel.tsx`가 `chrome.runtime.sendMessage({ type: "SEND_SOCKET_PACKET", packet })` 호출 시, `offscreen.ts`가 이를 수신하여 자신의 웹소켓으로 송출합니다.
- **서버 -> 사이드바**: `offscreen.ts`가 서버 패킷 수신 시 `chrome.runtime.sendMessage({ type: "SOCKET_PACKET_RECEIVED", packet })`를 전송하여 사이드바 UI를 동적 최신화합니다.

### 3.2 수신자 부재 예외 차단 가드 (`catch()`)
- 사이드바 UI가 닫혀있을 때 `offscreen.ts`에서 `chrome.runtime.sendMessage`를 호출하면 발생할 수 있는 `Could not establish connection. Receiving end does not exist` 런타임 예외를 방지하기 위해 다음과 같이 `.catch(() => {})` 가드를 필수로 적용합니다.

```typescript
// plugins/basic-plugin/src/offscreen.ts 예외 가드 구문

socket.onmessage = async (event) => {
  const packet: WebSocketPacket = JSON.parse(event.data);
  
  // catch() 추가로 사이드바 미오픈 시의 콘솔 예외 방어
  chrome.runtime.sendMessage({ type: "SOCKET_PACKET_RECEIVED", packet }).catch(() => {
    // 수신자 부재 예외 조용히 무시
  });
};
```

### 3.3 포트 연결 기반 사이드바 생명주기 감지 (`chrome.runtime.connect`)
- 사이드바가 열릴 때 `chrome.runtime.connect({ name: "sidepanel-port" })`를 연결하고, 포트 연결 해제(`onDisconnect`)를 통해 유저가 사이드바 창을 닫았음을 유실 없이 100% 감지하여 서버로 `CLIENT_STATUS_UPDATE` 패킷을 전송합니다.

```typescript
// plugins/basic-plugin/src/offscreen.ts 포트 감지 수신기

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel-port") {
    // 사이드바 열림 상태 알림
    sendSidebarStatusToServer(true);

    // 사이드바 창 닫힘 시 100% 확실하게 해제 이벤트 발생
    port.onDisconnect.addListener(() => {
      sendSidebarStatusToServer(false);
    });
  }
});
```

---

## 4. 특수 메시지 패킷 규정

4.1 **사이드바 상태 알림 (`CLIENT_STATUS_UPDATE`)**:
   - 크롬 포트 감지를 통해 `isSidebarOpen: true/false` 정보를 오프스크린 소켓을 거쳐 서버로 송출합니다.
4.2 **실시간 토큰 동기화 (`UPDATE_AUTH_TOKEN`)**:
   - 서버로부터 `UPDATE_AUTH_TOKEN` 패킷 수신 시 `offscreen.ts`가 `chrome.storage.local`의 토큰을 즉시 최신화합니다.
4.3 **콘텐츠 스크립트 미주입 대응 (`scripting.executeScript` 자동 재시도)**:
   - `COLLECT_FULL_DOM` 등 탭 메시지 전송 시 `chrome.runtime.lastError`(수신자 부재)가 발생하면 콘텐츠 스크립트가 미주입된 탭이므로 즉시 실패 안내로 마무리하지 않고, `chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] })`로 주입 후 동일 명령을 1회 자동 재시도합니다.
   - `chrome://` 등 보호 페이지에서는 주입도 실패하므로 이 경우에만 "페이지 스크립트 주입 불가 (보호 페이지)" 안내를 반환합니다.
   - 재시도에서도 실패하면 기존처럼 "페이지 스크립트 미연결 (페이지 새로고침 후 재시도)"를 반환하여 사용자 조치를 유도합니다.

4.4 **서버 수신 패킷 처리 예외 가드** (백엔드 `ws.on("message")` 규정):
   - **Buffer → string 변환 필수**: `ws`의 `message` 이벤트 데이터는 기본적으로 `Buffer` 형태입니다. `JSON.parse`는 Buffer를 암시 변환해 동작하지만, `substring()` 등 문자열 API는 Buffer에 없어 `rawData.substring is not a function` 예외가 발생합니다. 핸들러 진입 직후 반드시 `typeof data === "string" ? data : data.toString()`으로 string을 보장한 뒤 사용합니다.
   - **빈 catch 금지**: 패킷 파싱/처리 예외를 `catch {}`로 조용히 삼키면 후속 처리(별칭 저장/ACK)가 조용히 중단되고 원인 추적이 불가능합니다. 최소한 `logServerSystem("WARN", ...)`으로 실패 사유를 기록하며 무중단은 유지합니다.
   - **로그 실패 예외 격리**: `logPluginComm()`/`logServerSystem()`은 내부에서 `appendFileSync`를 호출하므로 파일 쓰기 실패가 상위 소켓 통신·DB 처리 흐름을 중단하지 않도록 함수 내부에서 예외를 격리합니다. 호출부에서도 개별 try/catch 가드를 추가해 로그 실패가 별칭 저장·ACK 등 후속 액션을 막지 않게 합니다.
   - **원장 훅 우선 실행**: 수신 메시지는 액션 분기 처리보다 먼저 `plugin_messages` 원장에 기록되어, 이후 액션 처리에서 예외가 발생해도 수신 사실과 payload가 보존됩니다.

4.5 **미디어 번들 통신 규격 (xvideos 다운로드 매니저)**:
   - **`GET_STORAGE_LOCATION` → `STORAGE_LOCATION_RESPONSE`**: 다운로드 목록 생성 시 매니저(전용 팝업 창)가 저장 위치를 조회합니다. 서버는 `absDir`(절대 경로)/`relDir`(상대 경로, 예: `images/xvideos.com/normal`)을 응답합니다. `offscreen.ts`의 `storageLocationWaiter`(15초 타임아웃)가 응답을 해소합니다.
   - **`COLLECT_XVIDEOS_MEDIA`**: 콘텐츠 스크립트에 `.thumb-block` 파싱을 요청하고, 응답으로 `entries`(clickUrl/title/eid/메인·sfw 썸네일/preview URL) + `pageUrl`을 받습니다(R-00430 §5.4). `.thumb-block`이 없고 단일 영상 페이지(플레이어)로 판별되면 포스터 이미지 1종 + 타이틀 항목으로 폴백하며, 이 경우 `sfwUrl`/`previewUrl`는 빈 문자열입니다. 매니저 창은 활성 탭이 아니므로 `requestCollectXvideosMediaFromTab(tabId)`로 명시적 `tabId`를 전달하며, 콘텐츠 스크립트 미주입 탭은 `sendCommandToTab`이 content.js 주입 후 자동 재시도합니다.
   - **`FETCH_MEDIA_BUNDLE`**: 매니저 → 오프스크린으로 항목별 3자산 인출+전송을 요청합니다. 오프스크린 `handleFetchMediaBundle()`이 자산을 순차 `fetch`(`credentials: "omit"`, CORS 우회+오페라 VPN 경유)해 `arrayBufferToBase64()`로 변환하고, 실패 자산은 `data: ""`로 표시합니다. 이후 `CRAWL_IMAGE`(payloadType `json`)에 `assets` 배열 + `txtContent`를 담아 전송합니다.
   - **`FETCH_MEDIA_BUNDLE_PROGRESS`**: 오프스크린이 3자산 인출·전송 단계마다 매니저 창으로 진행률을 브로드캐스트합니다(`chrome.runtime.sendMessage`, 메인 인출 30 → 보조 55 → 프리뷰 80 → 서버 전송 95%). 매니저 `useXvideosDownloadManager`의 `chrome.runtime.onMessage` 리스너가 `bundleId`로 매칭해 항목별 프로그레스 바를 갱신하며, 완료/실패 시 훅이 100%로 확정합니다. 수신자 미연결 시 `.catch()` 가드로 무시합니다.
   - **`CRAWL_MEDIA_SAVED` ACK 대기**: 오프스크린이 번들 전송 후 `mediaAckWaiters`(Map: bundleId → 해소 함수)를 등록하고, 서버의 `CRAWL_MEDIA_SAVED`(bundleId/savedDir/savedFiles) 수신 시 해소합니다. 60초 타임아웃이 지나면 실패 처리합니다.
   - **예외 가드**: 번들 전송·ACK 대기 중 발생하는 예외는 `.catch()`로 삼켜 큐 진행을 중단하지 않으며, 실패 항목은 `failed` 상태로 마킹해 다음 항목 진행을 보장합니다.

---

## 5. 검증 체크리스트

- [ ] 웹소켓 연결이 `offscreen.ts` 단 하나에서만 단독 생성되는가?
- [ ] 사이드바 닫힘 시 크롬 포트 `onDisconnect`를 통해 `isSidebarOpen: false` 상태가 유실 없이 감지되는가?
- [ ] 사이드바 미오픈 시 `sendMessage().catch()` 가드가 작동하여 콘솔 예외가 무력화되는가?
- [ ] 서버에서 푸시된 `UPDATE_AUTH_TOKEN` 패킷이 로컬 스토리지로 정상 동기화되는가?
- [ ] 백엔드 `ws.on("message")`에서 수신 데이터를 string으로 변환한 뒤 처리하는가? (Buffer 그대로 `substring` 호출 금지)
- [ ] 패킷 처리 예외 시 빈 `catch {}`로 삼키지 않고 최소 `logServerSystem("WARN")`을 기록하는가?
- [ ] `logPluginComm()`/`logServerSystem()` 파일 기록 실패가 소켓 통신·별칭 저장·ACK 흐름을 중단시키지 않는가?
- [ ] `GET_STORAGE_LOCATION`→`STORAGE_LOCATION_RESPONSE` 조회(15초 타임아웃)와 `CRAWL_MEDIA_SAVED` ACK 대기(60초 타임아웃)가 정상 동작하는가?
- [ ] `FETCH_MEDIA_BUNDLE_PROGRESS` 브로드캐스트가 매니저 항목별 프로그레스 바를 30/55/80/95% 단계로 갱신하는가?
- [ ] `FETCH_MEDIA_BUNDLE` 인출 실패 자산이 `data: ""`로 표시되고, 예외가 큐 진행을 중단시키지 않고 `failed` 마킹으로 이어지는가?
