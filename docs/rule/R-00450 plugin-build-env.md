본 문서는 `WebCrawlServer` 브라우저 확장 플러그인의 Vite 빌드 및 다중 엔트리 번들링 개정 지침입니다. **사이드바(`sidepanel.html`)** 및 **오프스크린(`offscreen.html`)** 엔트리가 추가됨에 따라, Vite 빌드 시 다중 번들링 설정 및 `define` 매크로 상수를 자바스크립트 산출물(`dist/`)로 직접 주입하는 절차를 정의합니다.

---

## 1. 개요 및 목적

1.1 **빌드 타임 리터럴 치환**: `npm run build` 실행 시점에 Node.js 환경변수값을 자바스크립트 산출물 내의 **숫자/문자열 리터럴 상수값으로 직접 치환 주입**합니다.  
1.2 **다중 엔트리 번들링 지원**: 단일 팝업 엔트리 빌드 방식에서 탈피하여 오프스크린 엔진, 사이드바 UI, 백그라운드 워커, 콘텐츠 스크립트를 독립 산출물 파일로 각각 컴파일합니다.  

---

## 2. Vite 다중 엔트리 번들링 규정 (`vite.config.ts`)

`vite.config.ts` 파일의 `rollupOptions.input` 옵션에 4대 핵심 엔트리 파일을 지정하도록 개정 작성합니다.

```typescript
// plugins/basic-plugin/vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  // 빌드 시 전역 상수를 자바스크립트 리터럴로 직접 치환 주입
  define: {
    __SERVER_HOST__: JSON.stringify(process.env.SERVER_HOST || "localhost"),
    __SERVER_PORT__: Number(process.env.SERVER_PORT || 9600),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // 다중 번들링 엔트리 지정
        sidepanel: resolve(__dirname, "public/sidepanel.html"),
        offscreen: resolve(__dirname, "public/offscreen.html"),
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
```

---

## 3. 전역 타입 선언 및 설정 모듈 규정

3.1 **전역 타입 선언 (`src/types/env.d.ts`)**:
   - `declare const __SERVER_HOST__: string;`
   - `declare const __SERVER_PORT__: number;`
   - 빌드 주입 상수의 출처, 단위 및 역할을 한글 상세 주석으로 명시합니다.
3.2 **중앙 설정 모듈 (`src/config/pluginConfig.ts`)**:
   - 주입된 상수를 `PLUGIN_CONFIG` 객체로 내보내고 `getWebSocketUrl(clientId)` 헬퍼 함수를 제공합니다.

---

## 4. 빌드 및 개발 스크립트 실행 절차

### 4.1 개발 모드 (Vite Watch)
소스 코드 수정 시 `dist/` 폴더로 실시간 자동 번들링됩니다.
```powershell
npm run plugin:basic:dev
```

### 4.2 프로덕션 빌드 실행
```powershell
npm run build --workspace=basic-plugin
```

### 4.3 산출물 검증
빌드 완료 후 `dist/` 폴더 내에 다음 4개 핵심 자바스크립트 파일이 생성되었는지 검증합니다:
- `dist/sidepanel.js` (사이드바 대시보드 UI 산출물)
- `dist/offscreen.js` (24시간 무중단 웹소켓 엔진 산출물)
- `dist/background.js` (백그라운드 이벤트 라우터 산출물)
- `dist/content.js` (DOM 수집 및 자동 포스팅 엔진 산출물)

---

## 5. 검증 체크리스트

- [ ] `vite.config.ts`에 `sidepanel`, `offscreen`, `background`, `content` 4개 엔트리가 정상 등록되었는가?
- [ ] `npm run build` 실행 시 `dist/` 폴더에 각 엔트리별 자바스크립트 파일이 개별 생성되는가?
- [ ] `__SERVER_PORT__` 등 전역 매크로 상수가 지정된 숫자/문자열 리터럴로 치환되어 출력되는가?
