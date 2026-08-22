# action-group-button-design-20260822221257

> 출처: ask-20260822221257 (docs/ask.md 신규 요청) + 세션 내 검증 작업 2건
> 작성일: 2026-08-22
> 관련 규칙: R-00440 plugin-ui-ux.md, R-00103 workflow-management.md

## 완료 내용 체크리스트

### 1. xvideos 페이징 액션 + 도움말(?) 버튼 연결형 그룹 버튼 디자인
- [x] `plugins/basic-plugin/src/popup.css`에 `.btn-group` / `.btn-group-main` / `.btn-group-help` 토큰 신설 (컨테이너 flex+stretch, 좌측 버튼 `border-radius: 8px 0 0 8px` + flex:1, 우측 버튼 `border-radius: 0 8px 8px 0` + `border-left: none`)
- [x] `plugins/opera-plugin/src/popup.css` 동기화 (diff 0)
- [x] 양 플러그인 `BasicTab.tsx` 실행 버튼 행을 `flex items-stretch gap-2`(버튼 간 8px 이격) → `btn-group mt-2`(연결형)로 교체, 버튼 클래스를 `btn-secondary btn-group-main` / `btn-help-round btn-group-help`로 변경
- [x] 도움말(?) 버튼은 액션 비활성화 상태에서도 클릭 가능 유지 (disabled 미적용)

### 2. OpenCode 세션 원장 실측 검증 (기존 예정 작업 ask-20260822170705)
- [x] `.opencode/logs/2026-08-22.jsonl` 생성 확인 (세션 진행 중 158 → 314줄 실시간 증가)
- [x] 질문 텍스트: `chat.text` 이벤트 기록 확인 (예: `"text":"ask"`)
- [x] 응답 메시지: `message.updated`(role: assistant) 이벤트 기록 확인
- [x] 도구 실행: `chat.tool` 이벤트 기록 확인 (bash/glob/read × running/completed)

### 3. 액션 카드 도움말 팝업 코드 정적 검증 (기존 예정 작업 ask-20260822185248의 선행 검증)
- [x] `ActionHelpModal.tsx`: 배경 오버레이 `onMouseDown={onClose}` 닫기, 다이얼로그 `stopPropagation`, ESC keydown 리스너, ✕ 버튼 3종 닫기 경로 코드 확인
- [x] basic/opera `ActionHelpModal.tsx` diff 0 (헤더 경로 주석만 상이)

## 후속 확인
- 브라우저 실측(사용자 수동): 그룹 버튼 시각 결합 상태·호버 경계선 표현, 도움말 팝업 표시 및 ✕/배경 클릭/ESC 닫기 동작 — 사용자가 todo.md 예정 작업을 직접 정리한 상태이므로 필요 시 재등록
