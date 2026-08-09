import { ReactNode, useState } from 'react';
import { TopBar } from './Navbar/TopBar.js';
import { BreadcrumbBar } from './Breadcrumb/BreadcrumbBar.js';
import { Sidebar } from './Sidebar/Sidebar.js';
import { ConnectionStatus, ActiveTab } from '../../types/index.js';

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
    <div className="min-h-screen bg-[#141A23] text-slate-100 flex flex-col font-sans ">
      <TopBar
        wsStatus={wsStatus}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        onRefresh={onRefresh}
      />
      <BreadcrumbBar
        activeTab={activeTab}
        onRefresh={onRefresh}
        onClearLogs={onClearLogs}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          clientCount={clientCount}
        />
        <main className="flex-1 p-6 overflow-y-auto bg-[#161C27]">
          {children}
        </main>
      </div>
    </div>
  );
}
