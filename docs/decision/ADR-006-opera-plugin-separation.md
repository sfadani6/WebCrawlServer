# ADR-006: 오페라 전용 플러그인(`plugins/opera-plugin`) 분리 채택

> **상태**: 승인됨 (Accepted)
> **날짜**: 2026-08-09
> **결정자**: 시스템 아키텍트 & 개발 팀
> **관련 문서**: AGENTS.md, R-00410, R-00460, R-00470

---

## 1. 배경 및 문제 정의 (Context & Problem Statement)

오페라 브라우저에서 기존 크롬용 확장 플러그인(`plugins/basic-plugin`)을 로드하면 다음 증상이 발생했습니다.

1. **`Permission 'sidePanel' is unknown` 오류**: 오페라는 Chrome 표준 `sidePanel` permission을 인식하지 못해 확장 프로그램 로드/사이드바 표시가 실패합니다.
2. **사이드바 미표시**: 오페라의 사이드바는 별도 권한 없이 `sidebar_action` 매니페스트 키(`default_panel` 필수)로 동작하며, Chrome의 `side_panel` 키와 호환되지 않습니다.
3. **단일 manifest 동시 지원 불가**: `manifest_version` 및 권한 키가 브라우저별로 상이하여, 하나의 manifest로 크롬과 오페라를 동시에 지원할 수 없습니다.

### 근본 원인 (Root Cause)

- 오페라는 크로미움(Chromium) 기반이지만 Chrome 확장 API/권한을 전부 지원하지 않으며, `sidePanel` permission과 `chrome.sidePanel` API(`side_panel` 키 포함)를 지원하지 않습니다.
- `background.ts`의 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 호출은 오페라에서 `chrome.sidePanel`이 `undefined`라 TypeError를 발생시킬 수 있습니다.

---

## 2. 고려된 대안들 (Considered Options)

### 대안 1: 단일 manifest에 `side_panel` + `sidebar_action` 공존
- **장점**: 플러그인 폴더/빌드가 하나로 유지됨.
- **단점**: `sidePanel` permission을 제거해야 하므로 크롬에서 아이콘 클릭 자동 오픈(`setPanelBehavior`)이 불가능해 UX가 저하됨. `side_panel` 키를 유지하면 오페라에서 여전히 오류가 발생할 수 있어 실제로는 두 브라우저 모두 만족하기 어려움.

### 대안 2: 브라우저별 별도 플러그인 분리 (선택안)
- **장점**:
  - 크롬(`basic-plugin`)과 오페라(`opera-plugin`) 각각에 최적화된 manifest를 유지할 수 있음.
  - 크롬 전용 기능(아이콘 클릭 자동 오픈)을 그대로 보존하면서 오페라 사이드바(`sidebar_action`)도 완전 지원.
  - 오페라 특수 변경 범위가 manifest와 `background.ts` 가드로 한정되어 기능 동일성 유지가 용이함.
- **단점**: 플러그인 소스가 중복 관리되며(사본 유지), 기능 변경 시 두 곳에 동일 반영해야 함. (사본 구조로 중복을 최소화)

---

## 3. 아키텍처 결정 사항 (Decision)

**대안 2 (오페라 전용 플러그인 분리)를 채택합니다.**

### 상세 결정 규정:
1. **`plugins/opera-plugin/` 신설**: `plugins/basic-plugin`의 전체 소스(`public/`, `src/`, HTML 엔트리, `vite.config.ts`, `tsconfig.json`, `.npmrc`)를 사본으로 생성하고, 오페라 특수 부분만 변경합니다.
2. **오페라 특수 변경 범위**:
   - `public/manifest.json`: permissions에서 `"sidePanel"` 제거, `"side_panel"` 키 제거 후 `"sidebar_action"` 키(`default_panel`/`default_title`/`default_icon`) 추가. 그 외 권한 35종은 유지(무중단 오프스크린 웹소켓 기능 보존).
   - `src/background.ts`: `chrome.sidePanel.setPanelBehavior(...)` → `chrome.sidePanel?.setPanelBehavior(...)` 옵셔널 가드.
   - `package.json`: `name`을 `opera-plugin`으로, `description`을 오페라 명시로 변경.
3. **워크스페이스/스크립트**: 루트 `package.json` `workspaces`에 `plugins/opera-plugin` 추가, `plugin:opera:dev` 스크립트 신설, `build:all`에 opera-plugin 빌드 포함.
4. **배포 방식**: 크롬 확장은 `plugins/basic-plugin/dist/`를, 오페라 확장은 `plugins/opera-plugin/dist/`를 각각 개발자 모드(direct load)로 로드합니다.
5. **오프스크린 미지원 대비**: 오페라에서 `chrome.offscreen`/`chrome.runtime.getContexts` 미지원이 확인되면 무중단 웹소켓 폴백(background 직접 연결 등)을 별도 ADR로 규정합니다.

---

## 4. 파급 효과 및 이점 (Consequences)

### 긍정적 이점:
- **브라우저 호환성**: 오페라에서 `Permission 'sidePanel' is unknown` 오류가 사라지고 `sidebar_action` 기반 사이드바가 정상 동작.
- **크롬 기능 보존**: 크롬 전용 `sidePanel` + 아이콘 클릭 자동 오픈 기능은 `basic-plugin`에 그대로 유지.
- **최소 변경 원칙**: 기능 소스는 그대로 두고 manifest/사이드바 방식만 오페라 특수 처리하여 기능 동일성을 보장.

### 적용 위치:
- `plugins/opera-plugin/` (신규 워크스페이스: `public/manifest.json`, `src/background.ts`, `package.json`, `vite.config.ts`)
- `package.json` (루트: workspaces, `plugin:opera:dev`, `build:all`)

### 검증 결과 (2026-08-09):
- `npm run build --workspace=opera-plugin` 성공: `dist/`에 `sidepanel.js`/`offscreen.js`/`background.js`/`content.js` 및 오페라용 `manifest.json` 생성 확인.
- `npm run build --workspace=basic-plugin` 성공: 크롬용 빌드 정상 유지 확인.
- `dist/manifest.json`: `sidebar_action` 키 존재, `sidePanel` permission/`side_panel` 키 부재 확인.
- 오페라 실제 로드 및 사이드바 표시는 오페라 환경에서 수동 검증 예정.
