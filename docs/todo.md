# 실행 계획 체크리스트 (docs/todo.md)

## 현재 작업
- (없음 — ask-20260809100542 오페라 플러그인 사이클 완료)

## 완료된 작업 (ask-20260809100542)
- [x] plugins/opera-plugin 신설 (basic-plugin 전체 사본, node_modules/dist 제외)
- [x] 오페라 특수 변경: manifest.json(sidePanel 제거 + sidebar_action 추가), background.ts(chrome.sidePanel 옵셔널 가드), package.json(name=opera-plugin), 소스 헤더 경로 주석 일괄 교체
- [x] 루트 package.json: workspaces에 opera-plugin 추가, plugin:opera:dev 신설, build:all 포함
- [x] 문서 갱신: R-00460(§1.4/§6/§7 오페라 규정), R-00410(§2.1 병행 구조), ADR-006 신규
- [x] 검증: opera/basic 플러그인 빌드 성공, dist/manifest.json sidebar_action 존재 + sidePanel/side_panel 부재 확인
- [x] 이력 기록: docs/askLogs/ask-20260809100542.md, docs/todo.history.md, docs/ask.md 초기화

## 예정 작업
- [ ] 오페라 실제 로드 테스트(opera://extensions/) 및 사이드바 표시 확인
- [ ] 오페라에서 offscreen/기타 권한 미지원 확인 시 폴백 대응 (ADR-006 §3-5)

## 완료된 작업 (ask-20260809)
- [x] 서버 database.ts: clients 4컬럼 재구성 + 마이그레이션(6컬럼→4컬럼, alias ADD COLUMN), plugin_messages 테이블/함수, insertCrawlLog action 파라미터, ensureCrawlLogsTableSchema 전체 컬럼(domain/action/worker_name/url/title/file_path/file_size) 마이그레이션
- [x] 서버 fileStorageService.ts: savePluginMessageToFile 평면 구조 저장 함수
- [x] 서버 index.ts: 저장경로 로직 수정, 원장 저장 훅, CRAWL_* 4액션 분기, GET /api/db/plugin_messages, ws 수신 Buffer → string 변환, 빈 catch → WARN 로그, logPluginComm 호출부 예외 가드
- [x] 서버 logger.ts: logPluginComm/logServerSystem 내부 appendFileSync 예외 격리
- [x] 플러그인: types/TabBar/content/offscreen/chromeService/usePopupState/SettingsTab/sidepanel
- [x] admin: Client 타입 정리, NodeConfigModal 별칭만 유지, props 체인 정리, plugin_messages API 연동, PluginMessagesPanel/DbManagerView "메시지 원장" 탭
- [x] 문서/규칙 갱신 (R-00203/204/420, ADR-005 신규)
- [x] 검증: server tsc, plugin/admin 빌드, 기동 테스트(마이그레이션/별칭/ACK/원장/파일/plugins_comm.log/WARN 소거)
- [x] 이력 기록: docs/askLogs/ask-<ts>.md, docs/todo.history.md, docs/ask.md 초기화

## 예정 작업 (ask-20260809)
- (없음)
