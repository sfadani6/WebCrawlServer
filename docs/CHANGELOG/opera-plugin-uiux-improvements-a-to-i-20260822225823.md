# opera-plugin-uiux-improvements-a-to-i-20260822225823

> 출처: ask-20260822222710 예정 작업 A~I 전체 처리 (docs/todo.md)
> 작성일: 2026-08-22
> 관련 규칙: R-00440 plugin-ui-ux.md, R-00106 coding.md, R-00410 plugin-architecture.md

## 완료 내용 체크리스트 (9건 전부)

### [A|높음] 헤더 경로 주석 오기 수정 (R-00106 §2)
- [x] opera-plugin 6개 파일 1열 주석을 `basic-plugin` → `opera-plugin` 경로로 수정: ActionRunnerView.tsx, useBestOfRedRunner.ts, chromeService.ts, types/index.ts, content.ts, offscreen.ts
- [x] 전수 재검사 결과 잔여 오기 0건

### [B|높음] Header 타이틀 식별자 수정
- [x] "WebCrawlServer basic" → "WebCrawlServer opera" 변경 (`Header.tsx`)

### [C|중간] 서버 상태 인디케이터 추가
- [x] `Header`에 `isServerOnline` prop 신설 + `.server-status-badge`(on/off) 배지 추가 — 온라인 초록 "서버 연결" / 오프라인 빨강 "서버 끊김"
- [x] `sidepanel.tsx`·`popup.tsx` 양 엔트리에서 prop 전달

### [D|중간] URL 클립보드 복사 버튼
- [x] URL 카드에 "복사" 버튼 추가(`navigator.clipboard.writeText`), 성공 시 2초간 "복사됨" 피드백 (`BasicTab.tsx`)

### [E|중간] 설정 저장 배지 통일
- [x] `ConfigSaveState` 타입 신설(idle/pending/success/error/warning) — `types/index.ts`
- [x] `usePopupState.ts`에 `configSaveState` 상태 + `applyConfigSaveStatus()` 헬퍼 추가, ACK/전송 경로 6곳 상태 동시 갱신
- [x] `SettingsTab` 저장 결과를 칩+메시지 배지(성공 초록/실패 빨강/저장 중 하늘/경고 호박)로 렌더링, 입력에 label htmlFor 연결

### [F|낮음] 디버그 JSON 유효성 검증
- [x] `DebugTab`에서 실시간 JSON 파싱 검증 — 오류 시 amber 경고 박스 + 전송 버튼 비활성화("JSON 오류 — 전송 불가"), aria-invalid 적용

### [G|중간] 액션 실행기 진행률 바 상시화
- [x] 감찰 정정: 실행 중 진행률 바는 기존에 존재했음 — 본 작업은 **실행 전 대기 상태에서도** 총 페이지(0/N 대기) 기준 바를 상시 노출하도록 개선
- [x] role="progressbar" + aria-valuemin/max/now 접근성 속성 추가 (`ActionRunnerView.tsx`)

### [H|낮음] 터미널 콘솔 필터·검색·내보내기
- [x] 로그 레벨 필터 칩 5종(전체/성공/정보/경고/오류, aria-pressed)
- [x] 검색어 인풋(대소문자 무시 부분 일치) + 조건 불일치 시 안내 문구
- [x] "내보내기" 버튼 — 필터링된 로그를 타임스탬프 파일명 .log로 Blob 다운로드
- [x] 자동 스크롤 의존성을 filteredLogs 기준으로 조정 (`TerminalConsole.tsx`)

### [I|낮음] 접근성 통일
- [x] 전역 `:focus-visible` 하늘색 포커스 링 규격 신설 (`popup.css`)
- [x] `TabBar` WAI-ARIA 탭 패턴(role="tablist"/role="tab"+aria-selected) 적용
- [x] 콘솔 리사이즈 바 role="separator", 명령어/검색/버튼 aria-label 보강

## 동기화 및 검증
- [x] 변경 15종(TS 14 + popup.css)을 basic-plugin에 동기화 — 파일별 diff = 헤더 경로 주석 1줄만 상이 확인
- [x] basic/opera 각각 `tsc --noEmit` exit 0, `vite build` 성공
- [x] 양쪽 `dist/chromeService.css`에 신규 클래스(server-status-badge/save-status-*/console-search-input/focus-visible) 출력 확인
- [x] 루트 `eslint .`: plugins 지적 0건(admin 기존 14건 변동 없음)

## 비고
- 작업 중 `Set-Content` 단일 라인 덮어쓰기로 popup.css 등이 손상되었으나 `git checkout --`로 즉시 복구 후 재작업함(최종 코드는 무손실).

## 후속 확인
- 브라우저 실측(사용자 수동): 헤더 배지 색상, 복사 버튼 동작, 설정 배지 색상, 디버그 오류 차단, 실행기 대기 진행 바, 콘솔 필터/검색/내보내기, 포커스 링 — 필요 시 todo 재등록
