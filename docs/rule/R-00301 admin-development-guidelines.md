# R-00301 docs/rule/R-00301 admin-development-guidelines.md

`WebCrawlServer` 관리자 UI 개발에 대한 종합적인 AI 지침 문서입니다. 본 문서는 Google Cloud Console 스타일을 기반으로 한 모듈화 아키텍처, 타입 시스템, 서비스 계층, 비즈니스 로직 훅, 레이아웃 컴포넌트, 뷰 컴포넌트 등 admin 개발의 모든 측면을 정의합니다.

## 적용 범위

- `admin/src/` 기반 관리자 대시보드 UI 및 기능 개발
- React + TypeScript + Vite 기반 admin 패키지
- Google Cloud Console 스타일 디자인 시스템 적용
- 모듈화 아키텍처 구현
- AI 기반 코드 생성 및 리팩토링 가이드

## 1. 관리자 UI 개발 원칙

### 1.1 코드 품질 우선 원칙
- **단일 책임 원칙**: 각 컴포넌트와 함수는 하나의 책임만 가져야 합니다.
- **매Serializable**: 모든 비즈니스 로직은 UI 컴포넌트에서 분리되어야 합니다.
- **타입 안전성**: TypeScript 타입 시스템을 완전히 활용하여 런타임 오류를 방지합니다.
- **ESM 표준**: 모든 코드는 ECMAScript Modules(import/export) 기반으로 작성합니다.

### 1.2 구조적 복잡성 관리
- 단일 파일에 모든 로직이 집중되는 것을 방지합니다.
- 200라인 이상인 파일은 반듯이 분할해야 합니다.
- 컴포넌트 재사용성을 최우선으로 고려합니다.

### 1.3 AI 기반 개발 가이드
- AI는 docs/decision/ 문서의 가이드를 엄격히 따라야 합니다.
- 기존 코드베이스의 패턴과 스타일을 유지해야 합니다.
- 새로운 아키텍처 변경은 반드시 ADR(Architecture Decision Record)으로 문서화해야 합니다.
- 관리자 UI/UX 디자인은 `docs/rule/R-00302 admin-ui-ux-guidelines.md`를 참고하여 구현합니다.

## 2. 아키텍처 가이드

### 2.1 계층화 구조

```
admin/src/
├── types/              # 전역 타입 정의 계층
├── services/           # 순수 통신 서비스 계층
├── hooks/              # 비즈니스 로직 훅 계층
├── components/        # UI 컴포넌트 계층
│   ├── layout/         # 레이아웃 컴포넌트
│   ├── metrics/        # 메트릭 컴포넌트
│   ├── tables/         # 데이터 테이블 컴포넌트
│   └── views/          # 비즈니스 뷰 컴포넌트
└── App.tsx            # 최상위 조율 엔트리
```

### 2.2 계층별 책임

| 계층 | 책임 | AI 개발 가이드 |
|------|------|----------------|
| types/ | 전역 타입, 인터페이스, 유니온 타입 정의 | 기존 타입 시스템 분석 후 확장 |
| services/ | REST API, WebSocket 통신 (순수 함수) | fetch, WebSocket만 사용, React 독립 |
| hooks/ | 비즈니스 로직, 상태 관리, 수명 주기 | useCallback, useMemo 적극 사용 |
| components/ | UI 렌더링, 사용자 상호작용 | props 기반으로만 동작 |
| App.tsx | 계층 통합, 데이터 흐름 조율 | 최소한의 로직만 포함 |

### 2.3 데이터 흐름

```
User Interaction → View Components → Hooks (Business Logic) → Services (API/WebSocket) → Server
                                             ↓
                                    State Management (useState, useReducer)
```

## 3. 타입 시스템

### 3.1 전역 타입 정의

`admin/src/types/index.ts`에 모든 전역 타입을 중앙 집중 관리합니다.

```typescript
// DTO (Data Transfer Objects)
export interface Client {
  client_id: string;
  client_type: string;
  connected_at: string;
}

export interface CrawlLog {
  id: number;
  client_id: string;
  log_message: string;
  timestamp: number;
}

// Communication Types
export interface WebSocketMessage<T = unknown> {
  senderId: string;
  targetId?: string | 'ALL';
  action: string;
  payload: T;
}

// Status Types
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED';
export type ActiveTab = 'clients' | 'console' | 'logs';
```

### 3.2 타입 안전성 원칙
- **`any` 사용 금지**: 모든 `any` 타입은 `unknown`으로 대체해야 합니다.
- **인터페이스 우선**: 타입 alias보다는 인터페이스를 우선 사용합니다.
- **제네릭 타입 활용**: 가능하면 제네릭 타입을 사용하여 유연성을 높이습니다.
- **타입 어서션**: 외부 라이브러리 반환 값에만 사용합니다.

### 3.3 AI 타입 생성 가이드
- @types/better-sqlite3 같은 라이브러리 타입 정의는 신뢰할 수 없습니다.
- 데이터베이스 query 결과는 항상 명시적인 타입 어서션을 적용합니다.
- API 응답 타입은 인터페이스로 엄격히 정의합니다.

## 4. 서비스 계층 (services/)

### 4.1 정의
순수 함수 형태로 작성된 통신 서비스 계층입니다. React 컴포넌트 수명 주기와 완전히 독립되어 있습니다.

### 4.2 apiService.ts

REST API 호출을 담당하는 순수 서비스 모듈입니다.

```typescript
// admin/src/services/apiService.ts
export async function fetchClientsApi(): Promise<Client[]> {
  const res = await fetch('/api/db/clients');
  const json = await res.json();
  return json.success ? json.data : [];
}

export async function purgeClientApi(clientId: string): Promise<boolean> {
  const res = await fetch(`/api/db/clients/${clientId}`, { method: 'DELETE' });
  const json = await res.json();
  return json.success;
}
```

### 4.3 socketService.ts

WebSocket 통신을 담당하는 순수 서비스 모듈입니다.

```typescript
// admin/src/services/socketService.ts
export function createAdminSocket(): WebSocket {
  const wsUrl = 'ws://localhost:9600?clientId=admin-main&clientType=admin';
  return new WebSocket(wsUrl);
}

export function sendSocketMessage(
  socket: WebSocket | null,
  targetId: string,
  action: string,
  payload: unknown
): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  
  const packet: WebSocketMessage = {
    senderId: 'admin-main',
    targetId,
    action,
    payload
  };
  socket.send(JSON.stringify(packet));
  return true;
}
```

### 4.4 AI 서비스 개발 가이드
- **React 독립**: React import를 사용하지 않아야 합니다.
- **순수 함수**: 모든 함수는 부수 효과가 없어야 합니다.
- **오류 처리**: try-catch 블록에서 오류를 상위 계층으로 전파합니다.
- **타입 추론**: 반환 타입을 명시적으로 정의합니다.

## 5. 비즈니스 로직 훅 (hooks/)

### 5.1 정의
React의 상태 및 수명 주기를 관리하는 커스텀 훅 계층입니다. 서비스 계층을 활용하여 비즈니스 로직을 구현합니다.

### 5.2 useAdminDbApi 훅

REST API 상태 관리 및 데이터베이스 액션을 담당합니다.

```typescript
// admin/src/hooks/useAdminDbApi.ts
import { fetchClientsApi, purgeClientApi } from '../services/apiService.js';

export function useAdminDbApi() {
  const [clients, setClients] = useState<Client[]>([]);
  
  const loadClients = useCallback(async () => {
    try {
      const data = await fetchClientsApi();
      setClients(data);
    } catch {
      // API 예외 처리
    }
  }, []);
  
  const executePurgeClient = useCallback(async (clientId: string) => {
    if (!confirm(`클라이언트 [${clientId}]를 강제 추방하시겠습니까?`)) return false;
    const success = await purgeClientApi(clientId);
    if (success) {
      await loadClients();
      return true;
    }
    return false;
  }, [loadClients]);
  
  return { clients, loadClients, executePurgeClient };
}
```

### 5.3 useAdminSocket 훅

WebSocket 통신 상태 및 실시간 패킷 중계를 담당합니다.

```typescript
// admin/src/hooks/useAdminSocket.ts
import { createAdminSocket, sendSocketMessage } from '../services/socketService.js';

export function useAdminSocket(setLogs: Dispatch<SetStateAction<CrawlLog[]>>) {
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const socket = createAdminSocket();
    wsRef.current = socket;
    
    socket.onopen = () => setWsStatus('CONNECTED');
    socket.onclose = () => setWsStatus('DISCONNECTED');
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.action === 'CRAWL_LOG') {
        setLogs(prev => [createLogFromMessage(message), ...prev]);
      }
    };
    
    return () => socket.close();
  }, [setLogs]);
  
  const dispatchCommand = useCallback((targetId: string, action: string, payloadStr: string) => {
    try {
      const parsedPayload = JSON.parse(payloadStr);
      return sendSocketMessage(wsRef.current, targetId, action, parsedPayload);
    } catch {
      return false;
    }
  }, []);
  
  return { wsStatus, dispatchCommand };
}
```

### 5.4 AI 훅 개발 가이드
- **서비스 연동**: 항상 services/ 계층의 함수를 사용합니다.
- **useCallback 사용**: 모든 콜백 함수는 useCallback으로 memoization합니다.
- **의존성 배열**: useEffect, useCallback의 의존성 배열을 정확히 정의합니다.
- **에러 처리**: 사용자 친화적인 오류 메시지를 표시합니다.

## 6. 레이아웃 컴포넌트 (components/layout/)

### 6.1 디렉토리 구조

```
components/layout/
├── Navbar/           # 상단 네비게이션
│   ├── ProjectSelector.tsx
│   ├── GlobalSearchBar.tsx
│   ├── HeaderTools.tsx
│   └── TopBar.tsx
├── Breadcrumb/      # 브레드크럼
│   └── BreadcrumbBar.tsx
├── Sidebar/         # 사이드바
│   └── Sidebar.tsx
└── GcpMainLayout.tsx # 메인 레이아웃
```

### 6.2 TopBar 컴포넌트

GCP 스타일 상단 네비게이션 툴바입니다.

```typescript
// admin/src/components/layout/Navbar/TopBar.tsx
interface TopBarProps {
  wsStatus: ConnectionStatus;
  onToggleSidebar: () => void;
  onRefresh: () => void;
}

export function TopBar({ wsStatus, onToggleSidebar, onRefresh }: TopBarProps) {
  return (
    <header className="h-12 bg-[#1a73e8] text-white flex items-center justify-between px-3">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="p-1.5 hover:bg-blue-700 rounded">
          ☰
        </button>
        <span className="bg-white text-[#1a73e8] font-black text-xs px-1.5 py-0.5 rounded">GCP</span>
        <span>WebCrawlServer</span>
        <ProjectSelector />
      </div>
      <GlobalSearchBar />
      <HeaderTools wsStatus={wsStatus} onRefresh={onRefresh} />
    </header>
  );
}
```

### 6.3 GcpMainLayout 컴포넌트

GCP 스타일 메인 레이아웃 프레임워크입니다.

```typescript
// admin/src/components/layout/GcpMainLayout.tsx
interface GcpMainLayoutProps {
  children: ReactNode;
  wsStatus: ConnectionStatus;
  clientCount: number;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onRefresh: () => void;
  onClearLogs: () => void;
}

export function GcpMainLayout({
  children,
  wsStatus,
  clientCount,
  activeTab,
  onSelectTab,
  onRefresh,
  onClearLogs
}: GcpMainLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  return (
    <div className="min-h-screen bg-[#18191c] text-gray-100 flex flex-col">
      <TopBar wsStatus={wsStatus} onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)} />
      <BreadcrumbBar activeTab={activeTab} onRefresh={onRefresh} onClearLogs={onClearLogs} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          clientCount={clientCount}
        />
        <main className="flex-1 p-5 overflow-y-auto bg-[#18191c]">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 6.4 AI 레이아웃 개발 가이드
- **GCP 스타일**: Google Cloud Console 디자인 시스템을 준수합니다.
- **색상 체계**: 정의된 색상 코드를 엄격히 사용합니다.
- **반응형 디자인**: 모든 컴포넌트는 모바일부터 데스크탑까지 지원해야 합니다.
- **접근성**: select-none, aria-label 등 접근성 속성을 적절히 사용합니다.

## 7. 메트릭 컴포넌트 (components/metrics/)

### 7.1 MetricCardItem

단일 메트릭 카드 컴포넌트입니다.

```typescript
// admin/src/components/metrics/MetricCardItem.tsx
interface MetricCardItemProps {
  title: string;
  value: string | number;
  subValue: string;
  valueColorClass?: string;
}

export function MetricCardItem({
  title,
  value,
  subValue,
  valueColorClass = 'text-white'
}: MetricCardItemProps) {
  return (
    <div className="bg-[#202124] border border-gray-800 rounded p-3 flex flex-col justify-between">
      <div className="text-[11px] font-medium text-gray-400">{title}</div>
      <div className="flex items-baseline justify-between mt-2">
        <div className={`text-2xl font-bold font-mono ${valueColorClass}`}>{value}</div>
        <div className="text-[10px] text-gray-400">{subValue}</div>
      </div>
    </div>
  );
}
```

### 7.2 MetricCardsGroup

4개의 메트릭 카드 그리드입니다.

```typescript
// admin/src/components/metrics/MetricCardsGroup.tsx
export function MetricCardsGroup({ clientCount, logCount }: MetricCardsGroupProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <MetricCardItem
        title="ACTIVE CRAWLER NODES"
        value={clientCount}
        subValue="● Online Status"
        valueColorClass="text-green-400"
      />
      <MetricCardItem
        title="TOTAL CRAWLED LOGS"
        value={logCount}
        subValue="Rows in SQLite"
        valueColorClass="text-yellow-400"
      />
      <MetricCardItem
        title="DATABASE JOURNAL MODE"
        value="WAL Mode"
        subValue="better-sqlite3"
        valueColorClass="text-blue-400"
      />
      <MetricCardItem
        title="NETWORK PORT BINDING"
        value="Port 9600"
        subValue="HTTP/WS Shared"
        valueColorClass="text-green-400"
      />
    </div>
  );
}
```

## 8. 테이블 컴포넌트 (components/tables/)

### 8.1 GcpClientsTable

GCP 스타일 데이터 테이블 컴포넌트입니다.

```typescript
// admin/src/components/tables/GcpClientsTable.tsx
interface GcpClientsTableProps {
  clients: Client[];
  onSelectTarget: (clientId: string) => void;
  onPurgeClient: (clientId: string) => void;
}

export function GcpClientsTable({
  clients,
  onSelectTarget,
  onPurgeClient
}: GcpClientsTableProps) {
  return (
    <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c]">
        <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
          Crawler Node Instances ({clients.length})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#28292c] text-gray-400 border-b border-gray-800">
              <th className="p-3 w-10 text-center">☐</th>
              <th className="p-3">NODE ID (UUID)</th>
              <th className="p-3">CLIENT TYPE</th>
              <th className="p-3">STATUS</th>
              <th className="p-3">CONNECTED AT</th>
              <th className="p-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-gray-200">
            {clients.map((client) => (
              <tr key={client.client_id} className="hover:bg-[#2d2e31] transition">
                <td className="p-3 text-center text-gray-500">☐</td>
                <td className="p-3 font-semibold text-blue-300">{client.client_id}</td>
                <td className="p-3">
                  <span className="bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded">
                    {client.client_type}
                  </span>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1.5 bg-green-950 text-green-300 text-[10px] px-2 py-0.5 rounded">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                    Ready / Active
                  </span>
                </td>
                <td className="p-3 text-gray-400 text-[11px]">
                  {new Date(parseInt(client.connected_at)).toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => onSelectTarget(client.client_id)}>
                      Select Target
                    </button>
                    <button onClick={() => onPurgeClient(client.client_id)}>
                      Purge
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## 9. 뷰 컴포넌트 (components/views/)

### 9.1 GcpClientsView

클라이언트 관리 뷰입니다.

```typescript
// admin/src/components/views/GcpClientsView.tsx
interface GcpClientsViewProps {
  clients: Client[];
  logCount: number;
  onSelectTarget: (clientId: string) => void;
  onPurgeClient: (clientId: string) => void;
}

export function GcpClientsView({
  clients,
  logCount,
  onSelectTarget,
  onPurgeClient
}: GcpClientsViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <MetricCardsGroup clientCount={clients.length} logCount={logCount} />
      <GcpClientsTable
        clients={clients}
        onSelectTarget={onSelectTarget}
        onPurgeClient={onPurgeClient}
      />
    </div>
  );
}
```

### 9.2 AI 뷰 개발 가이드
- **비즈니스 로직 분리**: 뷰 컴포넌트는 props를 통해 데이터를 받기만 합니다.
- **상태 관리**: 가능하면 부모 컴포넌트에서 상태를 관리합니다.
- **이벤트 핸들러**: 모든 사용자 상호작용은 props로 전달받은 콜백 함수를 호출합니다.
- **스타일 일관성**: GCP 스타일 디자인 시스템을 엄격히 따릅니다.

## 10. GCP 스타일 디자인 시스템

### 10.1 색상 체계

| 이름 | 코드 | 사용처 |
|------|------|--------|
| Primary Blue | #1a73e8 | 상단 툴바 배경 |
| Dark Background | #18191c | 메인 배경 |
| Card Background | #202124 | 카드, 사이드바, 테이블 행 |
| Sub Background | #28292c | 테이블 헤더, 브레드크럼 |
| Hover Background | #2d2e31 | 테이블 행 호버 |
| Green Status | #4caf50 | 연결 상태, 성공 |
| Red Status | #f44336 | 오프라인, 오류, 삭제 |
| Yellow Status | #f4b400 | 경고, 로그 |
| Blue Status | #4285f4 | 정보 |

### 10.2 타이포그래피

- **폰트**: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- **기본 크기**: 14px (root)
- **제목**: font-bold, tracking-tight
- **본문**: text-sm, text-gray-100
- **보조 텍스트**: text-xs, text-gray-400
- **코드**: font-mono, text-xs

### 10.3 간격 시스템

- **기본 패딩**: p-2, p-3, p-4, p-5
- **간격**: gap-1, gap-2. gap-3, gap-4
- **레이아웃**: min-h-screen, flex, flex-col, items-center, justify-between

## 11. App.tsx 최상위 엔트리

### 11.1 구조

```typescript
// admin/src/App.tsx
import { useState, useCallback } from 'react';
import { useAdminDbApi } from './hooks/useAdminDbApi.js';
import { useAdminSocket } from './hooks/useAdminSocket.js';
import { GcpMainLayout } from './components/layout/GcpMainLayout.js';
import { GcpClientsView } from './components/views/GcpClientsView.js';
import { GcpControlConsoleView } from './components/views/GcpControlConsoleView.js';
import { GcpCrawlLogsView } from './components/views/GcpCrawlLogsView.js';
import { ActiveTab } from './types/index.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('clients');
  const [targetId, setTargetId] = useState<string>('ALL');

  const { clients, logs, setLogs, loadClients, loadLogs, executeClearLogs, executePurgeClient } = useAdminDbApi();

  const handleConnect = useCallback(() => {
    loadClients();
    loadLogs();
  }, [loadClients, loadLogs]);

  const { wsStatus, dispatchCommand } = useAdminSocket(setLogs, handleConnect);

  const handleSelectTarget = (clientId: string) => {
    setTargetId(clientId);
    setActiveTab('console');
  };

  return (
    <GcpMainLayout
      wsStatus={wsStatus}
      clientCount={clients.length}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onRefresh={() => { loadClients(); loadLogs(); }}
      onClearLogs={executeClearLogs}
    >
      {activeTab === 'clients' && (
        <GcpClientsView
          clients={clients}
          logCount={logs.length}
          onSelectTarget={handleSelectTarget}
          onPurgeClient={executePurgeClient}
        />
      )}
      {activeTab === 'console' && (
        <GcpControlConsoleView
          targetId={targetId}
          setTargetId={setTargetId}
          onDispatch={dispatchCommand}
        />
      )}
      {activeTab === 'logs' && (
        <GcpCrawlLogsView logs={logs} onClearLogs={executeClearLogs} />
      )}
    </GcpMainLayout>
  );
}
```

### 11.2 AI App.tsx 개발 가이드
- **최소화 원칙**: App.tsx는 오직 계층을 조율하는 역할만 해야 합니다.
- **상태 관리**: 전역 상태는 훅으로 위임합니다.
- **라우팅**: tab 기반 라우팅을 사용합니다.
- **의존성 주입**: 모든 의존성은 props를 통해 주입됩니다.

## 12. 개발 워크플로우

### 12.1 새로운 기능 추가

1. **타입 정의**: types/index.ts에 필요한 인터페이스 추가
2. **서비스 계층**: services/에 순수 통신 함수 추가
3. **비즈니스 로직**: hooks/에 커스텀 훅 추가
4. **UI 컴포넌트**: components/에 컴포넌트 추가
5. **통합**: App.tsx에 조율 로직 추가

### 12.2 AI 기반 코드 리뷰 체크리스트

- [ ] ESM(import/export) 기준으로 작성됐나요?
- [ ] TypeScript 타입이 엄격히 정의됐나요?
- [ ] `any` 타입이 사용되지 않았나요?
- [ ] 계층화 구조가 준수됐나요?
- [ ] GCP 스타일 디자인 시스템이 적용됐나요?
- [ ] 컴포넌트 재사용성이 고려됐나요?
- [ ] 오류 처리가 적절히 갖고 있나요?
- [ ] 코드 주석이 한글로 작성됐나요?
- [ ] `select-none` 클래스가 텍스트가 포함된 요소에 사용되지 않았나요? (R-00302 3.4절, R-00106 5.1.1절 참고)
- [ ] 유효하지 않은 Tailwind 클래스가 사용되지 않았나요? (R-00106 5.1.2절 참고)

## 13. 테스트 가이드

### 13.1 단위 테스트

- **서비스 테스트**: apiService, socketService 함수 단위 테스트
- **훅 테스트**: useAdminDbApi, useAdminSocket 훅 테스트
- **컴포넌트 테스트**: 렌더링, 사용자 상호작용 테스트

### 13.2 통합 테스트

- **TypeScript 컴파일**: `npx tsc --project admin\tsconfig.json`
- **ESLint 검사**: `npm run lint`
- **빌드 테스트**: `npm run build --workspace=admin`

## 14. 문서화 가이드

### 14.1 CHANGELOG 기록

모든 중요한 변경사항은 `docs/CHANGELOG/`에 기록해야 합니다.

- 파일명: `YYYYMMDD-설명.md`
- 내용: 문제, 원인, 해결 방안, 변경 파일, 검증 결과
- 예시: `admin-gcp-style-full-refactoring-20260803090000.md`

### 14.2 ADR 작성

아키텍처 결정은 `docs/decision/`에 ADR로 기록해야 합니다.

- 파일명: `설명.md`
- 내용: 배경, 결정, 대안, 결과, 후속 작업
- 예시: `Admin Console google style.md`

## 15. FAQ

### Q: `any` 타입을 사용해야 할 때 어떻게 하나요?
A: `unknown`을 사용하고, 필요한 경우 타입 어서션을 적용합니다. 외부 라이브러리 반환 값에만 타입 어서션을 사용합니다.

### Q: 컴포넌트가 너무 커질 때 어떻게 하죠?
A: 단일 책임 원칙을 적용하여 작은 컴포넌트로 분할합니다. 200라인 이상은 반드시 분리해야 합니다.

### Q: AI가 생성한 코드를 리뷰할 때 어떤 점을 확인하나요?
A: 12.2절의 AI 기반 코드 리뷰 체크리스트를 참고하세요.

### Q: 새로운 라이브러리를 도입하고 싶을 때 어떻게 하죠?
A: 반드시 ADR을 작성하고, 타입 정의가 ESM 호환되는지 확인해야 합니다.

## 관련 문서

- R-00300 admin-guidelines.md: 관리자 기능 및 운영 UI 지침
- R-00100 architecture.md: 프로젝트 개요 및 시스템 구성
- R-00101 tech-stack.md: 기술 스택
- R-00102 structure.md: 폴더 구조 및 명명 규칙
- R-00106 coding.md: 코드 작성 규칙
- docs/decision/Admin Console google style.md: 6단계 리팩토링 가이드
- docs/decision/Admin Console.md: 초기 모듈화 아키텍처

## 문서 정보

- **Rule ID**: R-00301
- **분류**: 관리자 UI (R-003xx)
- **우선순위**: R-00300 다음
- **작성자**: Mistral Vibe
- **작성일**: 2026-08-03
- **버전**: 1.0.0
- **상태**: 활성
