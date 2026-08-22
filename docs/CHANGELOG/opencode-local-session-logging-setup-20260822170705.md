# 로컬 환경 OpenCode 설정 — 프로젝트 내부 세션 원장 기록 체계 구축 (ask-20260822170705)

> 출처: `docs/todo.md` "완료된 작업" 블록의 항목별 이관 문서 (ask-20260822203606 정리 작업)
> 요청 원문·처리 경위 상세: `docs/askLogs/ask-20260822170705.md`

## 완료 내용
- 루트 `opencode.json` 신설: `$schema`/`instructions: ["AGENTS.md"]`/`logLevel: "INFO"`/`share: "disabled"`
- `.opencode/plugin/session-logger.ts` 신규: 이벤트 버스 구독 세션 로거 — 질문/응답(`chat.text`)·도구 진행(`chat.tool`)·기타 이벤트 원장 기록, 노이즈(time./lsp./file.watcher.)·델타 제외, 파트 단위 디바운스(텍스트 800ms/도구 300ms), exit 시 잔여 버퍼 플러시
- 원장 출력 경로: `.opencode/logs/YYYY-MM-DD.jsonl`(일자 롤오버, `logs/` gitignore 패턴으로 저장소 미포함 확인)
- `eslint.config.mts`: 최상위 ignores에 `.opencode/**` 추가(tsconfig 프로젝트 범위 밖 파일 린트 오류 방지)
- 검증: esbuild 변환(es2022/esm) 통과, ESLint exit 0, 루트 tsc include 영향 없음, `git check-ignore` 매칭 확인
- 문서: R-00102 폴더 구조에 `.opencode/`·루트 `opencode.json` 명시

## 후속 확인
- OpenCode 재시작 후 실측: 질문/응답/도구 이벤트가 `.opencode/logs/<일자>.jsonl`에 기록되는지 확인 — `docs/todo.md` 예정 작업에서 관리 중
