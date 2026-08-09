import { useState } from 'react';

interface ControlConsoleViewProps {
  targetId: string;
  setTargetId: (id: string) => void;
  onDispatch: (targetId: string, action: string, payloadStr: string) => void;
}

export function ControlConsoleView({
  targetId,
  setTargetId,
  onDispatch
}: ControlConsoleViewProps) {
  const [action, setAction] = useState('CRAWL_START');
  const [payload, setPayload] = useState('{"targetUrl": "https://example.com", "depth": 2}');

  return (
    <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 flex flex-col gap-6 max-w-4xl">
      <h2 className="text-lg font-bold text-green-400 border-b border-gray-800 pb-2">
        원격 수집 제어 지시 콘솔
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            타겟 기기 ID (ALL 입력 시 전체 브로드캐스트)
          </label>
          <input
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded p-2 text-sm w-full text-white font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            지시 작업 식별자 (Action)
          </label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded p-2 text-sm w-full text-white"
          >
            <option value="CRAWL_START">CRAWL_START (수집 개시)</option>
            <option value="CRAWL_STOP">CRAWL_STOP (수집 중단)</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => onDispatch(targetId, action, payload)}
            className="bg-green-600 hover:bg-green-700 font-bold text-sm p-2 w-full rounded transition h-[38px] text-white"
          >
            명령 릴레이 송출
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          매개변수 페이로드 바디 (JSON 포맷)
        </label>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={4}
          className="bg-gray-800 border border-gray-700 rounded p-2 text-sm w-full font-mono text-white"
        ></textarea>
      </div>
    </div>
  );
}
