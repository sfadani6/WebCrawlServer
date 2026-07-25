# R-002 기술 스택 (tech-stack.md)

> Version: 1.0.0
> 작성자: 사용자
> 수정일: 2026-07-25
> 검토일: 2026-07-25
> 수정 이유: instructions.md 2장(기술 스택)을 별도 문서로 분리
> 관련 문서: docs/rule/instructions.md(R-000), docs/rule/database.md(R-007)
> 영향 범위: 신규 분리 문서, 기존 instructions.md 2장을 대체
> Breaking Change 여부: 없음 (내용 이관만 수행)

---

## 1. 기술 스택

| 영역 | 기술 | 비고 |
|---|---|---|
| 런타임 | Node.js v18 이상 | Windows 11 개발 환경 기준 |
| 패키지 관리 | npm 또는 yarn | 프로젝트 내 통일된 도구 하나만 사용 |
| 서버 프레임워크 | Express (또는 동급 경량 프레임워크) | REST + WebSocket 병행 |
| 실시간 통신 | WebSocket | MCP 메시지 양방향 전송용 |
| DB | SQLite3 (`database/main.db`) | WAL 모드 활성화, 인덱스 설계 필수 (database.md 참조) |
| 워크플로우 정의 | YAML | 모듈별 `workflow.yaml` |
| 스케줄링 | node-cron 또는 동급 cron 라이브러리 | scheduler.md 전용, 서버 재시작 시 재등록 필요 |
| 영상 처리 | ffmpeg | 영상 편집 모듈 전용 |
| 알림 | Slack Webhook | 에러/완료 이벤트 전송, 이메일 알림 미사용 |
| 브라우저 플러그인 | Manifest V3 (Chrome/Edge), Firefox 임시 로드 지원 | `background.js`, `content.js`, `task runner` 구조 |

- 로컬 단독 실행, 1인 개인용 도구다. TLS 암호화, 외부 인증 체계, 접근 권한 분리는 적용하지 않는다(security.md 참조).
- 이메일 알림은 사용하지 않기로 확정했으므로, 이후 문서에서 "Email 모듈"은 후보에서 제외한다(structure.md 참조). 필요해지면 이 표를 먼저 변경한 뒤 반영한다.
