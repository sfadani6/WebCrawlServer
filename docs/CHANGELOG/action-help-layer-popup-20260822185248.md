# 오페라 플러그인 액션 실행 — "xvideos 페이징 액션" 도움말 레이어 팝업 분리 + 인라인 설명 제거 (ask-20260822185248)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260822185248.md`

## 완료 내용
- `ActionHelpModal.tsx` 신규(basic): 공용 레이어 팝업 — 오버레이+중앙 다이얼로그(max-w 340px/max-h 70vh), `ActionHelpSection` 목록 렌더링, ✕/배경 클릭/ESC 닫기 3종, role=dialog·aria-modal 접근성 속성
- `BasicTab.tsx`(basic): 섹션 안내 문단·카드 하단 설명 문단 삭제 → `XV_BEST_OF_RED_ACTION_HELP`(액션 실행/동작 방식/수집 조건/저장 경로/실행 조건) 팝업 본문 이관, 실행 버튼 행 개편(버튼 flex-1 + "?" 원형 버튼 shrink-0), `isActionHelpOpen` 상태 추가
- `popup.css`: `.btn-help-round` 토큰 신설(원형 36px, sky 글자, hover 강조)
- opera-plugin 동기화 3종(popup.css/BasicTab.tsx/ActionHelpModal.tsx, 헤더 교체 후 정규화 diff 0)
- 검증: tsc --noEmit basic/opera 통과, 양 플러그인 빌드 성공(dist에 btn-help-round 확인), ESLint 변경 파일 오류 0건
- 문서: R-00440 §2.4 도움말 규격 + §4.4 레이어 팝업 신설 + §5 체크리스트 항목 추가

## 후속 확인
- 브라우저 실측: 액션 카드에서 장문 설명 미노출, "?" 클릭 → 도움말 팝업 표시, ✕/배경 클릭/ESC 닫기 동작 확인 — `docs/todo.md` 예정 작업에서 관리 중
