# opencode 문서·플러그인 정합 (2026-11-05)

- 일시: 2026-11-05 14:12:14
- 범위: `docs/todo.md`, `docs/tips/`, `.opencode/agent/lm-dev.md`, `.opencode/plugin/`

## 변경
- `docs/todo.md`에 후속 작업·참고 링크 명시(문서 공백 해소).
- `docs/tips/2026-11-05-opencode-run-and-port.md` 신규(포트 39739·런처·인증·로그).
- 로그 플러그인을 `worklog.ts`로 통일. 구 `session-logger.ts`는 `session-logger.ts.bak`으로 비활성(과거 로그 유지).
- `lm-dev`의 `bash: ask` 제거 → 상위 허용 목록 상속(PERM-001 원인 1 해소).

## 검증
- JSON 파싱 OK, `debug agent`에서 `*: ask` 1건(전역)만 확인.
- `worklog.ts` `tsc --noEmit` 통과.
- `session-logger.ts` 부재·`.bak` 존재 확인.
