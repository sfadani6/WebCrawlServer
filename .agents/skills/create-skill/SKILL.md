---
name: create-skill
user-invocable: true
description: "Use when you want to create or draft a workspace skill file (SKILL.md) for VS Code agent customization. Guides scope, file placement, frontmatter, and validation."
---

# Create Skill

## 목적
이 스킬은 사용자에게 새 `SKILL.md` 파일을 생성하는 단계별 워크플로우를 안내합니다. 주로 VS Code 에이전트 커스터마이제이션 파일을 프로젝트 레벨에서 추가할 때 사용합니다.

## 사용 시점
- 새로운 작업 흐름을 스킬로 캡슐화하려고 할 때
- `SKILL.md` 템플릿과 필수 frontmatter가 필요한 경우
- 워크스페이스 범위 커스터마이제이션을 생성하려고 할 때

## 워크플로우
1. 결과물 정의
   - 어떤 작업을 자동화하는 스킬인지 명확히 합니다.
   - 원하는 출력 유형(`SKILL.md`)과 대상 위치(`.agents/skills/<skill-name>/SKILL.md`)를 확인합니다.

2. 범위 결정
   - 프로젝트 공유용이면 워크스페이스 `.agents/skills/`에 생성합니다.
   - 개인 전용이면 사용자 프롬프트 폴더(`{{VSCODE_USER_PROMPTS_FOLDER}}`)를 검토합니다.

3. 파일 생성
   - 디렉토리 이름과 `name` 필드를 일치시킵니다.
   - `user-invocable` 값을 `true`로 설정합니다.
   - `description`에 검색어와 사용 시나리오를 포함합니다.

4. 내용 작성
   - 목적과 적용 조건을 간결하게 기술합니다.
   - 단계별 지침과 결정 포인트를 포함합니다.
   - 검증 기준을 명확히 합니다.

5. 검증
   - 파일 경로가 올바른지 확인합니다.
   - YAML frontmatter 구문을 검토합니다.
   - `description`이 자연어 검색에 적합한지 점검합니다.

## 결정 포인트
- 스킬인가, 프롬프트인가?
  - 단계가 여러 개이고 작업을 안내해야 하면 스킬.
  - 단일 입력 기반 작업이면 프롬프트.

- 작업 범위가 전 프로젝트에 걸쳐야 하는가?
  - 예: 여러 파일/패턴을 다루는 에이전트 정의 → 스킬.
  - 특정 파일이나 좁은 영역이라면 `*.instructions.md`나 `*.prompt.md`를 고려합니다.

## 검증 기준
- 파일이 `.agents/skills/<skill-name>/SKILL.md` 위치에 생성됨
- YAML frontmatter가 `---`로 감싸져 있음
- `name`, `description`, `user-invocable`이 존재함
- 설명에 명확한 트리거 문구가 포함됨

## 예시 프롬프트
- "새로운 VS Code 스킬을 만들고 싶어. SKILL.md 템플릿을 보여줘."
- "이 워크스페이스에 커스텀 스킬 생성 단계를 안내해줘."

## 관련 커스터마이제이션
- `.agents/skills/`에 추가 스킬 생성
- `.github/instructions/` 또는 `*.prompt.md`로 좁은 작업 정의
- `AGENTS.md` 또는 `copilot-instructions.md`로 에이전트 전역 규칙 작성

