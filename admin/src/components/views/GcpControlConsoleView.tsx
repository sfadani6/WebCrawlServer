// admin/src/components/views/GcpControlConsoleView.tsx

import { useState } from 'react';
import { Client, WebSocketMessage } from '../../types/index.js';

/** GcpControlConsoleView 컴포넌트 Props */
interface GcpControlConsoleViewProps {
  /** 전송 타깃 노드 UUID (ALL 입력 시 전체 브로드캐스트) */
  targetId: string;
  /** 전송 타깃 노드 UUID 갱신 함수 */
  setTargetId: (id: string) => void;
  /** 웹소켓 명령 송출 콜백 (타깃 UUID, 액션, JSON 페이로드 문자열) */
  onDispatch: (targetId: string, action: string, payloadStr: string) => void;
  /** 관리 소켓으로 수신된 전체 노드 목록 (is_online 상태 포함) */
  clients: Client[];
  /** 관리 소켓으로 수신된 최근 이벤트 패킷 (전송 결과 확인용) */
  socketMessages: WebSocketMessage[];
}

/** 패킷 수신 이벤트 시각 포맷팅 헬퍼 (HH:MM:SS) */
function formatPacketTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('ko-KR', { hour12: false });
}

/** 수신 패킷 페이로드를 요약 텍스트로 직렬화하는 헬퍼 (최대 120자 제한) */
function summarizePayload(message: WebSocketMessage): string {
  try {
    const text = JSON.stringify(message.payload);
    return text.length > 120 ? `${text.substring(0, 120)}...` : text;
  } catch {
    return '(직렬화 불가 페이로드)';
  }
}

/**
 * 원격 수집 제어 지시 콘솔의 메인 뷰 컴포넌트입니다.
 * (1) 온라인 노드 고유 소켓 연결 상태 확인, (2) UUID 직접 입력 기반
 * 특정 플러그인 1:1 타깃 전송, (3) 전송 후 노드 응답 패킷 실시간 확인을 제공합니다.
 */
export function GcpControlConsoleView({
  targetId,
  setTargetId,
  onDispatch,
  clients,
  socketMessages
}: GcpControlConsoleViewProps) {
  /** 지시 액션 식별자 상태 (기본: 수집 개시) */
  const [action, setAction] = useState('CRAWL_START');
  /** 전송할 JSON 페이로드 바디 상태 */
  const [payload, setPayload] = useState('{"targetUrl": "https://example.com", "depth": 2}');

  /** 현재 실시간 접속 중인 온라인 노드 목록 (고유 소켓 보유) */
  const onlineClients = clients.filter((c) => c.is_online);

  /**
   * 클릭한 온라인 노드의 UUID를 타깃 입력 필드에 적용합니다.
   *
   * @param clientId - 적용할 노드 UUID
   */
  const applyTarget = (clientId: string) => {
    setTargetId(clientId);
  };

  /**
   * 클릭한 온라인 노드의 UUID를 클립보드로 복사합니다.
   *
   * @param clientId - 복사할 노드 UUID
   */
  const copyTarget = async (clientId: string) => {
    try {
      await navigator.clipboard.writeText(clientId);
    } catch {
      // 클립보드 API 미지원 환경은 조용히 무시 (수동 복사 유도)
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      {/* 원격 수집 제어 지시 콘솔 본체 */}
      <div className="bg-[#202124] p-5 rounded border border-gray-800 flex flex-col gap-5 shadow-sm">
        <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-2">
          <h2 className="text-lg font-bold text-green-400">Remote Control Console</h2>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded border ${
              onlineClients.length > 0
                ? 'text-emerald-300 border-emerald-700/50 bg-emerald-900/20'
                : 'text-red-300 border-red-700/50 bg-red-900/20'
            }`}
          >
            온라인 노드: {onlineClients.length}개
          </span>
        </div>

        {/* 전송 폼: 대상 UUID + 지시 액션 + 페이로드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide">
              대상 클라이언트 (UUID 직접 입력)
            </label>
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="client ID 또는 ALL 입력"
              className="w-full p-3 bg-[#111827] border border-slate-700 rounded text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 transition"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide">
              지시 액션
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full p-3 bg-[#111827] border border-slate-700 rounded text-sm text-slate-100 outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 transition"
            >
              <option value="CRAWL_START">CRAWL_START - 수집 시작</option>
              <option value="CRAWL_STOP">CRAWL_STOP - 수집 중지</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => onDispatch(targetId, action, payload)}
              className="w-full bg-[#1A73E8] hover:bg-[#185abc] text-white font-semibold text-sm p-3 rounded transition shadow-sm h-[54px]"
            >
              명령 전송
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide">
            JSON 페이로드
          </label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={6}
            placeholder='{"targetUrl": "https://example.com", "depth": 2}'
            className="w-full p-3 bg-[#111827] border border-slate-700 rounded text-sm text-slate-100 font-mono outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 transition"
          ></textarea>
        </div>
      </div>

      {/* 온라인 노드 고유 소켓 연결 확인 섹션 */}
      <div className="bg-[#202124] p-5 rounded border border-gray-800 flex flex-col gap-3 shadow-sm">
        <div className="flex justify-between items-center border-b border-gray-800 pb-2">
          <h3 className="text-sm font-bold text-slate-200">온라인 노드 연결 확인</h3>
          <span className="text-[11px] text-slate-500">고유 소켓 1:1 매핑 (clientId = 브라우저 프로필)</span>
        </div>

        {onlineClients.length === 0 ? (
          <div className="text-sm text-slate-400 bg-[#111827] border border-slate-800 rounded p-4">
            현재 온라인 노드가 없습니다. 플러그인(브라우저 확장)이 서버 {`http://localhost:9600/`}에 접속 중인지 확인해 주세요.
            플러그인 사이드바 하단 <span className="text-slate-200 font-mono text-xs">노드 ID</span> 또는
            디버깅 콘솔 <span className="text-slate-200 font-mono text-xs">status</span> 명령으로 고유 UUID를 조회할 수 있습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* 온라인 노드 목록 헤더 */}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] gap-2 px-3 text-[11px] text-slate-500 uppercase tracking-wide">
              <span>별칭</span>
              <span>고유 UUID (clientId)</span>
              <span className="w-16">사이드바</span>
              <span className="w-14 text-center">적용</span>
              <span className="w-14 text-center">복사</span>
            </div>
            {/* 온라인 노드 행 목록 */}
            {onlineClients.map((client) => (
              <div
                key={client.client_id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] gap-2 items-center bg-[#111827] border border-slate-800 rounded px-3 py-2"
              >
                <span className="text-sm text-slate-200 truncate">
                  {client.alias || '이름 미설정'}
                </span>
                <span className="text-xs text-slate-400 font-mono truncate" title={client.client_id}>
                  {client.client_id}
                </span>
                <span className="w-16">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      client.is_sidebar_open
                        ? 'text-blue-300 bg-blue-900/30 border border-blue-700/50'
                        : 'text-slate-400 bg-slate-800 border border-slate-700/50'
                    }`}
                  >
                    {client.is_sidebar_open ? '활성' : '백그라운드'}
                  </span>
                </span>
                <span className="w-14 text-center">
                  <button
                    onClick={() => applyTarget(client.client_id)}
                    className="text-[11px] font-semibold px-2 py-1 rounded text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white transition"
                  >
                    적용
                  </button>
                </span>
                <span className="w-14 text-center">
                  <button
                    onClick={() => copyTarget(client.client_id)}
                    className="text-[11px] font-semibold px-2 py-1 rounded text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white transition"
                  >
                    복사
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 연결 확인 방법 안내 캡션 */}
        <div className="text-[11px] text-slate-500 bg-[#111827] border border-slate-800 rounded p-3 leading-relaxed">
          <span className="text-slate-300 font-semibold">연결 확인 방법:</span>{' '}
          ① 플러그인은 <span className="font-mono">ws://localhost:9600?clientId=&lt;UUID&gt;&amp;clientType=plugin</span>으로
          프로필당 1개의 영구 고유 소켓을 보유합니다. ② 플러그인 사이드바 하단 노드 ID 또는 디버깅 콘솔{' '}
          <span className="font-mono">status</span> 명령으로 자기 UUID를 확인할 수 있습니다. ③ 서버{' '}
          <span className="font-mono">GET /api/db/clients?onlineOnly=true</span>로 온라인 노드만 조회할 수 있습니다.
        </div>
      </div>

      {/* 전송 결과 패킷 실시간 확인 섹션 */}
      <div className="bg-[#202124] p-5 rounded border border-gray-800 flex flex-col gap-3 shadow-sm">
        <div className="flex justify-between items-center border-b border-gray-800 pb-2">
          <h3 className="text-sm font-bold text-slate-200">전송 결과 (실시간 수신 패킷)</h3>
          <span className="text-[11px] text-slate-500">PONG_RESPONSE 수신 시 해당 노드 응답 확인</span>
        </div>

        {socketMessages.length === 0 ? (
          <div className="text-sm text-slate-400 bg-[#111827] border border-slate-800 rounded p-4">
            아직 수신된 패킷이 없습니다. 위 콘솔에서 명령을 전송하면 노드 응답이 이곳에 실시간 표시됩니다.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto bg-[#0d131f] border border-slate-800 rounded p-3">
            {socketMessages.slice(0, 40).map((message, index) => {
              const isPong = message.action === 'PONG_RESPONSE';
              return (
                <div
                  key={`${message.meta?.timestamp ?? index}-${index}`}
                  className={`flex flex-col gap-0.5 rounded px-3 py-1.5 text-xs border ${
                    isPong
                      ? 'bg-emerald-900/20 border-emerald-700/50 text-emerald-200'
                      : 'bg-[#111827] border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-500">
                      [{message.meta?.timestamp ? formatPacketTime(message.meta.timestamp) : '--:--:--'}]
                    </span>
                    <span className={`font-bold ${isPong ? 'text-emerald-300' : 'text-sky-300'}`}>
                      {message.action}
                    </span>
                    <span className="text-slate-500">sender:</span>
                    <span className="text-slate-400 truncate">{message.senderId}</span>
                    <span className="text-slate-500">target:</span>
                    <span className="text-slate-400">{message.targetId ?? 'SERVER'}</span>
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] truncate">
                    {summarizePayload(message)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
