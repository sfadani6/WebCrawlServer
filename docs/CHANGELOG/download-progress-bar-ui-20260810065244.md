# xvideos 다운로드 매니저 진행률 프로그레스 바 UI (ask-20260810065244)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260810064441.md`
> 비고: 블록 표기 ask id는 20260810065244, askLog 파일은 ask-20260810064441로 생성됨(동일 작업).

## 완료 내용
- offscreen.ts: `broadcastFetchProgress()` 신설 + 인출 단계별(메인30/보조55/프리뷰80/전송95) `FETCH_MEDIA_BUNDLE_PROGRESS` 브로드캐스트(.catch 가드)
- types/index.ts: `XvideosDownloadItem.progress` + `FetchMediaBundleProgressPayload` 신설
- useXvideosDownloadManager.ts: progress 초기 0/진행 리셋/done·failed 100, onMessage 리스너(bundleId 매칭 갱신)
- XvideosManagerView.tsx: `.manager-list-scroll` + 항목별 image_url/sfw_image_url/preview_video_url 3줄 + 프로그레스 바(0% 쉬머→%→완료/실패 100)
- popup.css: 가시 스크롤바(thumb #475569) + `progress-bar-indeterminate` 쉬머 애니메이션
- opera-plugin 동기화 5종 + 양 플러그인 빌드 성공(각 52 모듈, offscreen.js 5.33 kB·xvideosManager.js 10.42 kB)
- 문서: R-00440 §2.3, R-00420 §4.5·§5, R-00430 §5.4·§6

## 후속 확인
- 브라우저 실측: 매니저 창 목록 스크롤바 표시, 항목별 이미지 URL 주소 3줄 표시, 진행 시 프로그레스 바(쉬머→%→완료) 및 저장 배지 갱신 확인 — `docs/todo.md` 예정 작업에서 관리 중
