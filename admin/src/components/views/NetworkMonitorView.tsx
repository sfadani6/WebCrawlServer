// admin/src/components/views/NetworkMonitorView.tsx

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  TerminalLogEntry,
  NetworkHealthResponse,
  PingTestResult,
  ApiSpeedTestResult,
  WebSocketMessage,
} from '../../types/index.js';
import { pushAuthTokenApi } from '../../services/apiService.js';

/** 네트워크 모니터링 뷰 Props */
interface NetworkMonitorViewProps {
  /** 웹소켓 메시지 전송 함수 */
  onDispatch: (targetId: string, action: string, payloadStr: string) => boolean;
  /** 활성 클라이언트 수 */
  clientCount: number;
  /** 관리 소켓에서 수신된 관리자 이벤트 */
  socketEvents?: WebSocketMessage[];
}

/** 진단/검증 명령 메타데이터 구조체 */
interface DiagCommandMeta {
  /** 서버로 전달되는 command 식별자 */
  command: string;
  /** 드롭다운/콘솔에 표시되는 짧은 명령명 */
  label: string;
  /** 해당 명령의 기능 설명 (드롭다운 라벨 및 콘솔 설명 출력에 사용) */
  description: string;
}

/** 패널 1 - netstat 분석 명령 레지스트리 */
const NETSTAT_COMMANDS: DiagCommandMeta[] = [
  { command: 'netstat_all', label: 'netstat -ano (전체)', description: '모든 TCP/UDP 연결과 소유 PID를 일괄 조회' },
  { command: 'netstat_9600', label: 'netstat 9600 포트', description: '9600 포트와 관련된 연결만 필터링해 조회' },
  { command: 'netstat_established', label: 'netstat ESTABLISHED', description: '현재 수립된(ESTABLISHED) 연결만 조회' },
  { command: 'netstat_listening', label: 'netstat LISTENING', description: '접속 대기 중(LISTENING)인 연결만 조회' },
];

/** 패널 2 - 서버 & OS 모니터 명령 레지스트리 */
const SERVER_OS_COMMANDS: DiagCommandMeta[] = [
  { command: 'cpu_usage', label: 'CPU 자원/코어', description: '서버 CPU 코어 구성과 사용량을 조회' },
  { command: 'memory_usage', label: 'RAM/Heap 자원', description: '서버 전체 메모리와 Node.js 힙 사용량을 조회' },
  { command: 'sqlite_wal', label: 'SQLite WAL 진단', description: 'data.db WAL 파일 존재 여부로 트랜잭션 상태 진단' },
];

/** 패널 3 - 플러그인 소켓 검증 명령 레지스트리 */
const SOCKET_VERIFY_COMMANDS: DiagCommandMeta[] = [
  { command: 'ping', label: '전체 노드 핑', description: '연결된 모든 수집 노드에 핑 패킷을 전송해 응답 확인' },
  { command: 'session_ping', label: '세션 1:1 핑', description: '특정 노드 ID를 입력받아 1:1 핑 테스트 수행' },
  { command: 'sidebar_status', label: '사이드바 활성 노드', description: '실시간 연결 노드 중 사이드바/백그라운드 상태를 구분 조회' },
  { command: 'background_nodes', label: '백그라운드 노드', description: '백그라운드(사이드바 미표시) 노드 정보를 수집' },
  { command: 'stress_ping', label: '연속 스트레스 테스트', description: '5회 연속 핑을 전송해 소켓 안정성을 스트레스 테스트' },
  { command: 'socket_rate_limit', label: '소켓 폭주 제한', description: '압력 패킷 4회 전송으로 소켓 속도 제한 동작을 검증' },
  { command: 'token_push', label: '토큰 실시간 푸시', description: '토큰 종류/값을 입력받아 수집 노드에 실시간 푸시' },
  { command: 'custom_packet', label: '1:1 커스텀 패킷', description: '대상/액션/JSON 페이로드를 지정해 커스텀 패킷 전송' },
  { command: 'show_alert', label: '원격 경고 모달', description: '메시지를 입력받아 수집 노드에 원격 경고 모달 표시' },
  { command: 'cleanup_dead_sockets', label: '데드 소켓 정화', description: '비정상 상태의 소켓 세션을 강제 종료하고 정리' },
  { command: 'node_sockets', label: 'Node 소켓 목록', description: '가동 중인 모든 node.exe가 점유한 소켓/포트 목록 일괄 출력' },
  { command: 'system_listen_ports', label: '시스템 Listen 포트', description: '컴퓨터 전체에서 접속 대기 중(LISTEN)인 포트 및 PID 스캔' },
];

/** 패널 4 - 범용 네트워크 검증 명령 레지스트리 */
const NETWORK_VERIFY_COMMANDS: DiagCommandMeta[] = [
  { command: 'health', label: '서버 헬스체크', description: '서버 포트/가동 시간/메모리 등 상태를 종합 조회' },
  { command: 'api', label: 'API 응답속도 진단', description: '주요 REST API 3종의 응답 시간을 측정' },
  { command: 'host_interfaces', label: '호스트 IP/카드', description: '서버의 네트워크 인터페이스(IP/카드) 정보를 조회' },
  { command: 'external_connectivity', label: '외부 망 연결성', description: '외부 URL(example.com) 연결 성공 여부를 확인' },
  { command: 'dns_lookup', label: 'DNS 해석 지연', description: '도메인 DNS 해석 결과와 소요 시간을 측정' },
  { command: 'port_scan', label: '포트 바인딩 스캔', description: '현재 LISTEN 상태인 포트 바인딩을 스캔' },
  { command: 'avg_rtt', label: '평균 RTT 지표', description: '수신된 PONG 이벤트로 평균/최소/최대 RTT를 산출' },
  { command: 'http_cors', label: 'HTTP/CORS 진단', description: '외부 HTTP 요청의 응답과 CORS 상태를 확인' },
  { command: 'disk_io', label: '디스크 I/O 속도', description: '임시 파일 쓰기/읽기 시간으로 디스크 I/O 속도를 측정' },
  { command: 'diagnostic_report', label: '진단 리포트', description: '서버 종합 상태(가동 시간/포트/메모리/로그) 리포트' },
];

/**
 * 전체 명령 레지스트리에서 command 식별자로 메타데이터를 조회합니다.
 *
 * @param action - command 식별자
 * @returns 해당 명령 메타데이터 (미발견 시 undefined)
 */
function findCommandMeta(action: string): DiagCommandMeta | undefined {
  return [
    ...NETSTAT_COMMANDS,
    ...SERVER_OS_COMMANDS,
    ...SOCKET_VERIFY_COMMANDS,
    ...NETWORK_VERIFY_COMMANDS,
  ].find((meta) => meta.command === action);
}

/**
 * 웹소켓 이벤트의 고유 키를 생성합니다.
 * 같은 송신자·액션·타임스탬프는 동일 이벤트로 취급하여 이벤트 소거 시 필터링 기준으로 사용합니다.
 */
function buildEventKey(event: WebSocketMessage): string {
  return `${event.senderId}-${event.action}-${event.meta?.timestamp || 0}`;
}

/**
 * 네트워크 모니터링 뷰 컴포넌트입니다.
 * 백엔드 서버, 수집 노드 간의 실시간 네트워크 상태 진단, Ping/Pong 테스트, REST API 헬스체크,
 * 터미널 스타일 CLI 콘솔을 제공합니다.
 */
export function NetworkMonitorView({ onDispatch, clientCount, socketEvents }: NetworkMonitorViewProps) {
  /** 터미널 콘솔 로그 엔트리 배열 상태 */
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);
  
  /** 명령어 입력값 상태 */
  const [commandInput, setCommandInput] = useState('');
  
  /** 자동 스크롤 여부 상태 */
  const [autoScroll, setAutoScroll] = useState(true);
  
  /** 현재 실행 중인 진단 명령 이름 (실행 중이 아니면 null) — 버튼 비활성 및 실행 표시에 사용 */
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  
  /** 진단 응답 최대 표시 문자 수 (초과 시 생략 표기) */
  const MAX_OUTPUT_CHARS = 4000;
  
  /** 콘솔 출력창 DOM 참조 */
  const consoleOutputRef = useRef<HTMLDivElement>(null);

  /** 터미널 콘솔 출력창 높이(px) — 상단 테두리 드래그로 사용자가 조절 */
  const [consoleHeight, setConsoleHeight] = useState(320);
  
  /** 콘솔 높이 드래그 시작 시점 정보 (시작 Y 좌표와 시작 높이) */
  const consoleDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  
  /** 소거된(숨겨진) 웹소켓 이벤트 키 집합 — 표시 목록에서 제외 */
  const [hiddenEventKeys, setHiddenEventKeys] = useState<Set<string>>(new Set());

  /** 콘솔 리사이즈 바 드래그 시작 핸들러 */
  const handleConsoleResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    consoleDragRef.current = { startY: e.clientY, startHeight: consoleHeight };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [consoleHeight]);

  /** 콘솔 리사이즈 바 드래그 이동 핸들러 — 위로 당기면 커지고, 화면 높이를 넘지 않는 범위로 제한합니다. */
  const handleConsoleResizeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = consoleDragRef.current;
    if (!drag) return;
    const maxHeight = Math.max(200, window.innerHeight - 100);
    const next = drag.startHeight + (drag.startY - e.clientY);
    setConsoleHeight(Math.min(maxHeight, Math.max(160, next)));
  }, []);

  /** 콘솔 리사이즈 바 드래그 종료 핸들러 */
  const handleConsoleResizeEnd = useCallback(() => {
    consoleDragRef.current = null;
  }, []);

  /** 고유 로그 ID 생성기 */
  const generateLogId = useCallback(() => {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }, []);
  
  /** 터미널에 로그 추가 헬퍼 함수 */
  const addTerminalLog = useCallback((
    text: string,
    type: TerminalLogEntry['type'] = 'info'
  ) => {
    const newLog: TerminalLogEntry = {
      id: generateLogId(),
      timestamp: new Date().toISOString(),
      type,
      text,
    };
    setTerminalLogs((prev) => [...prev, newLog]);
  }, [generateLogId]);

  /** 최근 웹소켓 이벤트 목록을 소거합니다. 이후 도착하는 새 이벤트는 다시 표시됩니다. */
  const handleClearSocketEvents = useCallback(() => {
    if (!socketEvents || socketEvents.length === 0) {
      addTerminalLog('소거할 웹소켓 이벤트가 없습니다.', 'warning');
      return;
    }
    setHiddenEventKeys((prev) => {
      const next = new Set(prev);
      socketEvents.forEach((event) => next.add(buildEventKey(event)));
      return next;
    });
    addTerminalLog(`웹소켓 이벤트 ${socketEvents.length}개를 소거했습니다.`, 'success');
  }, [socketEvents, addTerminalLog]);
  
  /** 터미널 콘솔 자동 스크롤 */
  useEffect(() => {
    if (autoScroll && consoleOutputRef.current) {
      const element = consoleOutputRef.current;
      const scrollBehavior = element.style.scrollBehavior;
      element.style.scrollBehavior = 'auto';
      element.scrollTop = element.scrollHeight;
      element.style.scrollBehavior = scrollBehavior;
    }
  }, [terminalLogs, autoScroll]);
  
  /** 명령어 실행 핸들러 */
  const executeCommand = useCallback((command: string) => {
    if (!command.trim()) return;
    
    addTerminalLog(`> ${command}`, 'cmd');
    
    // 명령어 파싱
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    // help 명령어
    if (cmd === 'help') {
      addTerminalLog('사용 가능한 명령어:', 'info');
      addTerminalLog('  help             - 이 도움말 표시', 'info');
      addTerminalLog('  health           - 서버 헬스체크 실행', 'info');
      addTerminalLog('  ping             - 모든 노드에 핑 테스트 실행', 'info');
      addTerminalLog('  ping <id>        - 특정 노드에 핑 테스트 실행', 'info');
      addTerminalLog('  api              - REST API 속도 진단', 'info');
      addTerminalLog('  sessions         - 활성 세션 수 표시', 'info');
      addTerminalLog('  avg_rtt          - 최근 PONG 응답으로 평균 RTT 계산', 'info');
      addTerminalLog('  clear            - 콘솔 내용 비우기', 'info');
      return;
    }
    
    // clear 명령어
    if (cmd === 'clear') {
      setTerminalLogs([]);
      addTerminalLog('콘솔이 비워졌습니다.', 'success');
      return;
    }
    
    // health 명령어
    if (cmd === 'health') {
      executeHealthCheck();
      return;
    }
    
    // ping 명령어
    if (cmd === 'ping') {
      if (args.length === 0) {
        executePingAll();
      } else {
        executePingTest(args[0]);
      }
      return;
    }
    
    // api 명령어
    if (cmd === 'api') {
      executeApiSpeedTest();
      return;
    }
    
    // sessions 명령어
    if (cmd === 'sessions') {
      addTerminalLog(`활성 세션 수: ${clientCount}개`, 'success');
      return;
    }
    
    // 알 수 없는 명령어
    addTerminalLog(`알 수 없는 명령어: ${cmd}. 'help'를 입력하여 도움말을 확인하세요.`, 'error');
  }, [addTerminalLog, clientCount]);
  
  /** 서버 헬스체크 실행 */
  const executeHealthCheck = useCallback(async () => {
    addTerminalLog('서버 헬스체크를 실행합니다...', 'info');
    
    try {
      const startTime = Date.now();
      const response = await fetch('/api/admin/network/health');
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (response.ok) {
        const data: { success: boolean; data: NetworkHealthResponse } = await response.json();
        if (data.success) {
          const health = data.data;
          addTerminalLog(`[서버 헬스체크 성공] 포트: ${health.port}, 바인딩: ${health.portBound ? '정상' : '비정상'}`, 'success');
          addTerminalLog(`  업타임: ${health.uptime ? '정상' : '비정상'}, 시작 시각: ${new Date(health.startedAt).toLocaleTimeString()}`, 'success');
          addTerminalLog(`  WAL 모드: ${health.walModeEnabled ? '활성' : '비활성'}, 메모리: ${health.memoryUsage}MB`, 'success');
          addTerminalLog(`  응답 시간: ${responseTime}ms`, 'success');
        } else {
          addTerminalLog(`서버 헬스체크 실패: ${data.message || '알 수 없는 오류'}`, 'error');
        }
      } else {
        addTerminalLog(`서버 헬스체크 실패: HTTP ${response.status}`, 'error');
      }
    } catch (error) {
      addTerminalLog(`서버 헬스체크 중 오류 발생: ${error}`, 'error');
    }
  }, [addTerminalLog]);
  
  /** 모든 노드 핑 테스트 실행 */
  const executePingAll = useCallback(() => {
    addTerminalLog(`모든 노드(${clientCount}개)에 핑 테스트를 실행합니다...`, 'info');
    
    const targetId = 'ALL';
    const success = onDispatch(targetId, 'PING_TEST', JSON.stringify({ timestamp: Date.now() }));
    
    if (success) {
      addTerminalLog('핑 테스트 패킷 전송 성공. 응답을 대기 중...', 'success');
    } else {
      addTerminalLog('핑 테스트 패킷 전송 실패: 소켓 연결 상태를 확인하세요.', 'error');
    }
  }, [addTerminalLog, clientCount, onDispatch]);
  
  /** 특정 노드 핑 테스트 실행 */
  const executePingTest = useCallback((targetId: string) => {
    addTerminalLog(`노드 [${targetId}]에 핑 테스트를 실행합니다...`, 'info');
    
    const success = onDispatch(targetId, 'PING_TEST', JSON.stringify({ timestamp: Date.now() }));
    
    if (success) {
      addTerminalLog(`핑 테스트 패킷 전송 성공. 응답을 대기 중...`, 'info');
    } else {
      addTerminalLog(`핑 테스트 패킷 전송 실패: 노드 [${targetId}]가 연결되어 있지 않습니다.`, 'error');
    }
  }, [addTerminalLog, onDispatch]);

  /** 특정 세션에 대한 1:1 핑 테스트 실행 (대상 ID를 사용자 입력으로 받음) */
  const executeSessionPing = useCallback(() => {
    const target = window.prompt('1:1 핑 대상 노드 ID(클라이언트 UUID)를 입력하세요.');
    if (!target) {
      addTerminalLog('대상 ID 입력이 취소되었습니다.', 'warning');
      return;
    }
    executePingTest(target);
  }, [addTerminalLog, executePingTest]);
  
  /** REST API 속도 진단 실행 */
  const executeApiSpeedTest = useCallback(async () => {
    addTerminalLog('REST API 속도 진단을 실행합니다...', 'info');
    
    const endpoints = [
      '/api/db/clients',
      '/api/db/logs',
      '/api/admin/workers',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await fetch(endpoint);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (response.ok) {
          addTerminalLog(`[API 속도 진단] ${endpoint}: ${responseTime}ms (성공)`, 'success');
        } else {
          addTerminalLog(`[API 속도 진단] ${endpoint}: HTTP ${response.status} (실패)`, 'error');
        }
      } catch (error) {
        addTerminalLog(`[API 속도 진단] ${endpoint}: 오류 발생 - ${error}`, 'error');
      }
    }
  }, [addTerminalLog]);

  /** 사이드바 활성 노드 상태 조회 */
  const executeSidebarStatusCheck = useCallback(async () => {
    addTerminalLog('사이드바 활성 노드 상태를 조회합니다...', 'info');

    try {
      const response = await fetch('/api/db/clients?onlineOnly=true');
      const data = await response.json();

      if (response.ok && data.success) {
        const clients = Array.isArray(data.data) ? data.data : [];
        const opened = clients.filter((client) => client.is_sidebar_open);
        const hidden = clients.filter((client) => !client.is_sidebar_open);

        addTerminalLog(`실시간 연결 노드: ${clients.length}개`, 'success');
        addTerminalLog(`  활성 사이드바: ${opened.length}개`, 'success');
        addTerminalLog(`  백그라운드 상태: ${hidden.length}개`, 'success');
        opened.slice(0, 10).forEach((client) => {
          addTerminalLog(`  [OPEN] ${client.client_id}${client.alias ? ` (${client.alias})` : ''}`, 'info');
        });
        hidden.slice(0, 10).forEach((client) => {
          addTerminalLog(`  [BACKGROUND] ${client.client_id}${client.alias ? ` (${client.alias})` : ''}`, 'info');
        });
      } else {
        addTerminalLog(`사이드바 상태 조회 실패: ${data.message || response.statusText}`, 'error');
      }
    } catch (error) {
      addTerminalLog(`사이드바 상태 조회 중 오류 발생: ${error}`, 'error');
    }
  }, [addTerminalLog]);

  /** 백그라운드 노드 정보를 수집합니다. */
  const executeBackgroundNodeInfo = useCallback(async () => {
    addTerminalLog('백그라운드 노드 정보를 수집합니다...', 'info');
    await executeSidebarStatusCheck();
  }, [executeSidebarStatusCheck]);

  /** 연속 스트레스 핑 테스트 실행 */
  const executeStressPing = useCallback(() => {
    addTerminalLog('연속 스트레스 핑 테스트를 시작합니다...', 'info');
    const iterations = 5;

    for (let i = 0; i < iterations; i += 1) {
      setTimeout(() => {
        const success = onDispatch(
          'ALL',
          'PING_TEST',
          JSON.stringify({ timestamp: Date.now(), iteration: i + 1 }),
        );
        if (success) {
          addTerminalLog(`스트레스 핑 #${i + 1} 전송 완료`, 'success');
        } else {
          addTerminalLog(`스트레스 핑 #${i + 1} 전송 실패`, 'error');
        }
      }, i * 300);
    }
  }, [addTerminalLog, onDispatch]);

  /** 소켓 rate limit 검증 요청 */
  const executeSocketRateLimit = useCallback(() => {
    addTerminalLog('소켓 속도 제한 검증을 위한 펄스를 전송합니다...', 'info');
    for (let i = 0; i < 4; i += 1) {
      const success = onDispatch(
        'ALL',
        'PING_TEST',
        JSON.stringify({ timestamp: Date.now(), pressureTest: true, index: i + 1 }),
      );
      addTerminalLog(
        `소켓 압력 테스트 패킷 #${i + 1} ${success ? '전송 완료' : '전송 실패'}`,
        success ? 'success' : 'error',
      );
    }
  }, [addTerminalLog, onDispatch]);

  /** 실시간 토큰 푸시 실행 */
  const executeTokenPush = useCallback(async () => {
    const tokenType = window.prompt('푸시할 토큰 유형을 입력하세요 (예: githubToken)');
    if (!tokenType) {
      addTerminalLog('토큰 유형 입력이 취소되었습니다.', 'warning');
      return;
    }
    const token = window.prompt('푸시할 토큰 값을 입력하세요.');
    if (!token) {
      addTerminalLog('토큰 값 입력이 취소되었습니다.', 'warning');
      return;
    }

    addTerminalLog('실시간 토큰 푸시를 요청합니다...', 'info');
    const success = await pushAuthTokenApi(tokenType, token);

    if (success) {
      addTerminalLog('실시간 토큰 푸시 요청이 백엔드로 전송되었습니다.', 'success');
    } else {
      addTerminalLog('실시간 토큰 푸시 실패: 백엔드 응답을 확인하세요.', 'error');
    }
  }, [addTerminalLog]);

  /** 1:1 커스텀 패킷 전송 */
  const executeCustomPacket = useCallback(() => {
    const target = window.prompt('대상 ID를 입력하세요 (ALL 또는 클라이언트 UUID)');
    if (!target) {
      addTerminalLog('대상 ID 입력이 취소되었습니다.', 'warning');
      return;
    }

    const action = window.prompt('전송할 액션을 입력하세요 (예: CUSTOM_PACKET)');
    if (!action) {
      addTerminalLog('액션 입력이 취소되었습니다.', 'warning');
      return;
    }

    const payloadText = window.prompt('JSON 페이로드를 입력하세요. 빈 값은 {}로 처리됩니다.');
    let payload = {};
    if (payloadText) {
      try {
        payload = JSON.parse(payloadText);
      } catch {
        addTerminalLog('페이로드 JSON 구문 오류입니다. 전송을 취소합니다.', 'error');
        return;
      }
    }

    const success = onDispatch(target, action, JSON.stringify(payload));
    if (success) {
      addTerminalLog(`커스텀 패킷을 전송했습니다: [대상: ${target}] [액션: ${action}]`, 'success');
    } else {
      addTerminalLog('커스텀 패킷 전송에 실패했습니다.', 'error');
    }
  }, [addTerminalLog, onDispatch]);

  /** 관리자 경고 모달 요청 전송 */
  const executeRemoteAlert = useCallback(() => {
    const alertMessage = window.prompt('전달할 경고 메시지를 입력하세요.');
    if (!alertMessage) {
      addTerminalLog('경고 메시지 입력이 취소되었습니다.', 'warning');
      return;
    }

    const target = window.prompt('대상 ID를 입력하세요 (ALL 또는 클라이언트 UUID)', 'ALL');
    const success = onDispatch(
      target || 'ALL',
      'SHOW_ALERT_MODAL',
      JSON.stringify({ message: alertMessage }),
    );

    if (success) {
      addTerminalLog('원격 경고 모달 패킷을 전송했습니다.', 'success');
    } else {
      addTerminalLog('원격 경고 모달 전송에 실패했습니다.', 'error');
    }
  }, [addTerminalLog, onDispatch]);

  /** 서버 진단 명령을 실행합니다. 실행 중에는 중복 실행을 차단하고, 응답을 길이 제한으로 요약 출력합니다. */
  const executeDiagnosticCommand = useCallback(
    async (command: string, targetId?: string, payload?: object) => {
      if (runningCommand) {
        addTerminalLog(`이미 실행 중인 진단 명령이 있습니다: ${runningCommand}`, 'warning');
        return;
      }

      const meta = findCommandMeta(command);
      setRunningCommand(command);
      addTerminalLog(`[진행] ${meta ? `${meta.label} (` : ''}${command}${meta ? ')' : ''} 실행 중...`, 'info');
      const startTime = Date.now();
      try {
        const response = await fetch('/api/admin/network/diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, targetId, payload }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          addTerminalLog(`진단 명령 실패: ${data.message || response.statusText}`, 'error');
          return;
        }

        const elapsed = Date.now() - startTime;

        // 서버 응답 구조: { command, executedCommand, output } 또는 기존 단일 값과 호환되게 파싱합니다.
        const raw = data.data as unknown;
        let executedCommand = '';
        let outputText = '';
        if (raw && typeof raw === 'object' && 'output' in (raw as Record<string, unknown>)) {
          const record = raw as Record<string, unknown>;
          executedCommand = typeof record.executedCommand === 'string' ? record.executedCommand : '';
          const inner = record.output;
          outputText = typeof inner === 'string' ? inner : JSON.stringify(inner, null, 2);
        } else {
          outputText = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
        }

        // 실제 실행된 명령(전체 파라미터) 표기 후 구분선으로 결과를 구분합니다.
        if (executedCommand) {
          addTerminalLog(`$ ${executedCommand}`, 'cmd');
        }
        addTerminalLog('--------------', 'info');

        let displayText = outputText;
        if (outputText.length > MAX_OUTPUT_CHARS) {
          displayText = `${outputText.slice(0, MAX_OUTPUT_CHARS)}\n... (전체 ${outputText.length}자 중 처음 ${MAX_OUTPUT_CHARS}자만 표시)`;
        }
        addTerminalLog(displayText, 'success');
        addTerminalLog('--------------', 'info');
        addTerminalLog(`[완료: ${meta ? meta.label : command}] 소요 ${elapsed}ms, 출력 ${outputText.length}자`, 'success');
      } catch (error) {
        addTerminalLog(`진단 명령 예외: ${error}`, 'error');
      } finally {
        setRunningCommand(null);
      }
    },
    [addTerminalLog, runningCommand],
  );

  /** 데드 소켓 정화 요청 전송 */
  const executeCleanupDeadSockets = useCallback(() => {
    addTerminalLog('데드 소켓 정화 명령을 실행합니다...', 'info');
    executeDiagnosticCommand('cleanup_dead_sockets');
  }, [addTerminalLog, executeDiagnosticCommand]);

  /** 평균 RTT 지표를 계산합니다. */
  const executeAverageRttMetrics = useCallback(() => {
    addTerminalLog('평균 RTT 지표를 계산합니다...', 'info');

    const pongEvents = (socketEvents || []).filter(
      (event) => event.action === 'PONG_RESPONSE' && typeof event.payload === 'object',
    );

    if (pongEvents.length === 0) {
      addTerminalLog('PONG_RESPONSE 이벤트가 없습니다. 핑 테스트를 먼저 실행하세요.', 'warning');
      return;
    }

    const rttValues = pongEvents
      .map((event) => {
        const payload = event.payload as Record<string, unknown>;
        const original = Number(payload.originalTimestamp);
        const response = Number(payload.responseTimestamp);
        return Number.isFinite(original) && Number.isFinite(response)
          ? response - original
          : NaN;
      })
      .filter((value) => Number.isFinite(value) && value >= 0) as number[];

    if (rttValues.length === 0) {
      addTerminalLog('RTT 계산에 필요한 유효한 응답 값이 없습니다.', 'error');
      return;
    }

    const total = rttValues.reduce((sum, value) => sum + value, 0);
    const avg = (total / rttValues.length).toFixed(2);
    const min = Math.min(...rttValues);
    const max = Math.max(...rttValues);

    addTerminalLog(`RTT 응답 개수: ${rttValues.length}`, 'success');
    addTerminalLog(`  평균 RTT: ${avg}ms`, 'success');
    addTerminalLog(`  최소 RTT: ${min}ms, 최대 RTT: ${max}ms`, 'success');
  }, [addTerminalLog, socketEvents]);

  /** 터미널 로그 복사 핸들러 */
  const handleCopyLogs = useCallback(() => {
    const logText = terminalLogs.map((log) => `[${log.timestamp}] [${log.type}] ${log.text}`).join('\n');
    navigator.clipboard.writeText(logText);
    addTerminalLog('터미널 로그가 클립보드로 복사되었습니다.', 'success');
  }, [terminalLogs, addTerminalLog]);
  
  /** 콘솔 초기화 핸들러 */
  const handleClearConsole = useCallback(() => {
    setTerminalLogs([]);
    addTerminalLog('콘솔이 초기화되었습니다.', 'info');
  }, [addTerminalLog]);
  
  /** 키보드 입력 핸들러 */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(commandInput);
      setCommandInput('');
    }
  }, [commandInput, executeCommand]);
  
  /** 상단 버튼 클릭 핸들러: 실행 전에 해당 명령의 기능 설명을 터미널에 먼저 출력합니다. */
  const handleButtonClick = useCallback((action: string) => {
    const meta = findCommandMeta(action);
    if (meta) {
      addTerminalLog(`[실행] ${meta.label} — ${meta.description}`, 'info');
    }
    switch (action) {
      case 'health':
        executeHealthCheck();
        break;
      case 'ping':
        executePingAll();
        break;
      case 'session_ping':
        executeSessionPing();
        break;
      case 'api':
        executeApiSpeedTest();
        break;
      case 'sessions':
        addTerminalLog(`활성 세션 수: ${clientCount}개`, 'success');
        break;
      case 'netstat_all':
      case 'netstat_9600':
      case 'netstat_established':
      case 'netstat_listening':
      case 'netstat_e':
      case 'netstat_s':
      case 'netstat_r':
      case 'netstat_watch_2s':
      case 'tcp_9600':
      case 'node_sockets':
      case 'system_listen_ports':
      case 'disk_io_2s':
      case 'cpu_usage':
      case 'memory_usage':
      case 'sqlite_wal':
      case 'server_pid':
      case 'system_logs':
      case 'external_connectivity':
      case 'dns_lookup':
      case 'http_cors':
      case 'port_scan':
      case 'disk_io':
      case 'host_interfaces':
      case 'diagnostic_report':
        executeDiagnosticCommand(action);
        break;
      case 'sidebar_status':
        executeSidebarStatusCheck();
        break;
      case 'background_nodes':
        executeBackgroundNodeInfo();
        break;
      case 'stress_ping':
        executeStressPing();
        break;
      case 'socket_rate_limit':
        executeSocketRateLimit();
        break;
      case 'token_push':
        executeTokenPush();
        break;
      case 'custom_packet':
        executeCustomPacket();
        break;
      case 'show_alert':
        executeRemoteAlert();
        break;
      case 'cleanup_dead_sockets':
        executeCleanupDeadSockets();
        break;
      case 'avg_rtt':
        executeAverageRttMetrics();
        break;
      default:
        addTerminalLog(`알 수 없는 버튼 액션: ${action}`, 'error');
        break;
    }
  }, [executeHealthCheck, executePingAll, executePingTest, executeSessionPing, executeApiSpeedTest, executeDiagnosticCommand, addTerminalLog, clientCount, runningCommand]);
  
  // 구성 요소 초기 로딩 시 환영 메시지 출력
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      addTerminalLog('=== WebCrawlServer 네트워크 모니터링 콘솔 ===', 'info');
      addTerminalLog('도움말은 \'help\' 명령을 입력하세요.', 'info');
    }
    return () => {
      isMounted = false;
    };
  }, [addTerminalLog]);
  
  // 로그 타입에 따른 텍스트 색상 반환
  const getLogTextColor = useCallback((type: TerminalLogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-emerald-400';
      case 'error':
        return 'text-rose-400';
      case 'warning':
        return 'text-amber-400';
      case 'cmd':
        return 'text-sky-400';
      default:
        return 'text-slate-300';
    }
  }, []);
  
  // 소거된 이벤트를 제외한 최근 웹소켓 이벤트 목록 (최신 8개)
  const visibleSocketEvents = (socketEvents || []).filter(
    (event) => !hiddenEventKeys.has(buildEventKey(event)),
  ).slice(0, 8);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* 상단 진단 버튼 패널 */}
      <div className="bg-[#202124] border border-gray-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-[#28292c] flex justify-between items-center">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            네트워크 진단 명령 패널
          </span>
          {runningCommand && (
            <span className="text-xs text-amber-300 font-semibold animate-pulse">
              ▶ 실행 중: {runningCommand} ...
            </span>
          )}
        </div>
        <div className="p-4">
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${runningCommand ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* 패널 1 - netstat 분석: netstat 기반 연결/포트 상태 분석 명령 그룹 */}
            <div className="space-y-2">
              <label htmlFor="diag-group-1" className="block text-xs font-semibold uppercase tracking-wide text-slate-400">패널 1 - netstat 분석</label>
              <select
                id="diag-group-1"
                aria-label="netstat 분석 명령 선택"
                onChange={(e) => {
                  const action = e.target.value;
                  e.target.value = '';
                  if (action) handleButtonClick(action);
                }}
                className="bg-gray-800 border border-gray-700 rounded p-2 text-sm w-full text-white"
              >
                <option value="">netstat 명령 선택</option>
                {NETSTAT_COMMANDS.map((meta, idx) => (
                  <option key={meta.command} value={meta.command}>
                    {idx + 1}. {meta.label} — {meta.description}
                  </option>
                ))}
              </select>
            </div>
            {/* 패널 2 - 서버 & OS 모니터: 서버 CPU/RAM/디스크/WAL 상태 진단 명령 그룹 */}
            <div className="space-y-2">
              <label htmlFor="diag-group-2" className="block text-xs font-semibold uppercase tracking-wide text-slate-400">패널 2 - 서버 & OS 모니터</label>
              <select
                id="diag-group-2"
                aria-label="서버 OS 모니터 명령 선택"
                onChange={(e) => {
                  const action = e.target.value;
                  e.target.value = '';
                  if (action) handleButtonClick(action);
                }}
                className="bg-gray-800 border border-gray-700 rounded p-2 text-sm w-full text-white"
              >
                <option value="">서버/OS 명령 선택</option>
                {SERVER_OS_COMMANDS.map((meta, idx) => (
                  <option key={meta.command} value={meta.command}>
                    {idx + 1}. {meta.label} — {meta.description}
                  </option>
                ))}
              </select>
            </div>
            {/* 패널 3 - 플러그인 소켓 검증: 노드 핑/소켓 상태/토큰·패킷 릴레이 명령 그룹 */}
            <div className="space-y-2">
              <label htmlFor="diag-group-3" className="block text-xs font-semibold uppercase tracking-wide text-slate-400">패널 3 - 플러그인 소켓 검증</label>
              <select
                id="diag-group-3"
                aria-label="플러그인 소켓 검증 명령 선택"
                onChange={(e) => {
                  const action = e.target.value;
                  e.target.value = '';
                  if (action) handleButtonClick(action);
                }}
                className="bg-gray-800 border border-gray-700 rounded p-2 text-sm w-full text-white"
              >
                <option value="">소켓 검증 명령 선택</option>
                {SOCKET_VERIFY_COMMANDS.map((meta, idx) => (
                  <option key={meta.command} value={meta.command}>
                    {idx + 1}. {meta.label} — {meta.description}
                  </option>
                ))}
              </select>
            </div>
            {/* 패널 4 - 범용 네트워크 검증: 헬스체크/외부 연결성/진단 리포트 명령 그룹 */}
            <div className="space-y-2">
              <label htmlFor="diag-group-4" className="block text-xs font-semibold uppercase tracking-wide text-slate-400">패널 4 - 범용 네트워크 검증</label>
              <select
                id="diag-group-4"
                aria-label="범용 네트워크 검증 명령 선택"
                onChange={(e) => {
                  const action = e.target.value;
                  e.target.value = '';
                  if (action) handleButtonClick(action);
                }}
                className="bg-gray-800 border border-gray-700 rounded p-2 text-sm w-full text-white"
              >
                <option value="">네트워크 검증 명령 선택</option>
                {NETWORK_VERIFY_COMMANDS.map((meta, idx) => (
                  <option key={meta.command} value={meta.command}>
                    {idx + 1}. {meta.label} — {meta.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 실시간 소켓 이벤트 뷰 */}
      <div className="bg-[#181c22] border border-slate-800 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-[#28292c] flex justify-between items-center">
          <span className="font-bold text-xs text-gray-200 tracking-wide uppercase">
            최근 웹소켓 이벤트
          </span>
          <button
            onClick={handleClearSocketEvents}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded transition"
          >
            이벤트 소거
          </button>
        </div>
        <div className="p-4 grid gap-2 max-h-48 overflow-y-auto text-xs font-mono text-slate-200">
          {visibleSocketEvents.length > 0 ? (
            visibleSocketEvents.map((event) => (
              <div key={`${event.senderId}-${event.action}-${event.meta?.timestamp || 0}`} className="border border-slate-700 rounded px-3 py-2 bg-[#0f172a]">
                <div className="flex justify-between gap-2 text-slate-400">
                  <span>{event.action}</span>
                  <span>{new Date(event.meta?.timestamp || Date.now()).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-200 mt-1 break-all">
                  {JSON.stringify(event.payload)}
                </div>
              </div>
            ))
          ) : socketEvents && socketEvents.length > 0 ? (
            <div className="text-slate-500">이벤트가 소거되었습니다. 새 이벤트가 도착하면 다시 표시됩니다.</div>
          ) : (
            <div className="text-slate-500">웹소켓 이벤트가 아직 수신되지 않았습니다.</div>
          )}
        </div>
      </div>

      {/* 하단 터미널 콘솔 출력 창 */}
      <div
        className="flex flex-col bg-[#0D1117] rounded border border-slate-800 shadow-sm overflow-hidden"
        style={{ height: consoleHeight }}
      >
        {/* 콘솔 높이 조절 리사이즈 바 (상단 테두리를 드래그하면 높이가 조절됩니다) */}
        <div
          onPointerDown={handleConsoleResizeStart}
          onPointerMove={handleConsoleResizeMove}
          onPointerUp={handleConsoleResizeEnd}
          onPointerCancel={handleConsoleResizeEnd}
          className="h-2 shrink-0 cursor-row-resize bg-slate-800/50 hover:bg-slate-600/70 transition select-none touch-none"
          title="콘솔 높이 조절 (드래그)"
        />
        {/* 콘솔 헤더 */}
        <div className="px-4 py-2 bg-[#1E293B] border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs text-slate-400">터미널 콘솔 (Ctrl+C: 복사, Ctrl+L: 지우기)</span>
          <div className="flex gap-2">
            <button
              onClick={handleClearConsole}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded transition"
            >
              콘솔 소거
            </button>
            <button
              onClick={handleCopyLogs}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded transition"
            >
              로그 복사
            </button>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-xs px-3 py-1 rounded transition ${
                autoScroll
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              자동 스크롤 {autoScroll ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        
        {/* 콘솔 출력 창 */}
        <div
          ref={consoleOutputRef}
          className="flex-1 p-4 overflow-y-auto font-mono text-xs whitespace-pre-wrap"
        >
          {terminalLogs.length === 0 ? (
            <div className="text-slate-500 text-center py-20">
              터미널 콘솔 준비 완료
            </div>
          ) : (
            terminalLogs.map((log) => (
              <div key={log.id} className={`break-all whitespace-pre-wrap ${getLogTextColor(log.type)}`}>
                <span className="text-slate-600 mr-2">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                {log.text}
              </div>
            ))
          )}
        </div>
        
        {/* 명령어 입력 줄 */}
        <div className="px-4 py-2 bg-[#1E293B] border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-sky-400 font-bold">&gt;</span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="명령어 입력 (help, health, ping, api, clear...)"
              className="flex-1 bg-transparent border-none outline-none text-slate-100 font-mono text-xs"
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
