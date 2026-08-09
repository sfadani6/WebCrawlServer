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

- 2026-08-08: 관리자 네트워크 페이지의 런타임 크래시 원인 분석 및 해결 보고서를 작성했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-network-runtime-crash-report.md](docs/CHANGELOG/2026-08-08-admin-network-runtime-crash-report.md) 를 참고하세요.
- 2026-08-08: 관리자 SPA 프록시 및 라우팅 복구 과정을 정리한 보고서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-spa-proxy-routing-report.md](docs/CHANGELOG/2026-08-08-admin-spa-proxy-routing-report.md) 를 참고하세요.
- 2026-08-08: 관리자 WebSocket 연결 상태 문제 원인 분석 및 대응 방안을 정리한 보고서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-websocket-connection-report.md](docs/CHANGELOG/2026-08-08-admin-websocket-connection-report.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 문제의 통합 요약 문서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-incident-summary.md](docs/CHANGELOG/2026-08-08-admin-incident-summary.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 문제의 개발자용 RCA 리포트를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-rca-report.md](docs/CHANGELOG/2026-08-08-admin-rca-report.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 문제의 운영/배포 관점 보고서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-ops-deployment-report.md](docs/CHANGELOG/2026-08-08-admin-ops-deployment-report.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 문제를 표 형식으로 요약한 문서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-problem-solution-verification-summary.md](docs/CHANGELOG/2026-08-08-admin-problem-solution-verification-summary.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 실무 담당자용 체크리스트 문서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-operational-checklist.md](docs/CHANGELOG/2026-08-08-admin-operational-checklist.md) 를 참고하세요.
- 2026-08-08: 관리자 대시보드 배포 전 확인항목 문서를 추가했습니다. 상세 내용은 [docs/CHANGELOG/2026-08-08-admin-pre-deployment-checklist.md](docs/CHANGELOG/2026-08-08-admin-pre-deployment-checklist.md) 를 참고하세요.

