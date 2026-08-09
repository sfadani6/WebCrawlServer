본 문서는 `WebCrawlServer` 백엔드 서버에서 연결된 수집 노드(플러그인 프로필)의 **노드 별칭(`alias`)**, **실시간 세션 상태(`is_online`, `isSidebarOpen`) 관리**, **노드별 환경설정 API**, 및 **온라인 전용 REST API 필터링 규격**을 정의하는 지침서입니다.

---

## 1. 개요 및 세션 관리 원칙

1.1 **개요**: 백엔드 서버(`server/src/index.ts`)는 단일 브라우저 프로필당 1개씩 연결되는 오프스크린 무중단 웹소켓을 식별하고, 각 노드의 한글 별칭(`alias`), 전담 워커(`assigned_worker_id`), 노드 전용 저장 경로(`custom_storage_path`), 및 사이드바 활성화 여부를 세부 관리합니다.  
1.2 **3대 세션 관리 원칙**:
   - **단일 세션 점유**: 동일한 `clientId`로 신규 웹소켓 접속 시 기존 세션을 정화(close code `4001`)하여 프로필당 1개 세션만 유지.
   - **노드 식별성 및 설정 보관**: 난해한 UUID 대신 직관적인 한글 별칭(`alias`) 및 노드 전용 저장 경로를 `clients` 테이블에 보관.
   - **온라인 전용 인출 지원**: REST API에서 `onlineOnly=true` 파라미터 수용 시 오프라인 DB 이력을 제외하고 현재 실제 연결된 노드만 반환.

---

## 2. `clients` 스키마 및 `ClientSession` 메타 명세

### 2.1 SQLite `clients` 테이블 개정 스키마 (`server/src/database.ts`)
```sql
CREATE TABLE IF NOT EXISTS clients (
  client_id TEXT PRIMARY KEY,           -- 노드 고유 UUID
  client_type TEXT NOT NULL,            -- "plugin" | "admin"
  alias TEXT,                           -- 노드 한글 별칭 (예: "오페라-개인-수집기-1")
  assigned_worker_id TEXT DEFAULT 'default_worker', -- 담당 워커 ID
  custom_storage_path TEXT,             -- 노드 전용 물리 저장 경로 (예: "E:\data\opera_node_1")
  connected_at TEXT NOT NULL
);
```

### 2.2 인메모리 `ClientSession` 구조체 (`server/src/index.ts`)
```typescript
// server/src/index.ts

export type ClientType = "plugin" | "admin";

export interface ClientSession {
  socket: WebSocket;
  clientId: string;
  clientType: ClientType;
  connectedAt: Date;
  alias?: string;               // 노드 한글 별칭
  assignedWorkerId?: string;    // 담당 워커 ID
  customStoragePath?: string;   // 노드 전용 저장 경로
  isSidebarOpen?: boolean;      // 사이드바 UI 활성화 여부
  lastSeen?: number;            // 마지막 패킷 통신 타임스탬프
}

export const activeClients = new Map<string, ClientSession>();
```

### 2.3 웹소켓 마운트 자동 등록 및 실시간 노드 상태 푸시

**마운트 자동 등록 (`upsertClient`)**: 노드 목록 표시가 `CRAWL_LOG` 수신 여부에 의존하면 수집 미실행 시 admin에 노드가 미등록되는 문제가 발생하므로, 웹소켓 `wss.on("connection")`에서 세션 등록 즉시 `database.ts`의 `upsertClient(clientId, clientType)`을 호출하여 `clients` 테이블에 자동 등록합니다.

```typescript
// server/src/database.ts
// 기존 CRAWL_LOG 수신부의 INSERT OR IGNORE를 대체하는 멱등 등록 구문
export async function upsertClient(clientId: string, clientType: string): Promise<void> {
  await db.run(
    `INSERT INTO clients (client_id, client_type, connected_at)
     VALUES (?, ?, ?)
     ON CONFLICT(client_id) DO UPDATE SET connected_at = excluded.connected_at`,
    [clientId, clientType, new Date().toISOString()],
  );
}
```

**실시간 노드 상태 푸시 (`CLIENTS_UPDATED`)**: admin 대시보드 온라인 노드 목록은 DB 기반이라 웹소켓 연결 상태와 무관하게 최초 1회 조회에 머무를 수 있습니다. 이를 해소하기 위해 서버는 아래 3가지 시점마다 `broadcastClientsChanged()`를 호출하여 활성 `admin` 소켓에 `CLIENTS_UPDATED` 패킷을 브로드캐스트합니다. admin은 이를 수신하면 `loadClients()`로 목록을 즉시 재조회합니다.

| 트리거 시점 | 동작 |
|---|---|
| 웹소켓 연결(마운트) | `upsertClient` 실행 후 `broadcastClientsChanged()` 호출 |
| 웹소켓 해제(close) | `activeClients.delete` 후 `broadcastClientsChanged()` 호출 |
| `CLIENT_STATUS_UPDATE` 수신 | 사이드바 상태 갱신 후 `broadcastClientsChanged()` 호출 |

```typescript
// server/src/index.ts
export function broadcastClientsChanged(): void {
  const changePacket: WebSocketMessage = {
    senderId: "server",
    targetId: "ALL",
    action: "CLIENTS_UPDATED",
    payloadType: "json",
    payload: { timestamp: Date.now() },
    meta: { timestamp: Date.now() },
  };
  activeClients.forEach((client) => {
    if (client.clientType === "admin" && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(changePacket));
    }
  });
}
```

---

## 3. 노드 환경설정 업데이트 REST API 규정 (`PUT /api/db/clients/:clientId/config`)

관리자 대시보드 모달에서 입력된 노드 별칭(`alias`), 담당 워커(`assignedWorkerId`), 노드 전용 저장 경로(`customStoragePath`)를 업데이트합니다.

```typescript
// server/src/index.ts

app.put("/api/db/clients/:clientId/config", (req, res) => {
  try {
    const { clientId } = req.params;
    const { alias, assignedWorkerId, customStoragePath } = req.body;

    // DB 업데이트 구문 단행
    updateClientConfig(clientId, alias, assignedWorkerId, customStoragePath);

    // 인메모리 세션 최신화
    const session = activeClients.get(clientId);
    if (session) {
      session.alias = alias;
      session.assignedWorkerId = assignedWorkerId;
      session.customStoragePath = customStoragePath;
    }

    logAdminActivity(
      "SUPER_ADMIN",
      "UPDATE_NODE_CONFIG",
      `노드 환경설정 변경 완료 [ID: ${clientId}] [별칭: ${alias}] [워커: ${assignedWorkerId}]`
    );

    res.json({ success: true, message: "노드 환경설정이 저장되었습니다." });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});
```

---

## 4. REST API 온라인 클라이언트 필터 규정 (`GET /api/db/clients`)

`onlineOnly` 쿼리 파라미터를 처리하여, 관리자 대시보드가 현재 실제 통신 중인 수집 노드만 필터링할 수 있도록 제공합니다.

```typescript
// server/src/index.ts

app.get("/api/db/clients", (req, res) => {
  try {
    const onlineOnly = req.query.onlineOnly === "true";
    const clients = getAllClients(); // SQLite DB 전체 목록 인출

    let result = clients.map((c) => {
      const session = activeClients.get(c.client_id);
      const isOnline = !!(
        session && session.socket.readyState === WebSocket.OPEN
      );
      return {
        ...c,
        is_online: isOnline,
        is_sidebar_open: isOnline ? !!session.isSidebarOpen : false,
      };
    });

    if (onlineOnly) {
      result = result.filter((c) => c.is_online);
    }

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});
```

---

## 5. 원격 토큰 푸시 브로드캐스트 라우팅 규정 (`UPDATE_AUTH_TOKEN`)

토큰 변경 발생 시 연결된 모든 수집 노드로 웹소켓 실시간 브로드캐스트를 송출합니다.

```typescript
export function broadcastUpdatedToken(tokenType: string, newToken: string): void {
  const tokenPacket = {
    senderId: "server",
    targetId: "ALL",
    action: "UPDATE_AUTH_TOKEN",
    payloadType: "json",
    payload: { tokenType, token: newToken },
    meta: { timestamp: Date.now() },
  };

  activeClients.forEach((client) => {
    if (
      client.clientType === "plugin" &&
      client.socket.readyState === WebSocket.OPEN
    ) {
      client.socket.send(JSON.stringify(tokenPacket));
    }
  });
}
```

---

## 6. 관리자 대시보드 노드별 고유 전송 절차 (온라인 확인 → UUID 지정 → 1:1 릴레이 → 응답 확인)

관리자는 대시보드 제어 콘솔(`/console`, `GcpControlConsoleView`)에서 **브라우저 플러그인마다 고유한 1:1 타깃 전송**을 수행합니다. 플러그인의 고유 소켓은 `clientId`(브라우저 프로필당 1개, `chrome.storage.local` 영속 UUID)와 1:1로 매핑되며, 서버는 동일 `clientId` 중복 접속을 `4001`로 정화합니다(`server/src/index.ts`).

### 6.1 고유 소켓 연결 확인 방법
- **플러그인 측**: 사이드바 하단 푸터의 `노드 ID` 또는 디버깅 콘솔 `status` 명령(`GET_SOCKET_STATUS`)으로 본인 UUID·연결 상태·포트를 조회.
- **관리자 측**: `GET /api/db/clients?onlineOnly=true`로 온라인 노드만 필터링. 대시보드 `/console`의 "온라인 노드 연결 확인" 섹션이 이 결과를 표시합니다.
- **소켓 URL 규칙**: `ws://localhost:9600?clientId=<UUID>&clientType=plugin` — `clientType=plugin`이 아니면 서버가 연결을 거부(`4000`).

### 6.2 노드별 1:1 타깃 전송 절차 (`GcpControlConsoleView`)
1. **온라인 노드 확인**: 콘솔의 "온라인 노드 연결 확인" 섹션에서 접속 중인 노드(별칭·고유 UUID·사이드바 활성 상태)를 확인. 온라인 노드가 없으면 빈 상태와 연결 확인 방법을 안내.
2. **UUID 지정**: 대상 노드 행의 `[적용]` 버튼 클릭 시 UUID가 "대상 클라이언트" 입력 필드에 채워집니다 (`[복사]` 버튼으로 클립보드 복사 가능). `ALL`을 입력하면 전체 브로드캐스트.
3. **전송**: 액션(예: `CRAWL_START`/`CRAWL_STOP`)과 JSON 페이로드를 작성 후 `명령 전송`. `useAdminSocket.dispatchCommand` → `socketService.sendSocketMessage(targetId, action, payload)`로 `clientId=admin-main&clientType=admin` 소켓이 패킷을 송출.
4. **서버 릴레이**: `server/src/index.ts`의 단일 타깃 릴레이(`message.targetId`가 `activeClients`에 존재하는 UUID)가 해당 플러그인 소켓에만 패킷을 중계.
5. **응답 확인**: 콘솔 하단 "전송 결과 (실시간 수신 패킷)" 영역이 관리 소켓 수신 패킷(`App.tsx`의 `socketMessages`)을 실시간 표시. `PONG_RESPONSE`(핑/타깃 전송 응답)는 성공 색상으로 강조되고 senderId(노드 UUID)·targetId·페이로드 요약을 함께 보여줍니다.

---

## 7. 검증 체크리스트

- [ ] `PUT /api/db/clients/:clientId/config` 호출 시 노드 별칭 및 전용 저장 경로가 DB 및 메모리에 즉시 반영되는가?
- [ ] `GET /api/db/clients?onlineOnly=true` 요청 시 오프라인 노드가 제외되고 실제 연결 노드만 반환되는가?
- [ ] 크롬 포트 연결 해제(`onDisconnect`) 시 `isSidebarOpen: false` 상태가 유실 없이 실시간 반영되는가?
- [ ] `/console`의 온라인 노드 목록에 `[적용]` 클릭 시 UUID가 타깃 입력 필드에 채워지는가?
- [ ] 특정 노드 UUID로 `PING_TEST` 전송 시 해당 노드만 `PONG_RESPONSE`를 반환하며 "전송 결과" 영역에 표시되는가?
