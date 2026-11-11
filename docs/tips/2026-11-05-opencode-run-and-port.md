# opencode 로컬 실행·포트·로그 (2026-11-05)

> **위치**: `docs/tips/2026-11-05-opencode-run-and-port.md`
> **상위 규격**: `AGENTS.md`, `E:\up\0-project\git\xtx9999\doc\AI\opencode\09-포트설정\PORT-001 프로젝트별 opencode 포트 분리와 --port 옵션의 목적.md`

## 1. 포트

| 항목 | 값 |
|---|---|
| WebCrawlServer 기본 포트 | **39739** |
| 대역 | `39700~39799`(opencode 전용), `4096` 사용 금지 |
| 런처 파라미터 | `-ServerPort`(`-Port` 금지 — opencode `--port`와 충돌) |
| 비활성화 | `-NoPort` / `-ServerPort 0` |
| 점유 시 | 경고 후 포트 없이 실행(fail-open) |

## 2. 실행

```powershell
pwsh -ExecutionPolicy Bypass -File .\scripts\run-opencode.ps1            # 39739 자동 주입
pwsh -ExecutionPolicy Bypass -File .\scripts\run-opencode.ps1 -Check     # 경로·격리 점검
pwsh -ExecutionPolicy Bypass -File .\scripts\run-opencode.ps1 serve      # 상주 서버
```

- 프로젝트 로컬 `.opencode\node_modules\.bin\opencode.cmd`만 사용한다.
- 데이터·캐시·상태는 `.opencode\{data,cache,state}`로 격리된다.
- 상주 서버 인증은 세션 환경변수 `OPENCODE_SERVER_PASSWORD`로 설정한다(파일 저장 금지). 절차는 PORT-001 §10.1.

## 3. 로그

- 2026-11-05부터 플러그인을 `worklog.ts`로 통일했다(`conversation.jsonl`, `tool-execution.jsonl`, 시크릿 마스킹).
- 기존 `session-logger.ts`는 `.opencode/plugin/session-logger.ts.bak`으로 보관했고, 과거 날짜별 로그(`YYYY-MM-DD.jsonl`)는 그대로 둔다.
- 로그에는 키·토큰·비밀번호를 남기지 않는다.
