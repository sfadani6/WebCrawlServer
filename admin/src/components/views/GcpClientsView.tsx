// admin/src/components/views/GcpClientsView.tsx

import { useState } from 'react';
import { Client, CrawlLog, NodeStatusFilter } from '../../types/index.js';
import { MetricCardsGroup } from '../metrics/MetricCardsGroup.js';
import { GcpClientsTable } from '../tables/GcpClientsTable.js';
import { DomDataModal } from '../modals/DomDataModal.js';
import { NodeConfigModal } from '../modals/NodeConfigModal.js';

/** GcpClientsView 컴포넌트 Props */
interface GcpClientsViewProps {
  /** 클라이언트 데이터 배열 */
  clients: Client[];
  /** 수집 로그 배열 */
  logs: CrawlLog[];
  /** 전체 로그 건수 */
  logCount: number;
  /** 콘솔 타깃 선택 콜백 */
  onSelectTarget: (clientId: string) => void;
  /** 클라이언트 추방 콜백 */
  onPurgeClient: (clientId: string) => void;
  /** 오프라인 노드 일괄 정화 콜백 */
  onPurgeOfflineClients: () => void;
  /**
   * 노드 환경설정 저장 콜백 (별칭만 저장)
   * @param clientId - 대상 노드 UUID
   * @param alias - 노드 한글 별칭
   */
  onSaveNodeConfig: (
    clientId: string,
    alias: string
  ) => Promise<boolean>;
}

/**
 * 수집 노드 관리 탭의 메인 뷰 컴포넌트입니다.
 * 메트릭 카드, 노드 출력 필터 스위치, 클라이언트 테이블,
 * DOM 데이터 모달, 노드 환경설정 모달을 통합 제공합니다.
 */
export function GcpClientsView({
  clients,
  logs,
  logCount,
  onSelectTarget,
  onPurgeClient,
  onPurgeOfflineClients,
  onSaveNodeConfig,
}: GcpClientsViewProps) {
  /** 노드 출력 필터 모드 상태 (기본: 온라인 노드만) */
  const [filterMode, setFilterMode] = useState<NodeStatusFilter>('ONLINE');

  /** DOM 데이터 모달 상태 */
  const [domModalState, setDomModalState] = useState<{
    isOpen: boolean;
    clientId: string;
    log: CrawlLog | null;
  }>({
    isOpen: false,
    clientId: '',
    log: null
  });

  /** 노드 환경설정 모달 상태 */
  const [configModalState, setConfigModalState] = useState<{
    isOpen: boolean;
    client: Client | null;
  }>({
    isOpen: false,
    client: null
  });

  // 필터 모드에 따른 클라이언트 목록 필터링
  const filteredClients = clients.filter((client) => {
    if (filterMode === 'ONLINE') return client.is_online;
    if (filterMode === 'OFFLINE') return !client.is_online;
    return true;
  });

  /** 온라인 노드 수 */
  const onlineCount = clients.filter((c) => c.is_online).length;
  /** 오프라인 노드 수 */
  const offlineCount = clients.filter((c) => !c.is_online).length;

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 메트릭 카드 그룹 */}
      <MetricCardsGroup clientCount={onlineCount} logCount={logCount} />

      {/* 노드 출력 필터 스위치 툴바 */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-[#202124] p-3 rounded border border-gray-800 gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            노드 출력 필터:
          </span>
          {/* 3단 필터 스위치 (온라인/전체/오프라인) */}
          <div className="inline-flex bg-[#111827] p-1 rounded border border-slate-700 gap-1 text-xs">
            <button
              onClick={() => setFilterMode('ONLINE')}
              className={`px-3 py-1 rounded font-semibold transition ${
                filterMode === 'ONLINE'
                  ? 'bg-[#1A73E8] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              온라인 노드만 보기 ({onlineCount})
            </button>
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 rounded font-semibold transition ${
                filterMode === 'ALL'
                  ? 'bg-[#1A73E8] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              전체 보기 ({clients.length})
            </button>
            <button
              onClick={() => setFilterMode('OFFLINE')}
              className={`px-3 py-1 rounded font-semibold transition ${
                filterMode === 'OFFLINE'
                  ? 'bg-[#1A73E8] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              오프라인 이력만 ({offlineCount})
            </button>
          </div>
        </div>

        {/* 오프라인 노드가 있을 때 일괄 정화 버튼 표시 */}
        {offlineCount > 0 && (
          <button
            onClick={onPurgeOfflineClients}
            className="flex items-center gap-1.5 bg-red-900/40 hover:bg-red-800 text-red-200 text-xs px-3 py-1.5 rounded transition border border-red-700/50 font-medium"
          >
            <span className="material-symbols-outlined text-xs">cleaning_services</span>
            <span>오프라인 노드 이력 정리 ({offlineCount})</span>
          </button>
        )}
      </div>

      {/* 수집 노드 테이블 (필터 적용) */}
      <GcpClientsTable
        clients={filteredClients}
        logs={logs}
        onSelectTarget={onSelectTarget}
        onPurgeClient={onPurgeClient}
        onOpenDomModal={(clientId, log) => setDomModalState({ isOpen: true, clientId, log })}
        onOpenConfigModal={(client) => setConfigModalState({ isOpen: true, client })}
      />

      {/* DOM 데이터 확인 모달 */}
      <DomDataModal
        isOpen={domModalState.isOpen}
        clientId={domModalState.clientId}
        log={domModalState.log}
        onClose={() => setDomModalState({ isOpen: false, clientId: '', log: null })}
      />

      {/* 노드 환경설정 모달 */}
      <NodeConfigModal
        isOpen={configModalState.isOpen}
        client={configModalState.client}
        onClose={() => setConfigModalState({ isOpen: false, client: null })}
        onSave={onSaveNodeConfig}
      />
    </div>
  );
}
