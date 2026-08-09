import { Client } from '../../types/index.js';

interface ClientsViewProps {
  clients: Client[];
  onSelectTarget: (clientId: string) => void;
  onPurgeClient: (clientId: string) => void;
}

export function ClientsView({ clients, onSelectTarget, onPurgeClient }: ClientsViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-blue-400 border-b border-gray-800 pb-2">
        원격 수집 노드 세션 목록
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((c) => (
          <div key={c.client_id} className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex flex-col gap-3">
            <div className="text-xs text-gray-400 font-mono truncate">
              ID: {c.client_id}
            </div>
            <div className="flex justify-between text-xs text-gray-300">
              <span>유형: {c.client_type}</span>
              <span>접속: {new Date(parseInt(c.connected_at) || Date.now()).toLocaleTimeString()}</span>
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => onSelectTarget(c.client_id)}
                className="bg-gray-800 hover:bg-gray-700 text-xs px-2.5 py-1 rounded text-gray-200 transition"
              >
                콘솔 타겟 지정
              </button>
              <button
                onClick={() => onPurgeClient(c.client_id)}
                className="bg-red-900/60 hover:bg-red-800 text-xs px-2.5 py-1 rounded text-red-200 transition border border-red-800"
              >
                강제 추방
              </button>
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-20 text-sm">
            현재 활성화된 수집 노드가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
