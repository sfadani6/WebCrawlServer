# 변경 이력 (docs/CHANGELOG.md)

> 본 문서는 프로젝트의 버전별 변경 내역을 기록하는 메인 인덱스 파일입니다.
> AGENTS.md 2장에서 예외로 언급된 파일로, 컨텍스트 로딩 시 참조 대상이 됩니다.
> 상세 변경 이력은 `docs/CHANGELOG/` 폴더에 연도/버전별로 분리 저장합니다.

---


---
## 버전 형식

- **메이저 버전 (X.0.0)**: 호환성Break가 있는 주요 변경
- **마이너 버전 (0.Y.0)**: 하위 호환성을 유지한 새로운 기능 추가
- **패치 버전 (0.0.Z)**: 버그 수정 및 사소한 개선

---
## CHANGELOG 관리 규칙

1. 모든 커밋은 해당 버전 섹션에 기록
2. 변경 사항은 사실적 기술 (마케팅 용어 사용 금지)
3. 상세 내용은 `docs/CHANGELOG/` 폴더의 하위 문서에 기록
4. 릴리스 시 새로운 버전 섹션 생성 및 Unreleased 내용 이관

---

## 관련 폴더

- `docs/CHANGELOG/` - 상세 변경 이력 저장소
- `docs/askLogs/` - 작업 요청/처리 이력
- `docs/decision/` - 설계 결정 기록 (ADR)

---
## Unreleased

- 2026-08-22: `docs/todo.md` 완료 항목의 CHANGELOG 항목별 이관 및 목록 정리를 수행했습니다. 상세 내용은 [docs/CHANGELOG/todo-changelog-migration-cleanup-20260822203606.md](docs/CHANGELOG/todo-changelog-migration-cleanup-20260822203606.md) 를 참고하세요.
- 2026-08-22: 오페라 플러그인 액션 실행에 도움말 레이어 팝업을 분리하고 인라인 설명을 제거했습니다. 상세 내용은 [docs/CHANGELOG/action-help-layer-popup-20260822185248.md](docs/CHANGELOG/action-help-layer-popup-20260822185248.md) 를 참고하세요.
- 2026-08-22: OpenCode 로컬 세션 원장 기록 체계를 구축했습니다. 상세 내용은 [docs/CHANGELOG/opencode-local-session-logging-setup-20260822170705.md](docs/CHANGELOG/opencode-local-session-logging-setup-20260822170705.md) 를 참고하세요.
- 2026-08-11: xvideos.com + xvideos.red 이중 도메인 지원 및 URL 분석 기반 저장 경로 생성을 적용했습니다. 상세 내용은 [docs/CHANGELOG/xvideos-dual-domain-paging-action-20260811030252.md](docs/CHANGELOG/xvideos-dual-domain-paging-action-20260811030252.md) 를 참고하세요.
- 2026-08-11: 오페라 플러그인 `sidePanel` 퍼미션 오류를 수정하고 `sidebar_action` manifest 회귀를 복구했습니다. 상세 내용은 [docs/CHANGELOG/opera-sidebar-action-manifest-fix-20260811011205.md](docs/CHANGELOG/opera-sidebar-action-manifest-fix-20260811011205.md) 를 참고하세요.
- 2026-08-11: 네트워크 안정 기반 로드 검증과 페이지별 트리 로그 UI를 적용했습니다. 상세 내용은 [docs/CHANGELOG/network-stable-load-verification-tree-log-ui-20260811001627.md](docs/CHANGELOG/network-stable-load-verification-tree-log-ui-20260811001627.md) 를 참고하세요.
- 2026-08-10: 액션 실행기 전체 페이지 순회와 미디어 다운로드 ACK 파이프라인을 구축했습니다. 상세 내용은 [docs/CHANGELOG/action-runner-full-pagination-media-download-20260810225335.md](docs/CHANGELOG/action-runner-full-pagination-media-download-20260810225335.md) 를 참고하세요.
- 2026-08-10: maxPage 감지 신뢰 개선과 저장 경로 `images/` 중복 제거를 적용했습니다. 상세 내용은 [docs/CHANGELOG/pagination-maxpage-detection-storage-path-fix-20260810201945.md](docs/CHANGELOG/pagination-maxpage-detection-storage-path-fix-20260810201945.md) 를 참고하세요.
- 2026-08-10: 팝업 주도 순차 이동 액션 실행기를 신설했습니다. 상세 내용은 [docs/CHANGELOG/popup-driven-action-runner-introduction-20260810175719.md](docs/CHANGELOG/popup-driven-action-runner-introduction-20260810175719.md) 를 참고하세요.
- 2026-08-10: 구 세션 자동 순회 엔진(대체됨) 작업 이력을 기록했습니다. 상세 내용은 [docs/CHANGELOG/xvideos-session-auto-crawl-engine-superseded-20260810163514.md](docs/CHANGELOG/xvideos-session-auto-crawl-engine-superseded-20260810163514.md) 를 참고하세요.
- 2026-08-10: 단일 영상 재생 페이지 폴백 수집을 적용했습니다. 상세 내용은 [docs/CHANGELOG/single-video-page-fallback-collection-20260810071013.md](docs/CHANGELOG/single-video-page-fallback-collection-20260810071013.md) 를 참고하세요.
- 2026-08-10: 다운로드 매니저 진행률 프로그레스 바 UI를 적용했습니다. 상세 내용은 [docs/CHANGELOG/download-progress-bar-ui-20260810065244.md](docs/CHANGELOG/download-progress-bar-ui-20260810065244.md) 를 참고하세요.
- 2026-08-10: 다운로드 매니저 전용 팝업 창 분리를 적용했습니다. 상세 내용은 [docs/CHANGELOG/xvideos-download-manager-window-20260810061757.md](docs/CHANGELOG/xvideos-download-manager-window-20260810061757.md) 를 참고하세요.
- 2026-08-10: 서버 미디어 번들 저장과 콘텐츠 수집 파이프라인을 구축했습니다. 상세 내용은 [docs/CHANGELOG/server-media-bundle-storage-pipeline-20260810051720.md](docs/CHANGELOG/server-media-bundle-storage-pipeline-20260810051720.md) 를 참고하세요.
- 2026-08-10: 폰트 아이콘 전면 제거와 버튼 색상 체계 정비를 적용했습니다. 상세 내용은 [docs/CHANGELOG/icon-removal-button-color-system-20260810033437.md](docs/CHANGELOG/icon-removal-button-color-system-20260810033437.md) 를 참고하세요.
- 2026-08-10: 이미지 수집 개선(500 상한·lazy 폴백·루트 도메인 통일)을 적용했습니다. 상세 내용은 [docs/CHANGELOG/image-collection-enhancement-root-domain-20260810031128.md](docs/CHANGELOG/image-collection-enhancement-root-domain-20260810031128.md) 를 참고하세요.
- 2026-08-10: fullPage/요소선택 액션 개편, SITE_INFO 수집, admin 그리드 정렬·검색을 적용했습니다. 상세 내용은 [docs/CHANGELOG/fullpage-element-site-info-admin-grid-20260810024611.md](docs/CHANGELOG/fullpage-element-site-info-admin-grid-20260810024611.md) 를 참고하세요.
- 2026-08-09: admin DB 그리드 개선(페이지당 행 수·셀 미리보기·탐색기 열기)을 적용했습니다. 상세 내용은 [docs/CHANGELOG/admin-db-grid-explorer-configs-20260809231120.md](docs/CHANGELOG/admin-db-grid-explorer-configs-20260809231120.md) 를 참고하세요.
- 2026-08-09: 플러그인 기본 탭 개편과 터미널 공통화를 적용했습니다. 상세 내용은 [docs/CHANGELOG/basic-tab-restructure-terminal-console-20260809205823.md](docs/CHANGELOG/basic-tab-restructure-terminal-console-20260809205823.md) 를 참고하세요.
- 2026-08-09: 오페라 브라우저 전용 플러그인을 신설했습니다. 상세 내용은 [docs/CHANGELOG/opera-plugin-bootstrap-20260809100542.md](docs/CHANGELOG/opera-plugin-bootstrap-20260809100542.md) 를 참고하세요.
- 2026-08-09: 클라이언트 4컬럼 재구성과 노드/워커 저장소 연동을 적용했습니다. 상세 내용은 [docs/CHANGELOG/client-four-column-node-worker-storage-20260809000000.md](docs/CHANGELOG/client-four-column-node-worker-storage-20260809000000.md) 를 참고하세요.
- 2026-08-08: 관리자 네트워크 페이지의 런타임 크래시 원인 분석 및 해결 보고서를 작성했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-network-runtime-crash-report.md](docs/CHANGELOG/2026-08-08-admin-network-runtime-crash-report.md) 를 참고하세요.
- 2026-08-08: 관리자 SPA 프록시 및 라우팅 복구 과정을 정리한 보고서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-spa-proxy-routing-report.md](docs/CHANGELOG/2026-08-08-admin-spa-proxy-routing-report.md) 를 참고하세요.
- 2026-08-08: 관리자 WebSocket 연결 상태 문제 원인 분석 및 대응 방안을 정리한 보고서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-websocket-connection-report.md](docs/CHANGELOG/2026-08-08-admin-websocket-connection-report.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 문제의 통합 요약 문서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-incident-summary.md](docs/CHANGELOG/2026-08-08-admin-incident-summary.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 문제의 개발자용 RCA 리포트를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-rca-report.md](docs/CHANGELOG/2026-08-08-admin-rca-report.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 문제의 운영/배포 관점 보고서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-ops-deployment-report.md](docs/CHANGELOG/2026-08-08-admin-ops-deployment-report.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 문제를 표 형식으로 요약한 문서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-problem-solution-verification-summary.md](docs/CHANGELOG/2026-08-08-admin-problem-solution-verification-summary.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 실무 담당자용 체크리스트 문서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-operational-checklist.md](docs/CHANGELOG/2026-08-08-admin-operational-checklist.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 배포 전 확인항목 문서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-pre-deployment-checklist.md](docs/CHANGELOG/2026-08-08-admin-pre-deployment-checklist.md) 를 참고하세요.

