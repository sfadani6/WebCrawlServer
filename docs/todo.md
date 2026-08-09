# 실행 계획 체크리스트 (docs/todo.md)

## 현재 작업
- (없음 — ask-20260809205823 기본 탭 개편 사이클 완료)

## 완료된 작업 (ask-20260809205823)
- [x] 기본 탭 개편: DOM 전송(라디오 전체/요소선택/프레임), 이미지 수집, 액션 실행(미개발 disabled) 아코디언+카드 구성 (BasicTab.tsx)
- [x] 요소 선택 모드: content.ts 파란 테두리 오버 → 클릭 시 "전송" 플로팅 버튼 → outerHTML을 CRAWL_PARTIAL로 전송, ESC 종료 + ELEMENT_PICKER_ENDED 통지
- [x] 프레임 수집: GET_FRAME_INFO(iframe 개수 조회, 미존재 시 비활성화) + COLLECT_FRAME_DOM(같은 오리진 fullDom/크로스 오리진 src 참조)
- [x] 이미지 수집: COLLECT_IMAGES(fetch→base64 성공 시 CRAWL_IMAGE binary_base64, 크로스 오리진 실패 시 CRAWL_IMAGE json URL 참조, 최대 50개)
- [x] 터미널 공통화: TerminalConsole.tsx 신설 — 모든 탭 하단 맨 아래 고정 배치 + 외곽 아웃라인/스크롤바 개선, DebugTab은 디버그 송출 카드만 유지
- [x] 현재 페이지 URL 자동 갱신: chrome.tabs.onActivated + onUpdated(status complete) 리스너로 활성 탭 감시 (usePopupState refreshCurrentTabInfo)
- [x] chromeService.ts 공통 명령 헬퍼(sendCommandToActiveTab) + 요소/프레임/이미지 요청 함수, types에 CrawlImagePayload/CrawlElementPayload 추가
- [x] 서버: CRAWL_IMAGE 액션 분기 + saveCrawledImage(images/<domain>/<timestamp>-<index>.<ext>, 실패 .url 참조 저장, pageUrl 도메인 분류)
- [x] opera-plugin 소스 동기화 (10개 파일, 헤더 경로 주석 교체)
- [x] 검증: basic/opera tsc+eslint+빌드 통과, 서버 tsc+빌드+pm2 재시작 안정 확인
- [x] 이력 기록: docs/askLogs/ask-20260809205823.md, docs/todo.history.md, docs/ask.md 초기화

## 예정 작업 (ask-20260809205823)
- [ ] 브라우저에서 수동 테스트: 요소 선택(파란 테두리/전송 버튼/outerHTML 전송), 프레임 비활성화, 이미지 저장, URL 자동 갱신
- [ ] 액션 실행 기능 설계 및 구현 (미개발 상태 유지)

## 완료된 작업 (ask-20260809100542)
- [x] plugins/opera-plugin 신설 (basic-plugin 전체 사본, node_modules/dist 제외)
- [x] 오페라 특수 변경: manifest.json(sidePanel 제거 + sidebar_action 추가), background.ts(chrome.sidePanel 옵셔널 가드), package.json(name=opera-plugin), 소스 헤더 경로 주석 일괄 교체
- [x] 루트 package.json: workspaces에 opera-plugin 추가, plugin:opera:dev 신설, build:all 포함
- [x] 문서 갱신: R-00460(§1.4/§6/§7 오페라 규정), R-00410(§2.1 병행 구조), ADR-006 신규
- [x] 검증: opera/basic 플러그인 빌드 성공, dist/manifest.json sidebar_action 존재 + sidePanel/side_panel 부재 확인
- [x] 이력 기록: docs/askLogs/ask-20260809100542.md, docs/todo.history.md, docs/ask.md 초기화

## 예정 작업 (ask-20260809100542)
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
