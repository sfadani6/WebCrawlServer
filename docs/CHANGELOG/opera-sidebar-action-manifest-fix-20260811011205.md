# 오페라 플러그인 `sidePanel` 퍼미션 오류 재발 수정 — `sidebar_action` manifest 회귀 복구 (ask-20260811011205)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260811011205.md`

## 완료 내용
- opera-plugin manifest.json: `permissions`에서 `"sidePanel"` 제거 + `"side_panel"` 키 → `"sidebar_action"`(`default_title`/`default_panel`/`default_icon`) 교체 + name/description 오페라 문구 복구 + `run_at: document_start` 유지
- background.ts: 변경 없음(`chrome.sidePanel?.setPanelBehavior` 옵셔널 가드 유지 — 오페라 undefined no-op)
- 검증: `npm run build`(opera-plugin, 56 모듈) → `dist/manifest.json`에서 `sidebar_action` 존재·`sidePanel`/`side_panel` 부재·name 오페라 문구·run_at document_start 확인
- 문서: R-00460 §6.4 "동기화 시 재발 방지 주의" 신설(manifest 통째 복사 금지 + 3대 유지 항목 + dist 검증)

## 후속 확인
- 오페라 `opera://extensions`에서 `plugins/opera-plugin/dist` 로드 → `Permission 'sidePanel' is unknown` 미발생·정상 로드, 툴바/사이드바 아이콘 클릭 시 `sidepanel.html` 사이드바 표시 확인 — `docs/todo.md` 예정 작업에서 관리 중
