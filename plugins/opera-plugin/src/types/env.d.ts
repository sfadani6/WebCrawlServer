// plugins/opera-plugin/src/types/env.d.ts

/**
 * ============================================================================
 * Vite 빌드 타임 전역 상수 선언 파일 (Type Declarations)
 * ============================================================================
 *
 * [동작 원리]
 * 본 파일에 선언된 전역 변수들은 런타임에 동적으로 변경되는 값이 아닙니다.
 * `vite.config.ts`의 `define` 설정에 의해 `npm run build` 시점에 Node.js 환경변수
 * (`process.env.POPUP_WIDTH` 등)를 읽어 자바스크립트 코드 내에 리터럴 값으로 직접 치환(Replace)됩니다.
 *
 * TypeScript 컴파일러가 이 전역 상수를 인식하고 타입 에러를 발생시키지 않도록
 * 본 선언 파일(`env.d.ts`)에서 전역 타입 식별자로 등록합니다.
 */

/**
 * 팝업 창의 초기 기본 가로 너비
 * - 타입: `number`
 * - 단위: 픽셀 (px)
 * - 빌드 주입 출처: `process.env.POPUP_WIDTH`
 * - 기본값: `360`
 * - 활용 위치: `popup.tsx` -> 팝업 컨테이너의 initial width 스타일
 */
declare const __POPUP_WIDTH__: number;

/**
 * 팝업 창의 초기 기본 세로 높이
 * - 타입: `number`
 * - 단위: 픽셀 (px)
 * - 빌드 주입 출처: `process.env.POPUP_HEIGHT`
 * - 기본값: `480`
 * - 활용 위치: `popup.tsx` -> 팝업 컨테이너의 initial height 스타일
 */
declare const __POPUP_HEIGHT__: number;

/**
 * 팝업 창을 마우스 드래그로 리사이즈할 때 축소 가능한 최소 가로 너비
 * - 타입: `number`
 * - 단위: 픽셀 (px)
 * - 빌드 주입 출처: `process.env.POPUP_MIN_WIDTH`
 * - 기본값: `320`
 * - 활용 위치: `popup.tsx` -> 팝업 컨테이너의 minWidth 스타일
 */
declare const __POPUP_MIN_WIDTH__: number;

/**
 * 팝업 창을 마우스 드래그로 리사이즈할 때 축소 가능한 최소 세로 높이
 * - 타입: `number`
 * - 단위: 픽셀 (px)
 * - 빌드 주입 출처: `process.env.POPUP_MIN_HEIGHT`
 * - 기본값: `420`
 * - 활용 위치: `popup.tsx` -> 팝업 컨테이너의 minHeight 스타일
 */
declare const __POPUP_MIN_HEIGHT__: number;

/**
 * 팝업 창을 마우스 드래그로 리사이즈할 때 확장 가능한 최대 가로 너비
 * - 타입: `number`
 * - 단위: 픽셀 (px)
 * - 빌드 주입 출처: `process.env.POPUP_MAX_WIDTH`
 * - 기본값: `600`
 * - 활용 위치: `popup.tsx` -> 팝업 컨테이너의 maxWidth 스타일
 */
declare const __POPUP_MAX_WIDTH__: number;

/**
 * 팝업 창을 마우스 드래그로 리사이즈할 때 확장 가능한 최대 세로 높이
 * - 타입: `number`
 * - 단위: 픽셀 (px)
 * - 빌드 주입 출처: `process.env.POPUP_MAX_HEIGHT`
 * - 기본값: `700`
 * - 활용 위치: `popup.tsx` -> 팝업 컨테이너의 maxHeight 스타일
 */
declare const __POPUP_MAX_HEIGHT__: number;

/**
 * 백엔드 WebCrawlServer가 가동 중인 호스트 주소 또는 IP
 * - 타입: `string`
 * - 예시: `"localhost"`, `"127.0.0.1"`, `"192.168.0.10"`
 * - 빌드 주입 출처: `process.env.SERVER_HOST`
 * - 기본값: `"localhost"`
 * - 활용 위치: `src/config/pluginConfig.ts` -> WebSocket 접속 URL 구성
 */
declare const __SERVER_HOST__: string;

/**
 * 백엔드 WebCrawlServer의 WebSocket 및 HTTP 통합 서비스 포트 번호
 * - 타입: `number`
 * - 단위: 포트 번호
 * - 빌드 주입 출처: `process.env.SERVER_PORT`
 * - 기본값: `9600` (관리자/서버 단일 인스턴스 포트와 통일)
 * - 활용 위치: `src/config/pluginConfig.ts`, `Footer.tsx` -> 하단 포트 번호 표출
 */
declare const __SERVER_PORT__: number;
