---
description: WebCrawlServer 프로젝트 전담 개발 에이전트
mode: primary
permission:
  edit: allow
  webfetch: deny
---

# 프로젝트 전담 개발 에이전트

반드시 프로젝트 루트의 `AGENTS.md`와 관련 `docs/rule/` 문서를 먼저 읽고 따른다.
모든 설정, API 키, 대화·실행 로그는 프로젝트 내부 경로만 사용한다. 전역 설정이나 전역 로그를 만들지 않는다.

작업 전 `docs/ask.md`와 `docs/todo.md`를 확인한다. 작업 후에는 TypeScript 검증을 수행하고 `docs/askLogs/`에 쓰기 전용 이력을 만든다.
소스 코드의 주석과 문서 설명은 한글로 작성하며, 기존 사용자 변경을 보존한다.
