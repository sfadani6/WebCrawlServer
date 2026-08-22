# opera-plugin-uiux-audit-todo-registration-20260822222710

> 출처: ask-20260822222710 (docs/ask.md)
> 작성일: 2026-08-22
> 관련 규칙: R-00440 plugin-ui-ux.md, R-00106 coding.md, R-00103 workflow-management.md

## 요청 원문 요지
1. 액션실행의 xvideos 페이징 액션 버튼 | 도움말 버튼을 그룹 버튼으로 디자인 (버튼이 떨어져 있어 공간 활용 불량)
2. 현재 오페라 플러그인의 UI/UX 개선안을 todo 항목으로 작성

## 완료 내용 체크리스트

### 1. 그룹 버튼 디자인 — 기완료 재확인 (재작업 불필요)
- [x] 이전 세션(문서: `action-group-button-design-20260822221257.md`)에서 basic/opera 양쪽 적용·검증 완료
- [x] 본 세션 코드 재확인 — `plugins/opera-plugin/src/components/tabs/BasicTab.tsx:440`(`btn-group` 마크업), `plugins/opera-plugin/src/popup.css:417~`(토큰 3종) 존재 확인

### 2. 오페라 플러그인 UI/UX 감사 및 개선안 9건 todo 등록
- [x] 소스 실측 기반 개선안 도출 후 `docs/todo.md` "예정 작업" 섹션에 A~I 우선순위 표기로 등록
- [x] [A|높음] 헤더 경로 주석 오기 6개 파일(R-00106 §2 위반): ActionRunnerView.tsx:1, useBestOfRedRunner.ts:1, chromeService.ts:1, types/index.ts:1, content.ts:1, offscreen.ts:1
- [x] [B|높음] Header 타이틀 "WebCrawlServer basic" 오기(Header.tsx:8)
- [x] [C|중간] Header 서버 상태 인디케이터 부재(sidepanel.tsx:82)
- [x] [D|중간] URL 카드 복사 버튼 부재(BasicTab.tsx:203)
- [x] [E|중간] 설정 저장 결과 배지 미통일(SettingsTab.tsx:59)
- [x] [F|낮음] 디버그 JSON 사전 검증 부재(DebugTab.tsx:31)
- [x] [G|중간] 액션 실행기 팝업 진행률 바 부재(XvideosManagerView.tsx:229 대비)
- [x] [H|낮음] 터미널 콘솔 필터·검색·내보내기 부재(TerminalConsole.tsx)
- [x] [I|낮음] focus-visible·aria-label 접근성 미통일(popup.css 전반)

## 후속 확인
- 등록된 예정 작업 9건은 사용자 승인 시 개별 실행하며, 완료 시 본 절차(R-00103)에 따라 CHANGELOG 이관
- 해당 없음 항목 없음
