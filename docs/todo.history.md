# 작업 이력

---

## 2026-08-09 | 오페라 전용 플러그인(`plugins/opera-plugin`) 신설 (sidebar_action 사이드바 지원)

### 요청
- "오페라 브라우져에서는 sidebar_action 이라고 해야 한다고 하네 / Permission 'sidePanel' is unknown. 이라고 하고 사이드 패널이 안나와"
- "plugins\basic-plugin 일반 크롬 지원으로 기본 개발로 하고 / plugins\opera-plugin 오페라 브라우져 지원으로 하고 오페라 특수만 변경 하고 기능은 basic-plugin 기능 그대로하고"

### 원인 분석
- `plugins/basic-plugin/public/manifest.json`은 크롬 표준 `sidePanel` permission + `side_panel` 키 사용 → 오페라가 `sidePanel` permission을 인식하지 못해 `Permission 'sidePanel' is unknown` 오류로 로드/사이드바 실패.
- 오페라 사이드바는 별도 권한 없이 `sidebar_action` 매니페스트 키(`default_panel` 필수)로 동작하며 크롬 `side_panel` 키와 호환되지 않아 단일 manifest 동시 지원이 불가능.

### 완료된 작업 목록
- `plugins/opera-plugin` 신설: `plugins/basic-plugin` 전체 소스 사본(`public/`, `src/`, HTML 엔트리, `vite.config.ts`, `tsconfig.json`, `.npmrc`).
- 오페라 특수 변경: manifest.json(`sidePanel` permission·`side_panel` 키 제거 → `sidebar_action` 키 추가, name/description 오페라 명시), `background.ts`(`chrome.sidePanel?.setPanelBehavior` 옵셔널 가드), `package.json`(name=opera-plugin), 소스 헤더 경로 주석 20개 + vite.config.ts 일괄 교체.
- 루트 `package.json`: `workspaces`에 `plugins/opera-plugin` 추가, `plugin:opera:dev` 신설, `build:all`에 opera 빌드 포함.
- 문서: `R-00460`(§1.4 오페라 지원 규정, §6 오페라 전용 매니페스트 명세, §7 검증 절차), `R-00410`(§2.1 병행 구조), `ADR-006` 신규.

### 변경된 파일
- `plugins/opera-plugin/` (신규 워크스페이스, basic-plugin 사본)
- `package.json` (루트 workspaces/스크립트)
- `docs/rule/R-00460 plugin-manifest-permissions.md`, `docs/rule/R-00410 plugin-architecture.md`
- `docs/decision/ADR-006-opera-plugin-separation.md` (신규)
- `docs/askLogs/ask-20260809100542.md` (신규)

### 검증 결과
- `npm run build --workspace=opera-plugin` 성공 → `dist/`에 `sidepanel.js`/`offscreen.js`/`background.js`/`content.js` + 오페라용 manifest.json 생성.
- `npm run build --workspace=basic-plugin` 성공 → 크롬 빌드 정상 유지.
- opera `dist/manifest.json`: `sidebar_action` 존재, `sidePanel`/`side_panel` 부재 확인.
- 오페라 실제 로드·사이드바 표시는 오페라 환경에서 수동 검증 예정. `offscreen` 등 추가 미지원 권한/API 확인 시 별도 폴백 대응 예정.

---

## 2026-08-09 | 클라이언트 4컬럼 재구성 + 플러그인 메시지 원장/파일 저장 + CLIENT_CONFIG_UPDATE/ACK 실패 근본 수정

### 요청
- "클라이언트 4컬럼 재구성(client_id/client_type/alias/connected_at, assigned_worker_id/custom_storage_path 제거) + 플러그인 메시지 원장 저장 + 기본 저장 경로 하위 `<clientId>/<action>/` 평면 구조 물리 파일 저장 + 관리자 UI 개선"
- 확정: 수집 액션 `CRAWL_DOCUMENT`/`CRAWL_PARTIAL`/`CRAWL_METADATA`/`CRAWL_BINARY` 세분화(기존 `CRAWL_LOG` 제거), 모든 액션 원장 저장, 별칭은 플러그인 환경설정 저장 시 서버 전송(`CLIENT_CONFIG_UPDATE`→ACK), `GET /api/db/plugin_messages` API
- 연속 세션: CLIENT_CONFIG_UPDATE 별칭 미저장·ACK 미수신 문제 근본 원인 수정

### 원인 분석
- **ws 수신 데이터가 Buffer**: `ws` `message` 이벤트 `data`는 기본적으로 Buffer이며, `logPluginComm(..., rawData.substring(0, 200))`에서 `rawData.substring is not a function` 예외 발생. 이 예외가 별칭 저장·ACK보다 먼저 던져져 후속 처리가 중단됨.
- **빈 catch 은폐**: 메시지 핸들러의 `catch {}`가 예외를 조용히 삼켜 `plugins_comm.log` 기록·원인 추적 불가.
- **로그 함수 예외 전파**: `logPluginComm`/`logServerSystem`이 자체 try/catch 없이 `appendFileSync` 호출 → 파일 쓰기 실패가 상위 파이프라인 중단.
- **구버전 테이블 스키마 비호환**: `CREATE TABLE IF NOT EXISTS`가 기존 `crawl_logs` 스키마를 갱신하지 않아 `action`/`file_path` 등 부재 → `no such column` 예외 가능.

### 완료된 작업 내용
- `database.ts`: clients 4컬럼 + `ensureClientsTableSchema()`(6컬럼→4컬럼 이관 재생성, alias ADD COLUMN), `plugin_messages` 원장 테이블/함수, `insertCrawlLog` action 파라미터, `ensureCrawlLogsTableSchema()`(crawl_logs 부재 7컬럼 ADD COLUMN)
- `index.ts`: ws 수신 `typeof data === "string" ? data : data.toString()` 변환, 원장 훅, `CLIENT_CONFIG_UPDATE`/CRAWL_* 4액션/`CHAT_MESSAGE`/`PING_TEST`, `GET /api/db/plugin_messages`, `PUT /api/db/clients/:clientId/config`, 빈 catch → WARN 로그, `logPluginComm` 호출부 try/catch 가드
- `logger.ts`: `logPluginComm`/`logServerSystem` 내부 `appendFileSync` try/catch 예외 격리
- `fileStorageService.ts`: `savePluginMessageToFile()` 평면 구조 저장
- 플러그인: SettingsTab/별칭 저장/ACK, CRAWL_PARTIAL/DOCUMENT/METADATA 전송 분리, ACK 중계
- admin: Client 4컬럼 + `PluginMessageRecord`, `NodeConfigModal` 별칭만 유지, `PluginMessagesPanel` "메시지 원장" 탭, `fetchPluginMessagesApi`
- 문서: R-00203(crawl_logs 전체 스키마·마이그레이션·plugin_messages·plugin_messages API), R-00204(로그 예외 격리·빈 catch 금지), R-00420(서버 수신 가드 4.4 신설), ADR-005 신규

### 변경된 파일
- `server/src/database.ts`, `server/src/index.ts`, `server/src/logger.ts`, `server/src/services/fileStorageService.ts`
- `plugins/basic-plugin/src/*` (types/TabBar/content/offscreen/chromeService/usePopupState/SettingsTab/sidepanel)
- `admin/src/*` (types, apiService, useAdminDbApi, useAdminSocket, DbManagerView, PluginMessagesPanel 신규, NodeConfigModal, App.tsx)
- `docs/rule/R-00203`, `R-00204`, `R-00420`, `docs/decision/ADR-005-ws-buffer-and-log-isolation.md`(신규), `docs/askLogs/ask-20260809090945.md`(신규)

### 검증 결과
- server tsc 0건, 플러그인/관리자 빌드 성공.
- clients 4컬럼 기존 데이터 보존, crawl_logs 최종 컬럼 `["id","client_id","log_message","timestamp","action","domain","worker_name","url","title","file_path","file_size"]` 확인.
- `CLIENT_CONFIG_UPDATE` → ACK 수신 + `clients.alias` 저장 + `plugins_comm.log` 기록 정상, `server_system.log` `rawData.substring` WARN 소거.
- 원장(`plugin_messages`) + 평면 구조 파일(`E:\up\WebCrawlServer\clients\<clientId>\<action>\`) 저장 정상, `GET /api/db/plugin_messages` 정상 응답.

---

## 2026-08-09 | 노드/워커 저장 경로 파일 브라우저 + 기본 저장 경로(configs.data_path) 폴백 연동

### 요청
- "노드 환경설정의 '노드 전용 물리 저장 경로 (선택)'과 워커 관리의 '워커 전용 파일 저장소 루트 경로'에 파일 브라우저 기능. 두 경로를 따로 지정하지 않았다면 데이터 저장 기본 저장 경로가 되어야 함."
- 확정: 기본 경로 우선순위 `configs.data_path` 우선(없으면 STORAGE_ROOT_PATH → ./storage) / 워커 저장소 루트 빈 값 허용 + 폴백

### 조사 결론
- 물리 파일 저장 경로는 `index.ts:1683` `saveCrawledContentToFile` 호출 1곳이 결정, `globalDefaultPath` 미전달로 기본이 `./storage` 하드코딩 — `configs.data_path`와 무연동. `fileStorageService`의 우선순위·빈 값 skip 로직은 이미 구현돼 기본 경로만 교체하면 충족.

### 완료된 작업 목록
- `index.ts`: `getConfigDataPath()` 신규(수정 시 `runStartupValidation()`도 재사용), `saveCrawledContentToFile`에 `globalDefaultPath: getConfigDataPath() || undefined` 전달, `GET /api/admin/storage/status` `storageRootPath`를 `data_path > STORAGE_ROOT_PATH > ./storage`로 반영.
- admin: `NodeConfigModal`·`WorkerManagerView`에 `defaultStoragePath` props + 각 저장 경로 입력 옆 `folder_open` 파일 브라우저 버튼/`DirectoryBrowserModal` 재사용 + placeholder 기본 경로 안내. 워커 빌더 저장소 루트 기본값 `''`(빈 값)로 변경. `App.tsx`에서 `configs.data_path` 추출해 `GcpClientsView`(2곳)·`WorkerManagerView`로 전달.
- `R-00208`(우선순위/구조/코드 예시/체크리스트), `R-00203`(data_path 실제 연동 명시) 갱신.

### 변경 파일 목록
- `server/src/index.ts`
- `admin/src/App.tsx`, `admin/src/components/views/GcpClientsView.tsx`, `admin/src/components/views/WorkerManagerView.tsx`, `admin/src/components/modals/NodeConfigModal.tsx`
- `docs/rule/R-00208 local-file-storage-system.md`, `docs/rule/R-00203 database.md`, `docs/askLogs/ask-20260809054709.md`(신규)

### 검증 결과
- server tsc 0건, admin 빌드 성공. 재기동 후 `storage/status` → `E:\up\WebCrawlServer`(data_path). data_path 임시 변경 → 즉시 반영 → 원복. 워커 생성 `storageRootPath:""` → success + `storage_root_path=''` 저장 확인 후 임시 워커 레코드·DB 파일 정리. `/`,`/clients`,`/workers`,`/settings` 200, health 9600.

---

## 2026-08-09 | serverlogs DB 신설(systemlog) + 초기 값 검증 루틴 + 파일 브라우저 버튼

### 요청
- "serverlogs 디비에 각종 로그테이블이 들어갈 것. 첫 번째로 systemlog 테이블(idx/메세지 종류/메세지/int, int 기본값 1). 서버 구동 시 환경 설정의 데이터 저장 디렉토리 실존 검증 → 없으면 생성 + systemlog에 부재/생성 기록, 있으면 기록 안 함. 데이터 저장 경로 입력 필드 옆에 파일 브라우저 버튼."
- 확정: systemlog 컬럼명 영문 관례(`id`/`msg_type`/`message`/`code` DEFAULT 1) / 파일 브라우저 전체 파일시스템 탐색 허용 / 부재 시 "부재 발견+생성 완료" 2건 기록

### 조사 결론
- 기존 로깅은 파일 기반(`logs/*.log`, R-00204)뿐, DB 기반 시스템 로그 저장소 없음. `configs.data_path`는 시드+관리 UI만 연동돼 실존 검증 로직 부재. `dbManagerService`가 `databases/` 루트를 스캔하므로 serverlogs.db는 DB 매니저에 자동 노출됨.

### 완료된 작업 목록
- `database.ts`: `databases/serverlogs.db` 인스턴스(WAL) + `systemlog` 테이블(`id` PK AUTOINCREMENT/`msg_type`/`message`/`code` DEFAULT 1) + `insertSystemLog()`/`getSystemLogs()`.
- `index.ts`: `runStartupValidation()`(data_path 실존 검증, 부재 시 systemlog 2건 기록 후 `mkdirSync(recursive)` 생성, 존재 시 미기록), `getDriveRoots()`, `GET /api/admin/fs/browse`(드라이브 루트/하위 디렉토리+부모 경로, 404/400 처리).
- admin: `BrowseDirectoryEntry`/`BrowseDirectoryResult` 타입, `browseDirectoryApi()`, `DirectoryBrowserModal.tsx` 신규(드라이브 루트→폴더 진입/상위 이동/현재 폴더 선택), `ConfigSettingsView.tsx` data_path 입력 옆 파일 브라우저 버튼.
- `R-00204 logging.md`(systemlog DB 로그 규칙·초기 값 검증), `R-00203 database.md`(serverlogs.db 스키마 + fs/browse API) 갱신.

### 변경 파일 목록
- `server/src/database.ts`, `server/src/index.ts`
- `admin/src/types/index.ts`, `admin/src/services/apiService.ts`
- `admin/src/components/modals/DirectoryBrowserModal.tsx`(신규), `admin/src/components/views/ConfigSettingsView.tsx`
- `docs/rule/R-00204 logging.md`, `docs/rule/R-00203 database.md`, `docs/askLogs/ask-20260809041645.md`(신규)

### 검증 결과
- server tsc 0건, admin 빌드 성공. 재기동 후 serverlogs.db 생성·systemlog 스키마 확인. data_path 존재 시 행 0(기록 없음). 임시 부재 경로로 변경 후 재기동 → 디렉토리 자동 생성 + systemlog 2건(`부재 발견`/`생성 완료`, code=1) 확인 → 원복, 임시 디렉토리 삭제, 재기동 후 행 2 유지. `fs/browse`(드라이브 루트 C:/D:/E:, 하위 목록+부모) 정상. `/settings` SPA 200.

---

## 2026-08-09 | configs 테이블 신설 + admin 환경 설정 메뉴

### 요청
- "서버 구동 시 data.db에 configs 테이블 없으면 생성, 있으면 각 설정 값 검증·누락 시 server/configs.json 디폴트 적용 (구조: 변수명/값/코멘트). 파일 저장 위치(data_path)도 configs 테이블로 시드 검증. admin에 환경 설정 메뉴로 값 수정 가능하게."
- 확정: 시드 + 관리 UI만 (data_path 서버 기능 연동은 별도), 값(value) 수정만 (코멘트 읽기 전용, 키 추가/삭제 미지원)

### 조사 결론
- `server/configs.json`에 `data_path`(값·설명)만 있고 읽는 코드 없음. `configs` 테이블 미존재. 스키마 초기화는 `initializeDatabase()`(index.ts:210/797) 담당.

### 완료된 작업 목록
- `database.ts`: `configs` 테이블(`key` PK / `value` / `description`) 생성 + `seedConfigDefaults()`(configs.json 누락 키만 INSERT 시드, 기존 값 유지) + `getAllConfigs()`/`updateConfigValue()`.
- `index.ts`: `GET /api/admin/configs`, `PUT /api/admin/configs/:key`(400/404 처리, 관리자 활동 로그) 추가.
- admin: `ConfigEntry` 타입·`settings` 탭, `apiService.ts` configs 2함수, `useAdminDbApi.ts` configs 로더/저장, `ConfigSettingsView.tsx` 신규(인라인 값 수정+피드백), Sidebar/Breadcrumb/App 라우트 연동.
- `R-00203 database.md`: configs 스키마·시드 규칙·API 목록 추가.

### 변경 파일 목록
- `server/src/database.ts`, `server/src/index.ts`
- `admin/src/types/index.ts`, `admin/src/services/apiService.ts`, `admin/src/hooks/useAdminDbApi.ts`
- `admin/src/components/views/ConfigSettingsView.tsx`(신규), `admin/src/components/layout/Sidebar/Sidebar.tsx`, `admin/src/components/layout/Breadcrumb/BreadcrumbBar.tsx`, `admin/src/App.tsx`
- `docs/rule/R-00203 database.md`, `docs/askLogs/ask-20260809025330.md`(신규)

### 검증 결과
- server tsc 0건, admin 빌드 성공. 서버 재기동 후 `GET /api/admin/configs` → data_path 시드 확인, PUT 변경 → DB 직접 조회 반영 확인(원복), 404/400 정상, `/settings` SPA 200, health 200.

---

## 2026-08-08 | PM2 시작 스크립트 포트 고정 + WebCrawlAdmin 잔재·레거시 정리

### 요청
- "askLogs/ask-20260808202642.md와 docs/tips/2026-08-08-pm2-single-process-and-node_modules-root-only.md를 종합해 프로젝트 재검토 후 미비점 수정 개선"
- 확정: 포트 고정 9600 / WebCrawlAdmin 잔재 제거 / admin/start.js 제거

### 조사 결론 (미비점 5건)
- M1(핵심): `start-server.js` `getAvailablePort()`가 9600 점유 중이면 9601로 이동 후 기존 서버 kill → 재실행 시 9600 불통, "하나만 떠 있는데 접속 불통" 혼동의 실질 원인.
- M2: 루트 `package.json`에 `WebCrawlAdmin` 잔재 스크립트(`admin:status/logs/stop`), `clean:pm2`도 참조.
- M3: `clean:all` = `rimraf package-lock.json && npm ci` → lock 삭제 후 npm ci 항상 실패.
- M4: 미사용 레거시 `admin/start.js` (admin 패키지 `start`/`admin:start`만 참조).
- M5: docs/tips 문서에 포트 이동 결함 미기재.

### 완료된 작업 목록
- `server/scripts/start-server.js`: `getAvailablePort()`·`net` import 제거, `SERVER_PORT`(기본 9600) 고정, 근거 한글 주석, pm2 start env 주입 유지.
- 루트 `package.json`: WebCrawlAdmin 3개 스크립트 제거, `clean:pm2` 정리, `clean:all`의 `npm ci` → `npm install`.
- `admin/start.js` 삭제, `admin/package.json` `start`/`admin:start` 제거(`server:start` skip 유지).
- `docs/tips/...pm2-single-process-and-node_modules-root-only.md`: §2.3 포트 결함·개선, §2.5 잔재 정리, §4 예방 규칙 보완.

### 변경 파일 목록
- `server/scripts/start-server.js`, 루트 `package.json`, `admin/package.json`, `admin/start.js`(삭제)
- `docs/tips/2026-08-08-pm2-single-process-and-node_modules-root-only.md`
- `docs/askLogs/ask-20260808204652.md` (신규)

### 검증 결과
- JSON 유효성·`node --check` 통과. **9600 점유 상태에서 `server:start` 재실행 → `server-started on port 9600`**, health `port: 9600 / success: true`, 9600 LISTEN, 9601 미사용(이전 코드라면 9601 이동했음). npm 11 워크스페이스 전파 skip 출력은 무해.

---

## 2026-08-08 | PM2 프로세스 1개 정상 근거 정리 + node_modules 루트 고정 (vite cacheDir)

### 요청
- "admin:start 후 server:start를 하면 PM2에 WebCrawlServer 하나만 떠 있어. 문제가 뭐지"
- "admin/node_modules이 생기면 안 된다. node_modules은 프로젝트 루트에만 존재해야 한다. 원인과 해결을 docs/tips에 문서화"

### 조사 결론
- `admin:start` = admin build + `server:start`, `server:start` = `start-server.js` 실행 → 두 명령 모두 `pm2 delete WebCrawlServer` + 동일 이름 `--name WebCrawlServer` 기동. admin은 별도 프로세스가 아니라 `server/public` 정적 서빙 → **1개만 뜨는 게 정상 설계**.
- `admin/node_modules`의 실체는 Vite deps 캐시 `node_modules/.vite` (기본 cacheDir이 실행 디렉토리 기준). server/plugin의 node_modules는 빈 폴더(패키지는 루트에만 호이스팅).

### 완료된 작업 목록
- `admin/vite.config.ts`·`plugins/basic-plugin/vite.config.ts`에 `cacheDir: resolve(__dirname, "../node_modules/.vite")`(admin)/`"../../node_modules/.vite"`(plugin) 추가 → 워크스페이스 하위 node_modules 생성 차단.
- 기존 워크스페이스 node_modules 3곳 삭제 (.gitignore에 node_modules/·**/node_modules/·.vite/ 등록, 미트래킹 확인).
- `docs/tips/2026-08-08-pm2-single-process-and-node_modules-root-only.md` 신규 작성 (실행 체인, 단일 프로세스명 근거, admin 접속 경로, WebCrawlAdmin 잔재 안내, vite cacheDir 해결, 예방 규칙).

### 변경 파일 목록
- `admin/vite.config.ts`, `plugins/basic-plugin/vite.config.ts`
- `docs/tips/2026-08-08-pm2-single-process-and-node_modules-root-only.md` (신규)
- `docs/askLogs/ask-20260808202642.md` (신규)

### 검증 결과
- admin·plugin 빌드 성공, 두 워크스페이스 `node_modules` 재생성 없음 확인
- 서버 코드 변경 없음(재시작 불필요), PM2 `WebCrawlServer` 상태 유지

---

## 2026-08-08 | 플러그인↔서버↔admin 연결 불통 근본 개선 (마운트 자동 등록 + 실시간 노드 푸시 + 오프스크린 생존 보장)

### 요청
- "플러그인 → WebCrawlServer 전송 시 '페이지 스크립트 미연결', admin 온라인 노드 0개·수집노드관리 미표시 → 근본 원인 점검 및 개선책"
- 확정: 서버+플러그인+admin 전체 근본 개선, admin 실시간 반영은 웹소켓 푸시 방식

### 조사 결론 (근본 원인 5건)
- `clients`/`crawl_logs` 빈 상태 (DB 복원 이력 2건) → admin 목록 0개
- 노드 DB 등록이 `CRAWL_LOG` 수신에만 의존 → 연결만으로는 목록 미등록
- `ensureOffscreenDocument`가 `onInstalled`/`onStartup`에서만 호출 → 크롬이 오프스크린을 닫으면 소켓 복구 불가 (clientId 변동 ee68b226→8da6a1b8)
- content script 미주입 탭에서 `COLLECT_FULL_DOM` 실패 시 안내만 반환 (fallback 없음)
- admin `loadClients`가 최초/재연결 시에만 호출

### 완료된 작업 목록
- 서버: `upsertClient`(ON CONFLICT DO UPDATE) 신규 + 마운트/close/CLIENT_STATUS_UPDATE 3지점 `broadcastClientsChanged()`(`CLIENTS_UPDATED`) 푸시.
- 플러그인: `background.ts` onMessage 진입부 `ensureOffscreenDocument()` 선행 호출(오프스크린 생존 보장), `chromeService.ts` `scripting.executeScript` content 주입 fallback + 1회 자동 재시도.
- admin: `App.tsx` `handleAdminMessage`에서 `CLIENTS_UPDATED` → `loadClients()` 실시간 재조회.

### 변경 파일 목록
- `server/src/database.ts`, `server/src/index.ts`
- `plugins/basic-plugin/src/background.ts`, `services/chromeService.ts`
- `admin/src/App.tsx`
- `docs/rule/R-00206` (§2.3), `R-00420` (§4.3), `R-00470` (§5)
- `docs/askLogs/ask-20260808200937.md` (신규)

### 검증 결과
- server/plugin/admin tsc 0건(admin은 기존 비차단 6건 무시), 3개 워크스페이스 빌드 성공, 번들 마커 확인
- pm2 재시작 + 헬스 200, `GET /api/db/clients?onlineOnly=true` → 플러그인 노드 `is_online: true` 자동 등록 확인 (무중단 재연결 + 마운트 upsert 동작 증명)
- admin 실시간 노드 갱신·오프스크린 생존 보장은 플러그인 재로드 후 사용자 최종 확인 필요

---

## 2026-08-08 | 관리자 대시보드 노드별 고유 전송 + 연결 확인

### 요청
- "플러그인의 서버 http://localhost:9600/ 와 소통하는 소켓이 어떤거고 고유한 프로세서인지 확인 하는 방법있어? 연결 확인을 하고 브라우져 플러그인 마다 고유한 전송을 하려고하는거야"
- 확정: 관리자 대시보드에서 노드별 전송 + UUID 직접 입력

### 조사 결론
- 소켓은 플러그인 프로필당 1개 영구 고유 소켓(`ws://localhost:9600?clientId=<UUID>&clientType=plugin`), UUID 영속 → clientId = 고유 프로세서 1:1 (서버 중복 정화 4001)
- 특정 노드 1:1 타깃 전송 인프라(서버 targetId 릴레이 + admin dispatchCommand + 콘솔 UUID 입력)는 기존 구현 존재 → 온라인 노드 확인·응답 확인 UI만 보강

### 완료된 작업 목록
- `GcpControlConsoleView.tsx`: "온라인 노드 연결 확인" 섹션(별칭·UUID·사이드바 배지 + 적용/복사 버튼), "전송 결과 (실시간 수신 패킷)" 섹션(PONG_RESPONSE 성공 강조), 온라인 노드 수 배지, 연결 확인 방법 안내 캡션 추가.
- `App.tsx`: `/console` 라우트에 `clients`, `socketMessages` props 전달.
- `R-00206`: §6 노드별 고유 전송 절차(온라인 확인→UUID 지정→1:1 릴레이→응답 확인) 및 §7 체크리스트 반영.

### 변경 파일 목록
- `admin/src/components/views/GcpControlConsoleView.tsx`, `admin/src/App.tsx`
- `docs/rule/R-00206 server-node-session-management.md`
- `docs/askLogs/ask-20260808153900.md` (신규)

### 검증 결과
- admin tsc: 신규 파일 0건 (기존 비차단 에러 6건 무시), `npm run build --workspace=admin` 성공
- 서버 재시작 후 `/health`·`/console`·`/` 200, 새 번들(index-DL9C4Igz.js) 내 UI 마커 확인
- `/console` 동작(노드 목록·적용·전송·PONG 응답)은 사용자 최종 확인 필요

---

## 2026-08-08 | 플러그인 디버깅 탭 하단 터미널 콘솔 추가

### 완료된 작업 목록
- `DebugTab.tsx` 하단에 admin 네트워크 모니터링 스타일의 터미널 콘솔을 추가했습니다: 리사이즈 바(드래그로 높이 조절, 기본 200px) → 헤더(콘솔 소거/자동 스크롤 토글) → 로그 출력 영역(타입별 색상·타임스탬프·자동 스크롤) → `>` 명령 입력 줄.
- `usePopupState.ts`에 콘솔 상태·로직을 추가했습니다: `terminalLogs`/`autoScroll`/`commandInput`/`consoleHeight`, 수신 패킷(`SOCKET_PACKET_RECEIVED`)의 콘솔 로그 기록, 동작 로그(소켓 상태/DOM 수집/디버그 전송/탭 전환), 콘솔 명령어 `help`/`clear`/`status`/`ping`/`send <json>`.
- `chromeService.ts`에 범용 `sendSocketPacket()`을 신규 추가하고 `sendDebugMessage`를 `CRAWL_LOG` 봉투 래퍼로 리팩토링했습니다.
- `offscreen.ts`의 PONG 응답에 nullable 가드(`socket && readyState === OPEN`)를 추가해 플러그인 tsc 전체 0건을 달성했습니다.

### 변경 파일 목록
- `plugins/basic-plugin/src/types/index.ts`, `hooks/usePopupState.ts`, `services/chromeService.ts`, `components/tabs/DebugTab.tsx`, `sidepanel.tsx`, `popup.tsx`, `offscreen.ts`
- `docs/rule/R-00440 plugin-ui-ux.md` (디버깅 탭 터미널 콘솔 규격 §3.4 반영)
- `docs/askLogs/ask-20260808153115.md` (신규)

### 검증 결과
- plugin tsc EXIT 0, `npm run build --workspace=basic-plugin` 성공 (`sidepanel.js` 207.86 kB)
- 브라우저 확장 재로드 후 디버깅 탭 콘솔 동작은 사용자 최종 확인 필요

---

## 2026-08-08 | 네트워크 모니터링 패널 순번·설명 라벨 + 콘솔 명령 설명/실제 파라미터/구분선 표기

### 완료된 작업 목록
- `/network` 4개 패널 드롭다운 옵션을 레지스트리(`DiagCommandMeta { command, label, description }`) 기반으로 전환하고, 각 옵션 라벨을 `N. 명령명 — 기능 설명` 형태(순번 + 명령명 + 설명)로 표시했습니다. 예) `12. 시스템 Listen 포트 — 컴퓨터 전체에서 접속 대기 중(LISTEN)인 포트 및 PID 스캔`.
- 콘솔 출력을 `[실행] <명령명> — <설명>` → `[진행] ...` → `$ <실행된 전체 명령>` → `--------------` → 결과 → `--------------` → `[완료] ...` 순으로 개선해 명령이 정확히 어떻게 들어갔는지 구분되도록 했습니다.
- 서버 진단 케이스 15종의 `executedCommand`를 실제 수행 스크립트/전체 셸 명령으로 채웠습니다(Node.js 계열: `Node.js: os.cpus() + ...` 형태, `node_sockets`: `tasklist ...; netstat -ano` 2단계 전체 표기).

### 변경 파일 목록
- `admin/src/components/views/NetworkMonitorView.tsx`
- `server/src/index.ts`
- `docs/rule/R-00202 monitoring.md` (드롭다운 표기 규격 + 터미널 콘솔 출력 규격 반영)
- `docs/askLogs/ask-20260808151324.md` (신규)

### 검증 결과
- server tsc EXIT 0, admin tsc 신규 에러 0건, vite build 성공(`NetworkMonitorView-BWy8YCzg.js`)
- server dist 재컴파일 + pm2 재시작 → 헬스 200
- API 수동: 진단 명령 17종 전체에서 `executedCommand`가 빈 문자열 없이 전체 명령/스크립트로 반환됨
- `/network` 드롭다운 라벨·콘솔 구분선 표기는 브라우저 최종 확인 필요

---

## 2026-08-08 | 네트워크 모니터링 소켓 검증 명령 2종 추가 (Node 소켓 목록 + 시스템 Listen 포트)

### 완료된 작업 목록
- `/network` "패널 3 - 플러그인 소켓 검증" 드롭다운에 `Node 소켓 목록`(`node_sockets`)과 `시스템 Listen 포트`(`system_listen_ports`) 옵션을 추가했습니다.
- `node_sockets`: netstat엔 프로세스명이 없어 빈 결과였던 기존 `findstr node` 구현을, `tasklist`로 node.exe PID를 수집한 뒤 `netstat -ano`와 교차 매칭하는 방식으로 재구현했습니다. `{ nodePids, socketCount, sockets }` 구조 반환(비-Windows: `pgrep -x node` + `ss -tunap`).
- `system_listen_ports`: PID가 없던 `netstat -an` 구현을 `netstat -ano | findstr LISTENING`으로 변경해 포트와 PID를 함께 스캔하도록 수정했습니다.

### 변경 파일 목록
- `server/src/index.ts`
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/rule/R-00202 monitoring.md` (진단 명령 스펙 반영)
- `docs/askLogs/ask-20260808145313.md` (신규)

### 검증 결과
- server tsc EXIT 0, admin tsc 신규 에러 0건, vite build 성공(`NetworkMonitorView-DTiqHnTi.js`)
- 재시작 + 헬스 200
- API 수동: `node_sockets` → 서버 PID 53036의 9600 포트 라인 4건 교차 매칭 확인, `system_listen_ports` → 71개 LISTENING 라인(포트+PID) 확인
- 패널 3 드롭다운 동작은 브라우저 최종 확인 필요

---

## 2026-08-08 | DB 관리 메뉴 신설 (워커 & DB 매니저 → 워커 관리 + DB 관리)

### 완료된 작업 목록
- 사이드바 "워커 & DB 매니저" 메뉴를 "워커 관리"로 변경하고, 신규 "DB 관리" 메뉴(`/db`, storage 아이콘)를 추가했습니다. Breadcrumb/라우팅/activeTab(`db`)을 일괄 반영했습니다.
- DB 관리는 "일반 SQLite 관리툴 수준"으로 설계해 6가지 기능을 구현했습니다: SQL 쿼리 실행기, DB·테이블 브라우저, 데이터 그리드 행 CRUD, 스키마 편집(테이블 생성/삭제/컬럼 추가), 백업/복원(생성·목록·다운로드·파일 복원·업로드 복원), 스토리지 모니터링(용량 카드+DB 크기 막대).
- 서버에 `dbManagerService.ts` 신규 구현 + `/api/admin/db/*` REST 라우트 17종을 `index.ts`에 추가했습니다. 쓰기/DDL 실행 시 관리자 활동 로그를 남기며, `dbRel`은 `databases/`·`databases/workers/` 화이트리스트 검증을 거칩니다.
- **경로 버그 수정**: dist/services 하위에서 `..` 2번으로 계산되어 `server/databases`를 가리키던 `dbManagerService.ts`·`workerEngineService.ts`를 `..` 3번으로 수정해 프로젝트 루트 `databases`를 정확히 참조하도록 했습니다.
- `listBackups`의 원본 DB 식별(`sourceDbRel`)을 실제 DB 파일명 매칭 기반으로 개선했습니다.
- admin은 `DbManagerView`(DB 선택+기능 탭)와 패널 5종, 재사용 `DbDataGrid`, `useDbManager` 훅, `dbApiService`를 신규 작성했습니다.

### 변경 파일 목록
- `server/src/services/dbManagerService.ts` (신규), `server/src/services/workerEngineService.ts`, `server/src/index.ts`
- `admin/src/types/index.ts`, `admin/src/services/dbApiService.ts`, `admin/src/hooks/useDbManager.ts`, `admin/src/utils/format.ts` (신규)
- `admin/src/components/tables/DbDataGrid.tsx`, `admin/src/components/views/db/*.tsx` 6종 (신규)
- `admin/src/components/layout/Sidebar/Sidebar.tsx`, `admin/src/components/layout/Breadcrumb/BreadcrumbBar.tsx`, `admin/src/App.tsx`
- `docs/askLogs/ask-20260808141852.md` (신규)

### 검증 결과
- server `tsc --noEmit` EXIT 0, admin `tsc --noEmit` 신규 에러 0건, `vite build` 성공(`DbManagerView-BB9fAA0S.js` 별도 chunk)
- `npm run admin:start` 재시작 + 헬스 200
- API 수동 검증: 파일/테이블/스키마/SELECT/행 CRUD/테이블 생성·삭제/컬럼 추가/백업 생성·목록·다운로드·복원(파일+업로드)/storage-info 모두 정상, Path Traversal은 화이트리스트로 거부
- `/db` UI 동작은 브라우저 최종 확인 필요

---

## 2026-08-08 | /network 빈 화면 복구 (TDZ 선언 전 참조 에러)

### 완료된 작업 목록
- `admin/src/components/views/NetworkMonitorView.tsx`에서 `handleClearSocketEvents`가 `addTerminalLog`보다 앞에 정의되어 발생한 TDZ(선언 전 참조) 에러로, NetworkMonitorView 마운트 시 React 전체 앱이 언마운트되어 빈 화면이 되는 문제를 수정했습니다.
- `handleClearSocketEvents`를 `addTerminalLog` 정의 직후로 이동해 해결했습니다.
- admin에 `tsc --noEmit` 타입 체크를 적용해 TS2448(선언 전 사용) 재발을 방지했습니다(기존 타입 표기 에러는 vite가 타입 체크를 안 해 동작 영향 없음, 범위 밖).

### 변경 파일 목록
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/askLogs/ask-20260808045408.md` (신규)

### 검증 결과
- `tsc --noEmit` → TS2448 없음, `vite build` 성공
- `npm run admin:start` 재시작 + 헬스 200, 새 번들 `index-NTFIeQLj.js`·NetworkMonitorView chunk HTTP 200
- `/network` 빈 화면 해소는 브라우저 최종 확인 필요

---

## 2026-08-08 | 진단 패널 정리 + 웹소켓 이벤트 소거 + 콘솔 높이 드래그 조절

### 완료된 작업 목록
- 패널 2의 "물리 저장소 디스크"(`disk_status`) 항목을 UI(`NetworkMonitorView.tsx` 옵션·switch case)와 서버(`index.ts` case) 양쪽에서 제거해 wmic 실행 및 한글 깨짐 근원을 함께 제거했습니다.
- 최근 웹소켓 이벤트 헤더에 "이벤트 소거" 버튼을 추가했습니다. 뷰 내부 `hiddenEventKeys` Set으로 소거된 이벤트만 제외하고, 이후 도착하는 새 이벤트는 다시 표시됩니다(부모 상태 미변경).
- 터미널 콘솔을 `flex-1`(콘텐츠만큼 커지며 브라우저가 길어지던 원인)에서 고정 높이(기본 320px)로 변경하고, 상단 테두리 리사이즈 바를 포인터 드래그로 잡아 높이를 조절하도록 구현했습니다. 최소 160px, 상한은 화면 높이 기준 동적 값(`window.innerHeight - 100`)이며 드래그 중 텍스트 선택을 방지합니다.

### 변경 파일 목록
- `server/src/index.ts`
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/askLogs/ask-20260808043938.md` (신규)

### 검증 결과
- server tsc build·admin vite build 성공, `npm run admin:start` 재시작 + 헬스 200
- `disk_status` 진단 → "지원되지 않는 진단 명령입니다" 응답(서버 제거 확인)
- 새 번들 `index-CiLUWm3c.js` 서빙, NetworkMonitorView chunk HTTP 200
- 이벤트 소거·콘솔 높이 드래그는 브라우저 최종 확인 필요

---

## 2026-08-08 | 진단 명령 실행 문자열 표시 + 출력 개행 정리 + 한글 인코딩 해결

### 완료된 작업 목록
- `server/src/index.ts`의 `runShellCommand`에 `euc-kr` 인코딩 옵션을 추가해 Windows netstat 등 로케일 의존 명령의 CP949 한글 출력("활성 연결" 헤더)이 깨지지 않도록 해결했습니다(`TextDecoder('euc-kr')` 디코딩, 영문 로케일과 호환).
- 진단 핸들러의 셸 실행 case를 실행 문자열을 `executedCommand` 변수로 저장·재사용하는 패턴으로 리팩터링하고, 응답을 `data: { command, executedCommand, output }`으로 확장했습니다.
- `admin/src/components/views/NetworkMonitorView.tsx` 콘솔 출력 영역에 `whitespace-pre-wrap`을 추가해 netstat 출력이 한 줄로 붙던 문제를 해결하고, `executeDiagnosticCommand`에서 `$ netstat -ano` 형태의 실행 명령어 표시를 추가했습니다(기존 응답 형식 호환).

### 변경 파일 목록
- `server/src/index.ts`
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/askLogs/ask-20260808040925.md` (신규)

### 검증 결과
- server tsc build·admin vite build 성공, `npm run admin:start` 재시작 + 헬스 200
- `netstat_all` 진단 → `executedCommand: "netstat -ano"`, output 개행 포함, 첫 줄 "활성 연결" 정상 디코딩
- `disk_io_2s` 진단 → `{command, executedCommand:'', output:{...}}` 구조 호환 확인
- 새 번들 `index-BScokWZf.js` 서빙, NetworkMonitorView chunk HTTP 200

---

## 2026-08-08 | 네트워크 진단 명령 패널 드롭다운 전환

### 완료된 작업 목록
- `admin/src/components/views/NetworkMonitorView.tsx`의 네트워크 진단 명령 패널에서 28개 버튼으로 구성된 4개 카드 그리드를 제거하고, 패널 1~4 각각을 `<select>` 드롭다운 1개로 교체해 화면을 압축했습니다(사용자 확인: 그룹별 select 4개 + 선택 즉시 실행).
- 각 select는 플레이스홀더 옵션(`value=""`)을 기본으로, 명령 옵션 선택 시 `handleButtonClick(action)`으로 즉시 실행 후 플레이스홀더로 리셋되어 같은 명령 재실행이 가능합니다.
- 기존 `ControlConsoleView.tsx`의 select 스타일 패턴을 재사용하고 그룹명 라벨·`aria-label`을 부여했습니다. `runningCommand` 동안 select 영역을 비활성화해 중복 실행을 차단합니다(R-00302 준수).

### 변경 파일 목록
- `admin/src/components/views/NetworkMonitorView.tsx`
- `docs/askLogs/ask-20260808035108.md` (신규)

### 검증 결과
- `vite build` 성공, `npm run admin:start` → PM2 online + `server-started on port 9600`
- `GET /` 새 번들 `index-CmKN3rUJ.js` 참조, NetworkMonitorView chunk HTTP 200, 헬스체크 200

---

## 2026-08-08 | admin:start 콘솔 창 깜빡임 재발 해결 (셸 래퍼 제거 + --no-vizion)

### 완료된 작업 목록
- 1차 수정(windowsHide 추가)으로도 콘솔 창이 계속 나타나, 프로세스 시작 이벤트 추적(Win32_Process)으로 원인 3곳을 규명했습니다. ① `spawnSync(npx.cmd ...)`의 npx 배치 래퍼 내부 `cmd /c pm2 ...` 재실행 ② PM2 데몬의 vizion 기능(`git status`/`git tag`) ③ PM2 데몬의 `taskkill`.
- `server/scripts/start-server.js`에서 셸 래퍼 사용을 완전히 제거하고 `node.exe`로 tsc/pm2 CLI를 직접 실행(`windowsHide: true` 유지)하도록 재작성했습니다.
- PM2 시작 옵션에 `--no-vizion`을 추가해 데몬의 git 호출을 비활성화하고, 기존 프로세스의 vizion 환경을 없애기 위해 `pm2 delete` 후 `--no-vizion`으로 `pm2 start`하는 방식으로 변경했습니다.
- 재작성 중 발생한 `resolve is not defined`(import 누락) 에러를 `path.resolve`로 보정했습니다.
- `npm run admin:start`는 npm 워크스페이스 전파로 **admin 워크스페이스의 `admin:start`(`node start.js`)가 실행**되며, `admin/start.js`가 `start-server.js`를 spawn하는 흐름임을 확인했습니다(루트 `admin:start`가 아님).

### 변경 파일 목록
- `server/scripts/start-server.js` (셸 래퍼 제거·node 직접 실행·--no-vizion)
- `docs/askLogs/ask-20260808033727.md` (신규)

### 검증 결과
- `npm run admin:start` → admin/start.js → start-server.js → PM2 start 완료, `server-started on port 9600`
- PM2 `WebCrawlServer` online(새 PID), `pm2 describe`의 `version: N/A` → vizion 비활성화 확인
- `GET /api/admin/network/health` → `{"success":true,...,"port":9600}`
- 콘솔 창 깜빡임 해소는 사용자 터미널에서 `npm run admin:start` 재실행으로 최종 확인 필요

---

## 2026-08-08 | admin:start 실행 시 콘솔 창 깜빡임 제거 (start-server.js windowsHide)

### 완료된 작업 목록
- `npm run admin:start` 시 콘솔 창이 3회 깜빡이며 실행되고 사라지는 현상을 `server/scripts/start-server.js`의 `spawnSync` 3곳에 `windowsHide: true`를 추가해 해결했습니다. 원인은 `spawnSync`가 셸(`npm.cmd`/`npx.cmd`) 실행 시 콘솔 창을 새로 생성하기 때문입니다.

### 변경 파일 목록
- `server/scripts/start-server.js` (spawnSync 3곳 옵션 추가)
- `docs/askLogs/ask-20260808032708.md` (신규)

### 검증 결과
- `npm run admin:start` → 서버 빌드 정상, PM2 online(새 PID), `server-started on port 9600`, 헬스체크 200

---

## 2026-08-08 | netstat 진단 시 콘솔 창 깜빡임 제거 (windowsHide)

### 완료된 작업 목록
- admin 네트워크 모니터링 패널 1의 netstat 버튼 클릭 시 Windows 콘솔 창이 깜빡이고 사라지는 현상을 `runShellCommand()`에 `windowsHide: true`를 추가해 해결했습니다. 원인은 `child_process.exec`가 셸 사용 시 콘솔 창을 새로 생성하기 때문입니다.

### 변경 파일 목록
- `server/src/index.ts` (`runShellCommand` 옵션 1줄 추가)
- `docs/askLogs/ask-20260808032053.md` (신규)

### 검증 결과
- 헬스체크 200(port 9600), `netstat_9600`·`netstat_listening` 진단 응답 정상, PM2 online

---

## 2026-08-08 | docs/todo.md 완료 작업 정리 및 초기화

### 완료된 작업 목록
- `docs/todo.md`에 누적된 완료 작업 이력이 모두 `docs/askLogs/`에 기록되어 있음을 매핑으로 확인하고(빈 화면 복구→ask-20260808023936, 진단 확장·API→ask-20260807124500, 2026-08-08 예정 작업 4건→ask-20260808070000), `docs/todo.md`를 초기 상태로 비웠습니다.

### 변경 파일 목록
- `docs/todo.md`
- `docs/askLogs/ask-20260808031310.md` (신규)

### 검증 결과
- `docs/todo.md` 구조(`현재 작업`·`완료된 작업`·`예정 작업`) 유지, 내용 "(없음)"으로 초기화 확인

---

## 2026-08-08 | 플러그인 포트 통일(9700→9600) 및 네트워크 진단 보강

### 완료된 작업 목록
- `plugins/basic-plugin/vite.config.ts`의 `__SERVER_PORT__` 기본값과 `src/config/pluginConfig.ts` 폴백 포트를 9700→9600으로 통일하고 플러그인 dist를 재빌드했습니다.
- 9700 포트에 별도로 떠 있던 수동 실행 서버 프로세스(`node server/dist/index.js`, PID 25160)를 종료해 단일 서버 인스턴스(PM2, 9600)로 통일했습니다.
- `server/src/index.ts` 진단 명령 보강:
  - `disk_io_2s`의 netstat 실행 버그를 물리 디스크 쓰기 벤치마크(MB/s)로 교체했습니다.
  - `cleanup_dead_sockets` 서버 구현(비OPEN 데드 소켓 강제 종료·세션 제거)을 추가했습니다.
  - `avg_rtt` 구현(PING_TEST 발신 시각 기록 + PONG_RESPONSE 수신 시 RTT 링 버퍼 20개 누적, 평균/최소/최대/최근 RTT 집계)을 추가했습니다.
- `admin/src/components/views/NetworkMonitorView.tsx` 개선:
  - `runningCommand` 상태로 실행 중 배지 표시 및 명령 버튼 비활성(흐림) 처리, 중복 실행 차단을 추가했습니다.
  - 진단 응답을 4,000자로 제한해 요약 출력하고 소요 시간·출력 길이를 로그로 남기도록 개선했습니다.
  - '세션 1:1 핑' 버튼을 실제 1:1 세션 핑(대상 ID 입력) 동작으로 연결했습니다.

### 변경 파일 목록
- `plugins/basic-plugin/vite.config.ts`
- `plugins/basic-plugin/src/config/pluginConfig.ts`
- `plugins/basic-plugin/src/offscreen.ts` (주석)
- `plugins/basic-plugin/src/types/env.d.ts` (주석)
- `server/src/index.ts`
- `admin/src/components/views/NetworkMonitorView.tsx`
- `server/dist/*`, `server/public/*`, `plugins/basic-plugin/dist/*` (빌드 산출물, git 제외 대상)

### 검증 결과
- 플러그인 빌드 후 `dist/pluginConfig.js`에 `port:9600` 내장 확인
- `POST /api/admin/network/diagnostic` → `disk_io_2s`: `{"durationSeconds":2.01,"writtenBytes":489684992,"writeMbps":232.22}`
- `POST /api/admin/network/diagnostic` → `cleanup_dead_sockets`: `{"cleaned":0,"remaining":1}`
- `POST /api/admin/network/diagnostic` → `avg_rtt`: 연결 플러그인 노드 1대 감지(`sampleCount:0`, 샘플 미발생)
- `GET /api/admin/network/health` → 200, `{"success":true,"data":{"port":9600,...}}`
- admin·server `tsc/vite build` 에러 없음, PM2 `WebCrawlServer` online (새 PID)

---

## 2026-08-08 | 관리자 대시보드 빈 화면 복구 (admin:start 프로덕션 번들 강제 빌드)

### 완료된 작업 목록
- `server/public/index.html`이 Vite 개발 모드 진입점(`/@vite/client`, `/src/main.tsx`)으로 오염되어 관리자 UI가 빈 화면으로 표시되는 문제를 진단하고, admin 프로덕션 빌드 재수행으로 `/assets/index-*.js` 참조를 복원했습니다.
- 루트 `package.json`의 `admin:start` 스크립트를 수정하여 서버 기동 전에 admin 빌드가 선행되도록 보강했습니다.
- PM2 `WebCrawlServer` 프로세스를 재기동하고 9600 포트의 관리자 UI·SPA 라우트·REST API 응답을 검증했습니다.

### 변경 파일 목록
- `package.json` (루트, `admin:start` 스크립트)
- `server/public/*` (admin 빌드 산출물 재생성, git 제외 대상)

### 검증 결과
- `GET /` → 200, `/assets/index-fiF9j854.js` 참조 확인
- SPA 라우트 `/clients`, `/network`, `/workers` → 200 text/html
- `GET /api/admin/network/health` → `{"success":true,"data":{"port":9600,...}}`

---

## 2026-08-07 | 네트워크 모니터링 진단 패널 확장

### 완료된 작업 목록
- `admin/src/components/views/NetworkMonitorView.tsx`에서 네트워크 진단 명령 패널을 4개 그룹으로 확장했습니다.
- `server/src/index.ts`에 `/api/admin/network/diagnostic` 및 `/api/admin/network/token-push` REST API를 추가했습니다.

---

## 2026-08-06 | Phase 2~6 전면 구현 완료

### 완료된 작업 목록
