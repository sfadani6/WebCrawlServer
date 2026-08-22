# 플러그인 UI 폰트 아이콘 전면 제거 + 버튼 색상 체계 정비 (ask-20260810033437)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260810033437.md`

## 완료 내용
- popup.css: Material Symbols `@import` 제거, 공통 버튼 토큰 신설(`btn-primary`/`btn-accent`/`btn-secondary`/`btn-mini`, 비활성 opacity→명시 고대비), `terminal-log-line`/`terminal-input` 스타일 추가
- 폰트 아이콘 22곳 전면 제거(Header/TerminalConsole/BasicTab 16/DebugTab/InfoTab 2/SettingsTab) + 아코디언 `▼/▶` 유니코드 전환 + HTML 3종 CDN 제거
- 터미널 정돈: 로그 행 타임스탬프/본문 분리·호버, 입력줄 박스형(sky 포커스 링), 헤더 버튼 `btn-mini` 통일
- 버튼 일관화: 설정탭 `#1A73E8`→`btn-primary`(파랑 그라데이션), 요소 선택 앰버 유지, 사이트 카테고리 `btn-secondary` 통일
- opera-plugin 동기화(10종 복사 + 헤더 교체) + 양 플러그인 빌드 성공(각 48 모듈)
- 문서: R-00440 §1.3 아이콘 배제 원칙·§1.4 버튼 색상 체계 신설, §2 도식·§4.2 갱신

## 후속 확인
- 브라우저 수동 확인: 아이콘 제거·버튼 가시성·색상 통일, 터미널 출력/입력 스타일, 이미지 수집 카테고리 버튼 활성/비활성 대비 — `docs/todo.md` 예정 작업에서 관리 중
