// plugins/opera-plugin/vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * 브라우저 확장 플러그인 Vite 번들링 설정입니다.
 * HTML 엔트리 포인트(sidepanel, offscreen)를 루트로 이관하여 Vite가 TSX/TS 파일을 JS로 정상 치환하도록 합니다.
 */
export default defineConfig({
  plugins: [react()],
  // vite 의존성 최적화 캐시를 프로젝트 루트 node_modules/.vite로 공유 배치한다.
  // 기본 cacheDir는 실행 디렉토리 기준 `node_modules/.vite`라 워크스페이스(plugins/opera-plugin) 하위에
  // node_modules 폴더가 생성되는 문제가 있으므로, node_modules는 루트에만 존재하도록 강제한다.
  cacheDir: resolve(__dirname, "../../node_modules/.vite"),
  define: {
    // 서버 호스트/포트 빌드 타임 리터럴 상수 주입
    // 주의: 관리자/서버 기본 포트(9600)와 통일하여 단일 서버 인스턴스로 동작하도록 기본값을 9600으로 고정
    __SERVER_HOST__: JSON.stringify(process.env.SERVER_HOST || "localhost"),
    __SERVER_PORT__: Number(process.env.SERVER_PORT || 9600),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // 프로젝트 루트의 HTML 엔트리 지정 (Vite HTML 번들링 변환 단행)
        sidepanel: resolve(__dirname, "sidepanel.html"),
        offscreen: resolve(__dirname, "offscreen.html"),
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});
