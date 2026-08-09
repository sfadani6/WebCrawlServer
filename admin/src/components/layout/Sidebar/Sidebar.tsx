// admin/src/components/layout/Sidebar/Sidebar.tsx

import { ActiveTab } from '../../../types/index.js';
import { NavLink } from 'react-router-dom';

/** 사이드바 컴포넌트 Props */
interface SidebarProps {
  /** 사이드바 접힘 여부 */
  isCollapsed: boolean;
  /** 사이드바 접기/펼치기 토글 콜백 */
  onToggleCollapse: () => void;
  /** 현재 활성화된 메인 탭 */
  activeTab: ActiveTab;
  /** 탭 선택 콜백 */
  onSelectTab: (tab: ActiveTab) => void;
  /** 수집 노드 클라이언트 수 (배지용) */
  clientCount: number;
}

/**
 * 좌측 네비게이션 사이드바 컴포넌트입니다.
 * 수집 노드 관리, 워커 & DB 매니저, 원격 지시 콘솔, 네트워크 모니터링, 수집 로그 탭을 제공합니다.
 * 접기/펼치기 기능으로 화면 공간을 효율적으로 활용합니다.
 * Material Symbols Outlined 아이콘 및 GCP 다크 테마를 준수합니다.
 */
export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  clientCount
}: SidebarProps) {
  return (
    <aside
      className={`bg-[#111827] border-r border-slate-800 flex flex-col justify-between transition-all duration-200 shadow-sm ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex flex-col py-4">

        {/* [1] 수집 노드 관리 탭 */}
        <NavLink
          to="/clients"
          onClick={() => onSelectTab('clients')}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
              isActive || activeTab === 'clients'
                ? 'bg-slate-800 text-[#1A73E8] border-l-4 border-[#1A73E8]'
                : 'text-slate-300 hover:bg-slate-900'
            }`
          }
        >
          <span className="material-symbols-outlined">dashboard</span>
          {!isCollapsed && (
            <div className="flex justify-between items-center w-full">
              <span>수집 노드 관리</span>
              <span className="bg-slate-900/70 text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-slate-800">
                {clientCount}
              </span>
            </div>
          )}
        </NavLink>

        {/* [2] 워커 관리 탭 */}
        <NavLink
          to="/workers"
          onClick={() => onSelectTab('workers')}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
              isActive || activeTab === 'workers'
                ? 'bg-slate-800 text-[#1A73E8] border-l-4 border-[#1A73E8]'
                : 'text-slate-300 hover:bg-slate-900'
            }`
          }
        >
          <span className="material-symbols-outlined">precision_manufacturing</span>
          {!isCollapsed && <span>워커 관리</span>}
        </NavLink>

        {/* [2-1] DB 관리 탭 */}
        <NavLink
          to="/db"
          onClick={() => onSelectTab('db')}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
              isActive || activeTab === 'db'
                ? 'bg-slate-800 text-[#1A73E8] border-l-4 border-[#1A73E8]'
                : 'text-slate-300 hover:bg-slate-900'
            }`
          }
        >
          <span className="material-symbols-outlined">storage</span>
          {!isCollapsed && <span>DB 관리</span>}
        </NavLink>

        {/* [3] 원격 제어 콘솔 탭 */}
        <NavLink
          to="/console"
          onClick={() => onSelectTab('console')}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
              isActive || activeTab === 'console'
                ? 'bg-slate-800 text-[#1A73E8] border-l-4 border-[#1A73E8]'
                : 'text-slate-300 hover:bg-slate-900'
            }`
          }
        >
          <span className="material-symbols-outlined">send_to_mobile</span>
          {!isCollapsed && <span>원격 제어 콘솔</span>}
        </NavLink>

        {/* [4] 네트워크 모니터링 탭 - 신규 */}
        <NavLink
          to="/network"
          onClick={() => onSelectTab('network')}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
              isActive || activeTab === 'network'
                ? 'bg-slate-800 text-[#1A73E8] border-l-4 border-[#1A73E8]'
                : 'text-slate-300 hover:bg-slate-900'
            }`
          }
        >
          <span className="material-symbols-outlined">cell_tower</span>
          {!isCollapsed && <span>네트워크 모니터링</span>}
        </NavLink>

        {/* [5] 실시간 수집 로그 탭 */}
        <NavLink
          to="/logs"
          onClick={() => onSelectTab('logs')}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
              isActive || activeTab === 'logs'
                ? 'bg-slate-800 text-[#1A73E8] border-l-4 border-[#1A73E8]'
                : 'text-slate-300 hover:bg-slate-900'
            }`
          }
        >
          <span className="material-symbols-outlined">article</span>
          {!isCollapsed && <span>실시간 수집 로그</span>}
        </NavLink>

        {/* [6] 파비콘 생성기 탭 */}
        <NavLink
          to="/favicon"
          onClick={() => onSelectTab('favicon')}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
              isActive || activeTab === 'favicon'
                ? 'bg-slate-800 text-[#1A73E8] border-l-4 border-[#1A73E8]'
                : 'text-slate-300 hover:bg-slate-900'
            }`
          }
        >
          <span className="material-symbols-outlined">palette</span>
          {!isCollapsed && <span>파비콘 생성기</span>}
        </NavLink>

        {/* [7] 환경 설정 탭 - 신규 */}
        <NavLink
          to="/settings"
          onClick={() => onSelectTab('settings')}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
              isActive || activeTab === 'settings'
                ? 'bg-slate-800 text-[#1A73E8] border-l-4 border-[#1A73E8]'
                : 'text-slate-300 hover:bg-slate-900'
            }`
          }
        >
          <span className="material-symbols-outlined">settings</span>
          {!isCollapsed && <span>환경 설정</span>}
        </NavLink>
      </div>

      {/* 사이드바 접기/펼치기 토글 버튼 */}
      <div className="border-t border-slate-800 p-3">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 p-2 text-slate-300 hover:bg-slate-900 rounded text-sm transition"
        >
          <span className="material-symbols-outlined text-base">
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
          {!isCollapsed && '사이드바 접기'}
        </button>
      </div>
    </aside>
  );
}
