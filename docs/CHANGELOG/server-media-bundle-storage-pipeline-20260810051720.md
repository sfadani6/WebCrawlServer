# 서버 미디어 번들 저장 + xvideos 콘텐츠 수집 파이프라인 구축 (ask-20260810051720)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260810051720.md`

## 완료 내용
- 서버 fileStorageService: 실패 참조 `.url`→`.txt`(clickUrl/title 라인), `mimeToExtension` mp4/webm 추가, 신규 `saveCrawledMediaBundle()`(txt+자산 일괄 저장·실패 자산 스킵·savedDir/savedFiles 반환)
- 서버 index.ts: `GET_STORAGE_LOCATION`→`STORAGE_LOCATION_RESPONSE`(absDir/relDir) 신설, CRAWL_IMAGE assets 배열 감지 시 번들 저장+`CRAWL_MEDIA_SAVED` ACK 응답
- 플러그인 content.ts: `collectXvideosMediaEntries()`(`.thumb-block` 상한 없음·no-img 제외·clickUrl 중복 제거·eid/clickUrl/title/sfw/메인/preview 수집) + `COLLECT_XVIDEOS_MEDIA` 핸들러
- 플러그인 offscreen.ts: `mediaAckWaiters`(60s)/`storageLocationWaiter`(15s), `fetchAssetAsBase64()`(실패 시 빈 data), `handleFetchMediaBundle()` 3자산 인출→번들 전송→ACK 대기
- 플러그인 usePopupState.ts: xvideos 매니저 state 5종 + `buildXvideosTxtContent`/목록 생성/순차 진행(done·failed 집계)/초기화, `getPacketLogType` ACK success 처리
- BasicTab.tsx: DownloadThemAll식 매니저 패널(저장 위치 절대경로·항목 상태 배지·진행/초기화) + sidepanel/popup props 전달
- opera-plugin 동기화 8종(헤더 교체, background.ts는 `chrome.sidePanel?.` 차이로 유지) + 양 플러그인 빌드 성공(각 48 모듈)
- 검증: server 빌드(tsc)+pm2 재시작 online(9600), dist에 신규 핸들러 포함 확인
- 문서: R-00208 §2.1/§2.2/§3.1, R-00430 §5.4, R-00420 §4.5 갱신

## 후속 확인
- 원 브라우저 실측 항목은 ask-20260810061757(매니저 전용 창 분리) 예정 작업으로 대체됨 — 해당 문서의 후속 확인 참조
