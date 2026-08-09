본 문서는 `WebCrawlServer` 관리자 대시보드(`admin/`)의 **[수집 노드 관리]** 화면에서 수집 노드들의 실시간 상태(`사이드바 활성` / `백그라운드 가동` / `오프라인`)를 시각적으로 세분화하여 표현하고, **노드 별칭(Alias) 설정 및 노드별 환경설정 모달(`NodeConfigModal`)**을 구현하기 위한 UI/UX 지침서입니다.

---

## 1. 개요 및 표현 목표

1.1 **개요**: 수집 노드별로 난해한 UUID 대신 직관적인 한글 별칭(`alias`)을 부여하고, 노드 옆의 **`[환경설정 ⚙️]`** 버튼을 통해 노드 전용 물리 저장 경로 및 담당 워커를 개별 설정할 수 있게 합니다.  
1.2 **표현 및 설정 목표**:
   - **노드 식별성 확보**: 노드 ID 옆에 한글 별칭(예: `오페라-개인-수집기-1`) 및 `[환경설정 ⚙️]` 버튼을 배치.
   - **노드 환경설정 모달 (`NodeConfigModal.tsx`)**:
     1. **노드 별칭 (Alias)** 수정.
     2. **노드 전용 물리 저장 경로 (`customStoragePath`)** 설정 (예: `E:\data\opera_node_1`).
     3. **담당 워커 (`assignedWorkerId`)** 지정 (`기본 수집 워커`, `페이스북 워커` 등).
   - **3대 노드 상태 배지 구분**:
     - `● 온라인 (사이드바 활성 🖥️)`: 실시간 소켓 가동 + 유저가 사이드바 UI를 사용 중인 상태.
     - `● 온라인 (백그라운드 가동 🌙)`: 실시간 소켓 가동 + 유저가 사이드바를 닫았으나 오프스크린 수집 엔진이 24시간 가동 중인 상태.
     - `○ 연결 끊김 (과거 이력)`: 오프라인 과거 DB 이력.

---

## 2. 노드 환경설정 모달 명세 (`NodeConfigModal.tsx`)

노드 ID 별로 한글 별칭, 전용 저장 경로, 담당 워커를 개별 설정하는 모달 컴포넌트 규정입니다.

```tsx
// admin/src/components/modals/NodeConfigModal.tsx

import { useState, useEffect } from 'react';
import { Client, WorkerRecord } from '../../types/index.js';

interface NodeConfigModalProps {
  isOpen: boolean;
  client: Client | null;
  workers: WorkerRecord[];
  onClose: () => void;
  onSave: (clientId: string, alias: string, assignedWorkerId: string, customStoragePath: string) => Promise<boolean>;
}

export function NodeConfigModal({ isOpen, client, workers, onClose, onSave }: NodeConfigModalProps) {
  if (!isOpen || !client) return null;

  const [alias, setAlias] = useState(client.alias || '');
  const [assignedWorkerId, setAssignedWorkerId] = useState(client.assigned_worker_id || 'default_worker');
  const [customStoragePath, setCustomStoragePath] = useState(client.custom_storage_path || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAlias(client.alias || '');
    setAssignedWorkerId(client.assigned_worker_id || 'default_worker');
    setCustomStoragePath(client.custom_storage_path || '');
  }, [client]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(client.client_id, alias, assignedWorkerId, customStoragePath);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 bg-[#111827] border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">settings</span>
            노드 환경설정 [{client.client_id.slice(0, 8)}]
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 text-xs font-sans">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">노드 한글 별칭 (Alias)</label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="예: 오페라-개인-수집기-1"
              className="w-full p-2.5 bg-[#0F172A] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#1A73E8]"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">담당 수집 워커 (Worker)</label>
            <select
              value={assignedWorkerId}
              onChange={(e) => setAssignedWorkerId(e.target.value)}
              className="w-full p-2.5 bg-[#0F172A] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#1A73E8]"
            >
              <option value="default_worker">기본 수집 워커 (Default Worker)</option>
              {workers.map((w) => (
                <option key={w.worker_id} value={w.worker_id}>
                  {w.worker_name} [{w.worker_id}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">노드 전용 물리 저장 경로 (선택)</label>
            <input
              value={customStoragePath}
              onChange={(e) => setCustomStoragePath(e.target.value)}
              placeholder="미입력 시 워커/기본 저장 경로 적용 (예: E:\data\opera_node_1)"
              className="w-full p-2.5 bg-[#0F172A] border border-slate-700 rounded text-slate-100 outline-none focus:border-[#1A73E8] font-mono text-[11px]"
            />
          </div>
        </div>

        <div className="px-6 py-3 bg-[#111827] border-t border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-200">
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-[#1A73E8] hover:bg-[#185abc] text-white rounded font-semibold"
          >
            {isSaving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 3. 노드 별칭 및 `[환경설정 ⚙️]` 버튼 테이블 레이아웃 (`GcpClientsTable.tsx`)

```tsx
// admin/src/components/tables/GcpClientsTable.tsx 일부

<td className="p-3">
  <div className="flex items-center gap-2">
    <div className="flex flex-col">
      <span className="font-semibold text-slate-100 font-sans text-xs">
        {client.alias || "별칭 미지정 노드"}
      </span>
      <span className="text-slate-500 font-mono text-[10px] break-all">
        {client.client_id}
      </span>
    </div>
    <button
      onClick={() => onOpenConfigModal(client)}
      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
      title="노드 환경설정"
    >
      <span className="material-symbols-outlined text-xs">settings</span>
    </button>
  </div>
</td>
```

---

## 4. 검증 체크리스트

- [ ] 노드 ID 표출 칸 옆에 한글 별칭과 `[환경설정 ⚙️]` 버튼이 깔끔하게 표시되는가?
- [ ] `[환경설정 ⚙️]` 클릭 시 모달이 정상 팝업되며 별칭, 담당 워커, 전용 저장 경로가 수정 저장되는가?
- [ ] 노드별 실시간 상태 배지(`사이드바 활성`, `백그라운드 가동`, `연결 끊김`)가 정상 표출되는가?
