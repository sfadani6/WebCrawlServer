import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  // vite 의존성 최적화 캐시를 프로젝트 루트 node_modules/.vite로 공유 배치한다.
  // 기본 cacheDir는 실행 디렉토리 기준 `node_modules/.vite`라 워크스페이스(admin) 하위에
  // node_modules 폴더가 생성되는 문제가 있으므로, node_modules는 루트에만 존재하도록 강제한다.
  cacheDir: resolve(__dirname, "../node_modules/.vite"),
  build: {
    // 빌드 최종 출력물 적재 폴더를 백엔드의 정적 리소스 서빙 영역인 server/public 폴더로 강제 우회
    outDir: "../server/public",
    // 컴파일 시점에 기존 퍼블릭 서빙 영역에 존재하던 구형 찌꺼기 파일 전량 강제 소거 일괄 정제
    emptyOutDir: true,
  },
});
