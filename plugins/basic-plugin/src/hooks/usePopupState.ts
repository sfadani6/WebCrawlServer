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
  ConfigSaveState,
} from "../types";
import {
  fetchSocketStatus,
  fetchCurrentTabUrl,
  requestCollectFullDom,
  requestStartElementPicker,
  requestStopElementPicker,
  requestFrameInfo,
  requestCollectFrameDom,
  requestCollectImages,
  requestCollectSiteInfo,
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
  if (
    packet.action === "PONG_RESPONSE" ||
    packet.action === "CRAWL_MEDIA_SAVED" ||
    packet.action === "STORAGE_LOCATION_RESPONSE"
  )
    return "success";
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
  const [receivedLogs, setReceivedLogs] = useState<Array<Record<string, unknown>>>([]);
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null);
  const [processorInfo, setProcessorInfo] = useState<ProcessorInfo | null>(null);

  // 기본 탭 요소 선택/프레임/이미지 수집 상태
  const [isElementPicking, setIsElementPicking] = useState<boolean>(false);
  const [isFrameCollecting, setIsFrameCollecting] = useState<boolean>(false);
  const [hasFrame, setHasFrame] = useState<boolean>(false);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [isImageCollecting, setIsImageCollecting] = useState<boolean>(false);

  // 터미널 콘솔 상태 (admin 네트워크 모니터링 콘솔 규격과 동일)
  const [terminalLogs, setTerminalLogs] = useState<PluginLogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [commandInput, setCommandInput] = useState<string>("");
  const [consoleHeight, setConsoleHeight] = useState<number>(200);

  // 환경설정(별칭) 상태 — chrome.storage.local에 보관하여 재로드 시 유지
  const [alias, setAlias] = useState<string>("");
  const [configSaveStatus, setConfigSaveStatus] = useState<string>("");
  /** 별칭 저장 진행 상태 구분자 — 설정 탭 저장 결과 배지 색상 결정용 */
  const [configSaveState, setConfigSaveState] = useState<ConfigSaveState>("idle");

  /**
   * 별칭 저장 상태 메시지와 배지 상태를 한 번에 갱신하는 헬퍼.
   * 메시지 문자열과 배지 종류가 어긋나는 것을 방지합니다.
   *
   * @param state - 저장 진행 상태 구분자 (배지 색상)
   * @param text - 사용자에게 표시할 결과 메시지
   */
  const applyConfigSaveStatus = useCallback(
    (state: ConfigSaveState, text: string) => {
      setConfigSaveState(state);
      setConfigSaveStatus(text);
    },
    [],
  );

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

  /**
   * 현재 활성 탭의 URL과 iframe 존재 정보를 다시 조회해 갱신합니다.
   * 활성 탭 전환 또는 페이지 네비게이션 완료 시 호출됩니다.
   *
   * @returns Promise<void>
   */
  const refreshCurrentTabInfo = useCallback(async () => {
    try {
      const url = await fetchCurrentTabUrl();
      setCurrentUrl(url);
      // iframe 존재 여부 갱신 (프레임 라디오 활성화 판단용)
      const frameRes = await requestFrameInfo();
      setHasFrame(frameRes.frameCount > 0);
      setFrameCount(frameRes.frameCount);
    } catch {
      // 활성 탭 조회 실패는 무시 (보호 페이지 등)
    }
  }, []);

  /**
   * 요소 선택 모드를 시작합니다.
   * 콘텐츠 스크립트에 파란 테두리 선택 모드 시작을 요청하고 상태를 갱신합니다.
   *
   * @returns Promise<void>
   */
  const handleStartElementPicker = useCallback(async () => {
    setStatusMessage("요소 선택 모드 시작 중...");
    addTerminalLog("요소 선택 모드를 시작합니다. 페이지에서 원하는 요소를 클릭하세요.", "info");
    const res = await requestStartElementPicker();
    if (res.success) {
      setIsElementPicking(true);
      setStatusMessage("요소 선택 모드 활성화 - 페이지에서 요소를 클릭하세요");
    } else {
      setStatusMessage(res.message);
      addTerminalLog(res.message, "error");
    }
  }, [addTerminalLog]);

  /**
   * 요소 선택 모드를 종료합니다.
   *
   * @returns Promise<void>
   */
  const handleStopElementPicker = useCallback(async () => {
    setStatusMessage("요소 선택 모드 종료 중...");
    addTerminalLog("요소 선택 모드를 종료합니다.", "info");
    const res = await requestStopElementPicker();
    if (res.success) {
      setIsElementPicking(false);
      setStatusMessage("요소 선택 모드가 종료되었습니다.");
    } else {
      setStatusMessage(res.message);
      addTerminalLog(res.message, "error");
    }
  }, [addTerminalLog]);

  /**
   * 첫 번째 iframe DOM을 수집해 서버로 전송합니다.
   *
   * @returns Promise<void>
   */
  const handleCollectFrameDom = useCallback(async () => {
    setIsFrameCollecting(true);
    setStatusMessage("프레임 DOM 수집 중...");
    addTerminalLog("프레임 DOM 수집을 요청합니다...", "info");
    try {
      const res = await requestCollectFrameDom();
      setStatusMessage(res.message);
      addTerminalLog(res.message, res.success ? "success" : "error");
    } catch {
      setStatusMessage("프레임 수집 중 오류가 발생했습니다.");
      addTerminalLog("프레임 수집 중 오류가 발생했습니다.", "error");
    }
    setIsFrameCollecting(false);
  }, [addTerminalLog]);

  /**
   * 현재 페이지의 이미지를 추출해 서버로 전송합니다.
   * 카테고리(category)를 전달해 저장소 디렉토리를 구분합니다.
   *
   * @param category - 수집 카테고리 (기본 "normal", 사이트별 album/cover 등)
   * @returns Promise<void>
   */
  const handleCollectImages = useCallback(async (category: string = "normal") => {
    setIsImageCollecting(true);
    setStatusMessage(`이미지 수집 중(${category})...`);
    addTerminalLog(`페이지 이미지 추출 및 전송을 요청합니다 (카테고리: ${category})...`, "info");
    try {
      const res = await requestCollectImages(category);
      setStatusMessage(res.message);
      addTerminalLog(res.message, res.success ? "success" : "error");
    } catch {
      setStatusMessage("이미지 수집 중 오류가 발생했습니다.");
      addTerminalLog("이미지 수집 중 오류가 발생했습니다.", "error");
    }
    setIsImageCollecting(false);
  }, [addTerminalLog]);

  /**
   * 현재 페이지의 사이트 정보(메타데이터)를 추출해 서버로 전송합니다.
   * 정보 수집 버튼(사이트 전용)에서 호출됩니다.
   *
   * @returns Promise<void>
   */
  const handleCollectSiteInfo = useCallback(async () => {
    setIsImageCollecting(true);
    setStatusMessage("사이트 정보 수집 중...");
    addTerminalLog("사이트 정보 수집을 요청합니다...", "info");
    try {
      const res = await requestCollectSiteInfo();
      setStatusMessage(res.message);
      addTerminalLog(res.message, res.success ? "success" : "error");
    } catch {
      setStatusMessage("사이트 정보 수집 중 오류가 발생했습니다.");
      addTerminalLog("사이트 정보 수집 중 오류가 발생했습니다.", "error");
    }
    setIsImageCollecting(false);
  }, [addTerminalLog]);

  /**
   * xvideos 다운로드 매니저 전용 팝업 창을 엽니다.
   * 대상 xvideos 탭(tabId)을 쿼리로 전달해 매니저 페이지가 해당 탭에서
   * 목록 생성/순차 다운로드를 독립 수행하도록 합니다. (패널 폭 협소 문제 해소)
   *
   * @returns Promise<void>
   */
  const handleOpenXvideosManager = useCallback(async () => {
    setStatusMessage("xvideos 다운로드 매니저 창을 엽니다...");
    try {
      // 열려 있는 xvideos 탭 검색 (활성 탭 우선, 없으면 첫 번째 탭)
      const tabs = await chrome.tabs.query({ url: "*://*.xvideos.com/*" });
      const target =
        tabs.find((t) => t.active) || tabs.find((t) => typeof t.id === "number");
      const tabId = target && typeof target.id === "number" ? target.id : null;
      if (tabId === null) {
        setStatusMessage("xvideos.com 탭을 찾을 수 없습니다.");
        addTerminalLog("xvideos.com 페이지를 연 상태에서 다시 시도하세요.", "warning");
        return;
      }
      const managerUrl = chrome.runtime.getURL(
        `xvideos-manager.html?tabId=${tabId}`,
      );
      await chrome.windows.create({
        url: managerUrl,
        type: "popup",
        width: 900,
        height: 760,
        focused: true,
      });
      setStatusMessage("xvideos 다운로드 매니저 창을 열었습니다.");
      addTerminalLog("xvideos 다운로드 매니저 창을 열었습니다.", "success");
    } catch {
      setStatusMessage("다운로드 매니저 창을 여는 중 오류가 발생했습니다.");
      addTerminalLog("다운로드 매니저 창을 여는 중 오류가 발생했습니다.", "error");
    }
  }, [addTerminalLog]);

  /**
   * xvideos 페이징 액션 실행기 전용 팝업 창을 엽니다.
   * 대상 xvideos(xvideos.com/xvideos.red) 페이징 탭(tabId)을 쿼리로 전달해
   * 팝업이 페이지를 순차 이동하며 페이지별 로드 완료 검증 → 비디오 블록 수집 →
   * 서버 저장을 독립 수행하고, 진행 로그(이동 중/로딩 완료/수집/완료)를 콘솔 형태로 출력합니다.
   *
   * @returns Promise<void>
   */
  const handleOpenXvBestOfRedAction = useCallback(async () => {
    setStatusMessage("xvideos 페이징 액션 실행기 창을 엽니다...");
    addTerminalLog(
      "xvideos 페이징 액션 실행기 창을 엽니다... (탭 검색 중)",
      "info",
    );
    try {
      // 열려 있는 xvideos.com/xvideos.red 페이징 탭 검색
      // (페이징 경로 탭 우선 → 활성 탭 → 첫 번째 탭)
      const tabs = await chrome.tabs.query({
        url: ["*://*.xvideos.com/*", "*://*.xvideos.red/*"],
      });
      const pagingTab = tabs.find((t) =>
        t.url ? /\/(?:[^/]+)\/\d{4}-\d{2}/.test(t.url) : false,
      );
      const bestTab = pagingTab || tabs.find((t) => t.active);
      const target = bestTab || tabs.find((t) => typeof t.id === "number");
      const tabId = target && typeof target.id === "number" ? target.id : null;
      if (tabId === null) {
        setStatusMessage("xvideos 페이징 탭을 찾을 수 없습니다.");
        addTerminalLog(
          "xvideos.com 또는 xvideos.red 페이징 페이지(예: /best/2026-03)를 연 상태에서 다시 시도하세요.",
          "warning",
        );
        return;
      }
      const runnerUrl = chrome.runtime.getURL(
        `action-runner.html?module=best-of-red&tabId=${tabId}`,
      );
      await chrome.windows.create({
        url: runnerUrl,
        type: "popup",
        width: 900,
        height: 760,
        focused: true,
      });
      setStatusMessage("xvideos 페이징 액션 실행기 창을 열었습니다.");
      addTerminalLog("xvideos 페이징 액션 실행기 창을 열었습니다.", "success");
    } catch {
      setStatusMessage("액션 실행기 창을 여는 중 오류가 발생했습니다.");
      addTerminalLog("액션 실행기 창을 여는 중 오류가 발생했습니다.", "error");
    }
  }, [addTerminalLog]);

  // 초기화 및 오프스크린 패킷 수신 리스너 등록
  useEffect(() => {
    refreshCurrentTabInfo();
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

    // 크롬 런타임 메시지 구조체 (러프 타입: type과 packet/payload만 사용)
    type RuntimePacket = {
      action?: unknown;
      senderId?: unknown;
      payload?: unknown;
    };
    type RuntimeMessage = {
      type?: string;
      packet?: RuntimePacket;
      payload?: { message?: string };
    };

    const listener = (message: RuntimeMessage) => {
      if (message.type === "SOCKET_PACKET_RECEIVED" && message.packet) {
        setReceivedLogs((prev) => [
          ...prev,
          message.packet as Record<string, unknown>,
        ]);
        // 수신 패킷을 터미널 콘솔에도 기록
        addTerminalLog(formatPacketLog(message.packet), getPacketLogType(message.packet));
      }
      // 환경설정 저장 ACK 수신 시 저장 상태 메시지 갱신
      if (message.type === "CLIENT_CONFIG_ACK_RECEIVED" && message.packet) {
        const ack = message.packet.payload as ClientConfigAckPayload | undefined;
        if (ack && ack.success) {
          applyConfigSaveStatus("success", `별칭 저장 완료: ${ack.alias || ""}`);
          addTerminalLog(`별칭 저장 완료 (서버 반영): ${ack.alias || ""}`, "success");
        } else {
          applyConfigSaveStatus("error", "별칭 저장 실패 (서버 응답 오류)");
          addTerminalLog("별칭 저장 실패: 서버가 ACK를 거부했습니다.", "error");
        }
      }
      // 콘텐츠 스크립트에서 요소 선택 완료/취소 알림 수신 시 모드 종료 처리
      if (message.type === "ELEMENT_PICKER_ENDED" && message.payload) {
        setIsElementPicking(false);
        setStatusMessage(message.payload.message || "요소 선택이 종료되었습니다.");
        addTerminalLog(message.payload.message || "요소 선택이 종료되었습니다.", "success");
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // 활성 탭 전환/네비게이션 감시 — 현재 페이지 URL 및 iframe 정보 자동 갱신
    const onTabActivated = () => {
      refreshCurrentTabInfo();
    };
    const onTabUpdated = (
      _tabId: number,
      changeInfo: { status?: string },
    ) => {
      if (changeInfo.status === "complete") {
        refreshCurrentTabInfo();
      }
    };
    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    };
  }, [checkSocketStatus, addTerminalLog, refreshCurrentTabInfo, applyConfigSaveStatus]);

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
      // 이후 인자는 send 명령에서 사용하지 않고 파싱 단계에서 직접 처리함
      void parts.slice(1);

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
        applyConfigSaveStatus("warning", "별칭을 입력해 주세요.");
        addTerminalLog("별칭 저장 실패: 빈 별칭은 허용되지 않습니다.", "warning");
        return;
      }

      applyConfigSaveStatus("pending", "서버에 별칭 저장 중...");
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
        applyConfigSaveStatus("success", "전송 완료 (서버 반영 대기 중)");
      } else {
        applyConfigSaveStatus("error", `별칭 저장 실패: ${res.message}`);
        addTerminalLog(`별칭 저장 실패: ${res.message}`, "error");
      }
    },
    [addTerminalLog, applyConfigSaveStatus],
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
    configSaveState,
    isElementPicking,
    isFrameCollecting,
    hasFrame,
    frameCount,
    isImageCollecting,
    handleSaveClientConfig,
    handleSendFullDom,
    handleStartElementPicker,
    handleStopElementPicker,
    handleCollectFrameDom,
    handleCollectImages,
    handleCollectSiteInfo,
    handleOpenXvideosManager,
    handleOpenXvBestOfRedAction,
    handleSendDebugMessage,
    handleTabChange,
    executePluginCommand,
    handleClearTerminal,
    handleConsoleResizeStart,
    handleConsoleResizeMove,
    handleConsoleResizeEnd,
  };
}
