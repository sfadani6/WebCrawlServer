import { MetricCardItem } from './MetricCardItem.js';

interface MetricCardsGroupProps {
  clientCount: number;
  logCount: number;
  /** 평균 네트워크 지연 시간 (ms) - 실시간 진단 데이터 */
  latency?: number;
  /** 초당 수신 패킷 수 - 실시간 통계 데이터 */
  pps?: number;
}

export function MetricCardsGroup({ 
  clientCount, 
  logCount, 
  latency = 0, 
  pps = 0 
}: MetricCardsGroupProps) {
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
        value={`Port ${process.env.SERVER_PORT || 9600}`}
        subValue="HTTP/WS Shared"
        valueColorClass="text-green-400"
      />
      <MetricCardItem
        title="NETWORK LATENCY"
        value={`${latency}ms`}
        subValue="Avg Response Time"
        valueColorClass="text-purple-400"
      />
      <MetricCardItem
        title="PACKETS PER SECOND"
        value={pps}
        subValue="Realtime PPS"
        valueColorClass="text-cyan-400"
      />
    </div>
  );
}
