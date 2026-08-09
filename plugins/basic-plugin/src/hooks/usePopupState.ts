// plugins/basic-plugin/src/hooks/usePopupState.ts

import { useState, useEffect, useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  TabType,
  BrowserInfo,
  ProcessorInfo,
  PluginLogEntry,
  PluginLogType,
  ClientConfigAckPayload,
} from "../types";
import {
  fetchSocketStatus,
  fetchCurrentTabUrl,
  requestCollectFullDom,
  sendDebugMessage,
  sendSocketPacket,
  sendClientConfigUpdate,
  extractBrowserInfo,
  extractProcessorInfo,
} from "../services/chromeService";

/** 수신 패킷 로그 최대 본문 길이 */
const MAX_PACKET_LOG_CHARS = 200;

/**
 * 수신 웹소켓 패킷을 터미널 콘솔 로그용 요약 텍스트로 변환합니다.
 *
 * @param packet - 수신된 웹소켓 패킷
 * @returns 콘솔 로그용 요약 문자열
 */
function formatPacketLog(packet: {
  action?: unknown;
  senderId?: unknown;
  payload?: unknown;
}): string {
  const sender =
    typeof packet.senderId === "string" && packet.senderId.length > 8
      ? `${packet.senderId.slice(0, 8)}...`
      : String(packet.senderId ?? "unknown");
  let payloadText = "";
  try {
    payloadText =
      typeof packet.payload === "string"
        ? packet.payload
        : JSON.stringify(packet.payload ?? "");
  } catch {
    payloadText = "(직렬화 불가)";
  }
  if (payloadText.length > MAX_PACKET_LOG_CHARS) {
    payloadText = `${payloadText.slice(0, MAX_PACKET_LOG_CHARS)}...`;
  }
  return `[패킷 수신] ${String(packet.action ?? "unknown")} | sender: ${sender} | ${payloadText}`;
}

/**
 * 수신 패킷의 action에 따라 콘솔 로그 색상을 분류합니다.
 *
 * @param packet - 수신된 웹소켓 패킷
 * @returns 콘솔 로그 타입
 */
function getPacketLogType(packet: { action?: unknown }): PluginLogType {
  if (packet.action === "PONG_RESPONSE") return "success";
  return "info";
}

/**
 * 플러그인 팝업 상태 훅을 초기화하고 관리합니다.
 * 사이드바/팝업에서 공유되는 모든 상태와 터미널 콘솔 로직을 포함합니다.
 *
 * @returns 팝업 UI와 연동하기 위한 상태와 핸들러들을 포함하는 객체
 */
export function usePopupState() {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [clientId, setClientId] = useState<string>("조회 중...");
  const [currentUrl, setCurrentUrl] = useState<string>("조회 중...");
  const [isServerOnline, setIsServerOnline] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [debugMessage, setDebugMessage] = useState<string>(
    JSON.stringify({ action: "DEBUG_TEST", payload: { test: true } }, null, 2),
  );
  const [debugStatus, setDebugStatus] = useState<string>("");
  // 수신된 웹소켓 패킷 로그 배열 (기존 수집 파이프라인 유지)
  const [receivedLogs, setReceivedLogs] = useState<Array<any>>([]);
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null);
  const [processorInfo, setProcessorInfo] = useState<ProcessorInfo | null>(null);

  // 터미널 콘솔 상태 (admin 네트워크 모니터링 콘솔 규격과 동일)
  const [terminalLogs, setTerminalLogs] = useState<PluginLogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [commandInput, setCommandInput] = useState<string>("");
  const [consoleHeight, setConsoleHeight] = useState<number>(200);

  // 환경설정(별칭) 상태 — chrome.storage.local에 보관하여 재로드 시 유지
  const [alias, setAlias] = useState<string>("");
  const [configSaveStatus, setConfigSaveStatus] = useState<string>("");

  /** 콘솔 높이 드래그 시작 시점 정보 (시작 Y 좌표와 시작 높이) */
  const consoleDragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  /** 현재 시각을 ISO 8601 형식 문자열로 반환합니다. */
  function getTimestamp(): string {
    return new Date().toISOString();
  }

  /** 터미널 콘솔 로그 고유 ID 생성기 */
  const generateLogId = useCallback(() => {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }, []);

  /**
   * 터미널 콘솔에 로그를 추가합니다. (admin 네트워크 모니터링 콘솔과 동일 규격)
   *
   * @param text - 로그 본문
   * @param type - 로그 타입 (색상 분류, 기본 info)
   */
  const addTerminalLog = useCallback(
    (text: string, type: PluginLogType = "info") => {
      const newLog: PluginLogEntry = {
        id: generateLogId(),
        timestamp: getTimestamp(),
        type,
        text,
      };
      setTerminalLogs((prev) => [...prev, newLog]);
    },
    [generateLogId],
  );

  /**
   * 웹소켓 서버 연결 상태를 확인하고 클라이언트 ID를 업데이트합니다.
   * 결과는 터미널 콘솔에도 기록합니다.
   *
   * @returns Promise<void>
   */
  const checkSocketStatus = useCallback(async () => {
    addTerminalLog("웹소켓 연결 상태를 조회합니다...", "info");
    try {
      const res = await fetchSocketStatus();
      setIsServerOnline(res.connected);
      if (res.connected) {
        if (res.clientId) setClientId(res.clientId);
        addTerminalLog(
          `소켓 연결됨 (clientId: ${res.clientId ?? "unknown"}, port: ${res.port ?? "-"})`,
          "success",
        );
      } else {
        setClientId("미발급 (서버 미연결)");
        addTerminalLog(
          "소켓 미연결 상태입니다. 오프스크린 엔진의 재연결을 대기합니다.",
          "warning",
        );
      }
    } catch {
      addTerminalLog("소켓 상태 조회 중 오류가 발생했습니다.", "error");
    }
  }, [addTerminalLog]);

  /**
   * 전체 DOM을 수집하도록 서버에 요청하고 상태 메시지를 업데이트합니다.
   * 결과는 터미널 콘솔에도 기록합니다.
   *
   * @returns Promise<void>
   */
  const handleSendFullDom = useCallback(async () => {
    setIsSending(true);
    setStatusMessage("페이지 DOM 수집 중...");
    addTerminalLog("전체 DOM 수집을 요청합니다...", "info");
    try {
      const res = await requestCollectFullDom();
      setStatusMessage(res.message);
      addTerminalLog(res.message, res.success ? "success" : "error");
    } catch {
      setStatusMessage("DOM 수집 중 오류가 발생했습니다.");
      addTerminalLog("DOM 수집 중 오류가 발생했습니다.", "error");
    }
    setIsSending(false);
    await checkSocketStatus();
  }, [checkSocketStatus, addTerminalLog]);

  // 초기화 및 오프스크린 패킷 수신 리스너 등록
  useEffect(() => {
    fetchCurrentTabUrl().then(setCurrentUrl);
    checkSocketStatus();
    setBrowserInfo(extractBrowserInfo());
    setProcessorInfo(extractProcessorInfo());

    // chrome.storage.local에서 기존 별칭 로드 (환경설정 탭 초기값)
    try {
      chrome.storage.local.get(["alias"]).then((result) => {
        if (result && typeof result.alias === "string") {
          setAlias(result.alias);
        }
      });
    } catch {
      // 스토리지 API 미지원 시 기본값 유지
    }

    // 환영 메시지 출력 (중복 방지를 위해 초기화 시 한 번만)
    addTerminalLog("=== WebCrawlServer 플러그인 터미널 콘솔 ===", "info");
    addTerminalLog("도움말은 'help' 명령을 입력하세요.", "info");

    const listener = (message: any) => {
      if (message.type === "SOCKET_PACKET_RECEIVED" && message.packet) {
        setReceivedLogs((prev) => [...prev, message.packet]);
        // 수신 패킷을 터미널 콘솔에도 기록
        addTerminalLog(formatPacketLog(message.packet), getPacketLogType(message.packet));
      }
      // 환경설정 저장 ACK 수신 시 저장 상태 메시지 갱신
      if (message.type === "CLIENT_CONFIG_ACK_RECEIVED" && message.packet) {
        const ack = message.packet.payload as ClientConfigAckPayload | undefined;
        if (ack && ack.success) {
          setConfigSaveStatus(`별칭 저장 완료: ${ack.alias || ""}`);
          addTerminalLog(`별칭 저장 완료 (서버 반영): ${ack.alias || ""}`, "success");
        } else {
          setConfigSaveStatus("별칭 저장 실패 (서버 응답 오류)");
          addTerminalLog("별칭 저장 실패: 서버가 ACK를 거부했습니다.", "error");
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [checkSocketStatus, addTerminalLog]);

  /**
   * 사용자가 입력한 디버그 메시지를 JSON으로 파싱해 서버에 전송합니다.
   * 파싱 오류 시 상태와 터미널 콘솔을 업데이트합니다.
   *
   * @returns Promise<void>
   */
  const handleSendDebugMessage = useCallback(async () => {
    try {
      const parsed = JSON.parse(debugMessage);
      setDebugStatus("메시지 전송 중...");
      addTerminalLog("디버그 메시지(JSON)를 서버로 전송합니다...", "info");
      const res = await sendDebugMessage(parsed);
      setDebugStatus(res.message);
      setIsServerOnline(res.success);
      addTerminalLog(res.message, res.success ? "success" : "error");
    } catch {
      setDebugStatus("오류: 올바른 JSON 포맷이 아닙니다.");
      addTerminalLog("오류: 올바른 JSON 포맷이 아닙니다.", "error");
    }
  }, [debugMessage, addTerminalLog]);

  /**
   * 터미널 콘솔 명령어를 실행합니다. (help/clear/status/ping/send)
   *
   * @param command - 사용자가 입력한 명령 문자열
   * @returns Promise<void>
   */
  const executePluginCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;

      addTerminalLog(`> ${command}`, "cmd");

      const parts = command.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (cmd === "help") {
        addTerminalLog("사용 가능한 명령어:", "info");
        addTerminalLog("  help           - 이 도움말 표시", "info");
        addTerminalLog("  clear          - 콘솔 내용 비우기", "info");
        addTerminalLog("  status         - 웹소켓 연결 상태 조회", "info");
        addTerminalLog("  ping           - PING_TEST 패킷 서버 전송", "info");
        addTerminalLog("  send <json>    - JSON 패킷 서버 전송 (CRAWL_METADATA)", "info");
        return;
      }

      if (cmd === "clear") {
        setTerminalLogs([]);
        addTerminalLog("콘솔이 비워졌습니다.", "success");
        return;
      }

      if (cmd === "status") {
        await checkSocketStatus();
        return;
      }

      if (cmd === "ping") {
        addTerminalLog("PING_TEST 패킷을 서버로 전송합니다...", "info");
        try {
          const res = await sendSocketPacket({
            action: "PING_TEST",
            targetId: "SERVER",
            payloadType: "json",
            payload: { timestamp: Date.now() },
          });
          addTerminalLog(res.message, res.success ? "success" : "error");
        } catch {
          addTerminalLog("PING_TEST 패킷 전송 중 오류가 발생했습니다.", "error");
        }
        return;
      }

      if (cmd === "send") {
        const parsedText = command.trim().slice(4).trim();
        if (!parsedText) {
          addTerminalLog("사용법: send <JSON> — 전송할 JSON 객체를 함께 입력하세요.", "warning");
          return;
        }
        try {
          const parsed = JSON.parse(parsedText);
          addTerminalLog("JSON 패킷을 서버로 전송합니다...", "info");
          const res = await sendDebugMessage(parsed);
          addTerminalLog(res.message, res.success ? "success" : "error");
        } catch {
          addTerminalLog("오류: 올바른 JSON 포맷이 아닙니다.", "error");
        }
        return;
      }

      addTerminalLog(`알 수 없는 명령어: ${cmd}. 'help'를 입력하여 도움말을 확인하세요.`, "error");
    },
    [addTerminalLog, checkSocketStatus, sendSocketPacket, sendDebugMessage],
  );

  /** 터미널 콘솔 로그 전체를 소거하고 완료 로그를 남깁니다. */
  const handleClearTerminal = useCallback(() => {
    setTerminalLogs([]);
    addTerminalLog("터미널 콘솔이 비워졌습니다.", "success");
  }, [addTerminalLog]);

  /**
   * 플러그인 환경설정(별칭)을 로컬 스토리지와 서버 DB에 저장합니다.
   * 1) chrome.storage.local에 보관해 재로드 시 유지 2) 서버로 CLIENT_CONFIG_UPDATE 전송
   * 서버가 CLIENT_CONFIG_UPDATE_ACK를 반환하면 저장 상태 메시지를 갱신합니다.
   *
   * @returns Promise<void>
   */
  const handleSaveClientConfig = useCallback(
    async (newAlias: string) => {
      const trimmed = newAlias.trim();
      if (!trimmed) {
        setConfigSaveStatus("별칭을 입력해 주세요.");
        addTerminalLog("별칭 저장 실패: 빈 별칭은 허용되지 않습니다.", "warning");
        return;
      }

      setConfigSaveStatus("서버에 별칭 저장 중...");
      addTerminalLog(`별칭 저장 요청 전송: ${trimmed}`, "info");

      // 1. 로컬 스토리지 보관 (재로드 시 유지)
      try {
        await chrome.storage.local.set({ alias: trimmed });
      } catch {
        // 스토리지 실패는 치명적이지 않음
      }

      // 2. 서버 저장 요청 (CLIENT_CONFIG_UPDATE)
      const res = await sendClientConfigUpdate(trimmed);
      if (res.success) {
        // 실제 DB 반영은 ACK 수신 리스너에서 처리하며, 여기서는 전송 성공만 안내
        setAlias(trimmed);
        setConfigSaveStatus("전송 완료 (서버 반영 대기 중)");
      } else {
        setConfigSaveStatus(`별칭 저장 실패: ${res.message}`);
        addTerminalLog(`별칭 저장 실패: ${res.message}`, "error");
      }
    },
    [addTerminalLog],
  );

  /** 탭 전환 핸들러 (전환 이력을 터미널 콘솔에 기록) */
  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      const label =
        tab === "basic"
          ? "기본 수집"
          : tab === "info"
          ? "브라우저 정보"
          : tab === "debug"
          ? "디버깅"
          : "환경 설정";
      addTerminalLog(`탭 전환: ${label}`, "info");
    },
    [addTerminalLog],
  );

  /** 콘솔 높이 리사이즈 바 드래그 시작 핸들러 */
  const handleConsoleResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      consoleDragRef.current = { startY: e.clientY, startHeight: consoleHeight };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [consoleHeight],
  );

  /** 콘솔 높이 리사이즈 바 드래그 이동 핸들러 — 위로 당기면 커지고, 사이드바 높이를 넘지 않는 범위로 제한합니다. */
  const handleConsoleResizeMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = consoleDragRef.current;
    if (!drag) return;
    const maxHeight = Math.max(120, window.innerHeight - 80);
    const next = drag.startHeight + (drag.startY - e.clientY);
    setConsoleHeight(Math.min(maxHeight, Math.max(100, next)));
  }, []);

  /** 콘솔 높이 리사이즈 바 드래그 종료 핸들러 */
  const handleConsoleResizeEnd = useCallback(() => {
    consoleDragRef.current = null;
  }, []);

  return {
    receivedLogs,
    terminalLogs,
    autoScroll,
    setAutoScroll,
    commandInput,
    setCommandInput,
    consoleHeight,
    activeTab,
    setActiveTab,
    clientId,
    currentUrl,
    isServerOnline,
    statusMessage,
    isSending,
    debugMessage,
    setDebugMessage,
    debugStatus,
    browserInfo,
    processorInfo,
    alias,
    setAlias,
    configSaveStatus,
    handleSaveClientConfig,
    handleSendFullDom,
    handleSendDebugMessage,
    handleTabChange,
    executePluginCommand,
    handleClearTerminal,
    handleConsoleResizeStart,
    handleConsoleResizeMove,
    handleConsoleResizeEnd,
  };
}
