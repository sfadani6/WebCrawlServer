// admin/src/components/tables/GcpClientsTable.tsx

import { Client, CrawlLog } from '../../types/index.js';

/** GcpClientsTable 컴포넌트 Props */
interface GcpClientsTableProps {
  /** 출력할 클라이언트 데이터 배열 */
  clients: Client[];
  /** 수집 로그 배열 (노드별 최신 수신 데이터 표시용) */
  logs: CrawlLog[];
  /** 콘솔 탭에서 사용할 타깃 노드 선택 콜백 */
  onSelectTarget: (clientId: string) => void;
  /** 클라이언트 차단 추방 콜백 */
  onPurgeClient: (clientId: string) => void;
  /** DOM 데이터 모달 열기 콜백 */
  onOpenDomModal: (clientId: string, log: CrawlLog) => void;
  /** 노드 환경설정 모달 열기 콜백 */
  onOpenConfigModal: (client: Client) => void;
}

/**
 * GCP 콘솔 스타일의 수집 노드 인스턴스 테이블 컴포넌트입니다.
 * 노드 한글 별칭, [환경설정 ⚙️] 모달 연결 버튼, 3대 실시간 상태 배지를 제공합니다.
 */
export function GcpClientsTable({
  clients,
  logs,
  onSelectTarget,
  onPurgeClient,
  onOpenDomModal,
  onOpenConfigModal
}: GcpClientsTableProps) {
  /**
   * 지정 클라이언트의 가장 최근 수집 로그를 검색합니다.
   *
   * @param clientId - 조회할 클라이언트 UUID
   * @returns 최근 로그 객체 또는 undefined
   */
  const getLatestLogForClient = (clientId: string): CrawlLog | undefined => {
    return logs.find((l) => l.client_id === clientId);
  };

  /**
   * 연결 시각 문자열 또는 타임스탬프를 로케일 형식으로 변환합니다.
   *
   * @param dateStr - ISO 문자열 또는 숫자 타임스탬프 문자열
   * @returns 로케일 날짜/시간 문자열
   */
  const formatConnectedDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    const parsedNum = Number(dateStr);
    const date = isNaN(parsedNum) ? new Date(dateStr) : new Date(parsedNum);
    return isNaN(date.getTime()) ? '알 수 없는 시각' : date.toLocaleString();
  };

  return (
    <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
      {/* 테이블 헤더 바 */}
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center bg-[#28292c]">
        <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
          Crawler Node Instances ({clients.length})
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#111827] text-slate-300 border-b border-slate-800 text-[11px] font-semibold">
              <th className="p-3 w-10 text-center">#</th>
              <th className="p-3">노드 별칭 / 고유 ID</th>
              <th className="p-3">클라이언트 타입</th>
              <th className="p-3">상태</th>
              <th className="p-3">수신 데이터 알림</th>
              <th className="p-3">최초 등록/연결 시간</th>
              <th className="p-3 text-right">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-gray-200 font-mono">
            {clients.map((client) => {
              const latestLog = getLatestLogForClient(client.client_id);
              const isOnline = !!client.is_online;
              const isSidebarOpen = !!client.is_sidebar_open;

              return (
                <tr key={client.client_id} className="hover:bg-[#2d2e31] transition">
                  {/* 노드 UUID 앞 4자리 축약 표시 */}
                  <td className="p-3 text-center text-slate-400">{client.client_id.slice(0, 4)}</td>

                  {/* 노드 한글 별칭 및 UUID + [환경설정 ⚙️] 버튼 */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        {/* 별칭 표시 (미지정 시 안내 문구) */}
                        <span className="font-bold text-slate-100 font-sans text-xs">
                          {client.alias || '별칭 미지정 노드'}
                        </span>
                        {/* UUID 전체 표시 */}
                        <span className="text-slate-500 font-mono text-[10px] break-all">
                          {client.client_id}
                        </span>
                      </div>
                      {/* 노드 환경설정 모달 열기 버튼 */}
                      <button
                        onClick={() => onOpenConfigModal(client)}
                        className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                        title="노드 환경설정"
                      >
                        <span className="material-symbols-outlined text-xs">settings</span>
                      </button>
                    </div>
                  </td>

                  {/* 클라이언트 타입 배지 */}
                  <td className="p-3">
                    <span className="bg-slate-800 text-slate-200 text-[10px] px-2 py-0.5 rounded border border-slate-700">
                      {client.client_type}
                    </span>
                  </td>

                  {/* 3대 실시간 노드 상태 배지 (오프라인 / 백그라운드 가동 / 사이드바 활성) */}
                  <td className="p-3 font-sans">
                    {isOnline ? (
                      isSidebarOpen ? (
                        // 온라인 + 사이드바 활성 상태 (파란색 배지)
                        <span className="inline-flex items-center gap-1.5 bg-blue-900/40 text-blue-300 text-[11px] px-2.5 py-1 rounded border border-blue-700/40 font-semibold shadow-sm">
                          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                          온라인 (사이드바 활성 🖥️)
                        </span>
                      ) : (
                        // 온라인 + 백그라운드 가동 상태 (초록색 배지)
                        <span className="inline-flex items-center gap-1.5 bg-emerald-900/40 text-emerald-300 text-[11px] px-2.5 py-1 rounded border border-emerald-700/40 font-semibold shadow-sm">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          온라인 (백그라운드 가동 🌙)
                        </span>
                      )
                    ) : (
                      // 연결 끊김 과거 이력 상태 (회색 배지)
                      <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-400 text-[11px] px-2.5 py-1 rounded border border-slate-700 font-medium">
                        <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                        연결 끊김 (과거 이력)
                      </span>
                    )}
                  </td>

                  {/* 수신 데이터 알림 버튼 (최신 로그 존재 시 활성화) */}
                  <td className="p-3 font-sans">
                    {latestLog ? (
                      <button
                        onClick={() => onOpenDomModal(client.client_id, latestLog)}
                        className="inline-flex items-center gap-1.5 bg-[#1A73E8] hover:bg-[#185abc] text-white text-[11px] font-semibold px-2.5 py-1 rounded transition shadow-sm cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">notifications_active</span>
                        수신받은 데이터 보기
                      </button>
                    ) : (
                      <span className="text-slate-500 text-[11px]">수신 데이터 없음</span>
                    )}
                  </td>

                  {/* 최초 등록/연결 시간 */}
                  <td className="p-3 text-slate-400 text-[12px]">
                    {formatConnectedDate(client.connected_at)}
                  </td>

                  {/* 작업 버튼 그룹 */}
                  <td className="p-3 text-right font-sans">
                    <div className="flex justify-end gap-2">
                      {/* 원격 지시 콘솔 타깃 선택 */}
                      <button
                        onClick={() => onSelectTarget(client.client_id)}
                        className="bg-gray-800 hover:bg-gray-700 text-xs px-2.5 py-0.5 rounded text-gray-200 transition border border-gray-700"
                      >
                        Select Target
                      </button>
                      {/* 영구 추방 버튼 */}
                      <button
                        onClick={() => onPurgeClient(client.client_id)}
                        className="bg-red-900/60 hover:bg-red-800 text-xs px-2.5 py-0.5 rounded text-red-200 transition border border-red-800"
                        title="DB에서 삭제 및 영구 추방"
                      >
                        Purge
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {clients.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm font-sans">
            출력 조건에 부합하는 수집 노드 인스턴스가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
