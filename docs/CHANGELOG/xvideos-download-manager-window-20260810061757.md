# xvideos 다운로드 매니저 전용 팝업 창 분리 (ask-20260810061757)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260810061757.md`

## 완료 내용
- vite.config.ts: `rollupOptions.input`에 xvideosManager 엔트리(`xvideos-manager.html`) 추가(기존 sidepanel/offscreen/background/content 유지, 엔트리 5종) + `xvideos-manager.html` 신규
- `useXvideosDownloadManager.ts` 신규: `extFromUrl`/`buildXvideosTxtContent` 이관 + 훅(목록/순차진행/초기화/로그 200건 상한)
- chromeService.ts: `sendCommandToActiveTab` 일반화 `sendCommandToTab(tabId)` 신설(주입+재시도), `requestCollectXvideosMediaFromTab(tabId)` 추가
- `xvideosManager.tsx` 신규(React root, tabId 쿼리 검증·폴백, initError, 최초 자동 목록 생성) + `XvideosManagerView.tsx` 신규(2열 그리드·상태 배지·버튼 3종·로그 터미널)
- BasicTab.tsx: xvideos Props 6종 → `onOpenXvideosManager` 1종, "다운로드 매니저 열기" 버튼만 유지
- usePopupState.ts: xvideos state 5종 제거, `handleOpenXvideosManager`(xvideos 탭 검색→windows.create) 신규 + return 반영
- sidepanel.tsx/popup.tsx props 교체 + manifest `windows` 권한 추가(basic/opera)
- opera-plugin 동기화(신규 3종+html+vite.config+수정 5종 헤더 교체) + 양 플러그인 빌드 성공(각 52 모듈, xvideosManager.js 8.73 kB)
- 문서: R-00440 §2.3(매니저 창 UI 규격), R-00430 §5.4·§6, R-00420 §4.5, R-00450(엔트리 4→5)

## 후속 확인
- 브라우저 실측: 사이드바 버튼→매니저 창(900×760) 열림, 대상 탭 목록 자동 생성(중복 제거·상한 없음), 진행 시 txt+썸네일2종+preview.mp4 저장 및 완료/실패 배지, 닫기·초기화·로그 출력 확인 — `docs/todo.md` 예정 작업에서 관리 중
