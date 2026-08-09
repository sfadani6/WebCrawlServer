// plugins/basic-plugin/src/config/pluginConfig.ts

/**
 * Vite 빌드 시점에 자바스크립트 리터럴 상수로 직접 치환 주입되는 플러그인 설정 객체입니다.
 * SERVER_HOST, SERVER_PORT 환경변수가 없으면 로컬 기본값을 사용합니다.
 */
export const PLUGIN_CONFIG = {
  server: {
    /** 백엔드 서버 호스트 (빌드 시점 주입) */
    host: typeof __SERVER_HOST__ !== "undefined" ? __SERVER_HOST__ : "localhost",
    /** 백엔드 서버 포트 번호 (빌드 시점 주입, 기본값: 9600 — 관리자/서버와 동일 포트 통일) */
    port: typeof __SERVER_PORT__ !== "undefined" ? __SERVER_PORT__ : 9600,
  },
  popup: {
    /** 팝업 기본 가로 너비 (빌드 시점 주입) */
    width: typeof __POPUP_WIDTH__ !== "undefined" ? __POPUP_WIDTH__ : 360,
    /** 팝업 기본 세로 높이 (빌드 시점 주입) */
    height: typeof __POPUP_HEIGHT__ !== "undefined" ? __POPUP_HEIGHT__ : 480,
    /** 팝업 최소 가로 너비 (빌드 시점 주입) */
    minWidth: typeof __POPUP_MIN_WIDTH__ !== "undefined" ? __POPUP_MIN_WIDTH__ : 320,
    /** 팝업 최소 세로 높이 (빌드 시점 주입) */
    minHeight: typeof __POPUP_MIN_HEIGHT__ !== "undefined" ? __POPUP_MIN_HEIGHT__ : 420,
    /** 팝업 최대 가로 너비 (빌드 시점 주입) */
    maxWidth: typeof __POPUP_MAX_WIDTH__ !== "undefined" ? __POPUP_MAX_WIDTH__ : 600,
    /** 팝업 최대 세로 높이 (빌드 시점 주입) */
    maxHeight: typeof __POPUP_MAX_HEIGHT__ !== "undefined" ? __POPUP_MAX_HEIGHT__ : 700,
  },
} as const;

/**
 * 설정된 호스트와 포트로 오프스크린 웹소켓 접속 URL을 생성합니다.
 *
 * @param clientId - 수집 노드 고유 UUID
 * @returns 웹소켓 접속 URL (예: ws://localhost:9600?clientId=...&clientType=plugin)
 */
export function getWebSocketUrl(clientId: string): string {
  const { host, port } = PLUGIN_CONFIG.server;
  return `ws://${host}:${port}?clientId=${clientId}&clientType=plugin`;
}
