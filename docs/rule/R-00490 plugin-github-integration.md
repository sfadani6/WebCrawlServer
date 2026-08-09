> **보류(Deferred)**: `깃허브(GitHub)` 연동 관련 기능은 현재 우선순위에서 제외되어 있습니다.
>
> 이유: 현재 단계에서는 `admin` UI, 서버-플러그인 실시간 통신, 네트워크 모니터링 등 기능의 안정화가 최우선입니다. 깃허브 통합은 별도의 백로그 항목으로 관리되며, 당분간 개발/배포 지침의 상단 우선순위에서 제거되어야 합니다.

본 문서는 `WebCrawlServer` 프로젝트의 브라우저 확장 플러그인에서 **깃허브(GitHub) REST API 연동**, 수집 데이터의 **자동 커밋(Commit) 및 푸시(Push)**, 그리고 **서버-클라이언트 실시간 토큰 동기화(Push Sync)**를 구현하기 위한 표준 기술 지침서입니다.

---

## 1. 개요 및 구현 목적

1.1 **개요**: 사이드바에서 수집/가공된 웹 데이터(HTML, JSON, 마크다운 문서)를 내 깃허브 저장소로 직접 커밋/푸시하고, 깃허브의 다양한 기능(이슈 생성, GitHub Actions 원격 가동)을 사이드바에서 통합 통제합니다.  
1.2 **구현 목적**:
   - **자동 커밋/푸시**: Git CLI 설치 없이 깃허브 REST API로 수집 데이터를 지정 저장소로 푸시.
   - **실시간 토큰 이중 동기화 (Dual-Sync)**: 사이드바 로컬 스토리지(`chrome.storage.local`)의 PAT로 고속 직접 커밋하되, 변경 시 서버 푸시(`UPDATE_AUTH_TOKEN`)로 모든 프로필의 토큰을 일괄 자동 최신화.
   - **파이프라인 원격 트리거**: 사이드바에서 깃허브 파이프라인(`workflow_dispatch`)을 즉시 가동.

---

## 2. 깃허브 REST API 커밋/푸시 모듈 규정 (`src/services/githubService.ts`)

`PUT /repos/{owner}/{repo}/contents/{path}` API를 사용하여 자바스크립트로 파일 자동 커밋 및 푸시를 단행합니다.

```typescript
// plugins/basic-plugin/src/services/githubService.ts

export interface CommitFileOptions {
  token: string;          // GitHub Personal Access Token (PAT)
  owner: string;          // GitHub 계정/조직명
  repo: string;           // 타깃 저장소 이름
  filePath: string;       // 저장소 내 파일 상대 경로 (예: "crawled/2026-08-05-data.json")
  content: string;        // 저장할 텍스트 또는 JSON 원문
  commitMessage: string;  // 커밋 메시지
}

export interface CommitFileResult {
  success: boolean;
  commitSha?: string;
  contentUrl?: string;
  errorMessage?: string;
}

/**
 * 수집된 데이터를 GitHub REST API를 통해 지정 저장소로 자동 커밋/푸시합니다.
 */
export async function commitFileToGithub({
  token,
  owner,
  repo,
  filePath,
  content,
  commitMessage,
}: CommitFileOptions): Promise<CommitFileResult> {
  try {
    // 1. 유니코드 텍스트의 Base64 인코딩 (GitHub API 필수 규격)
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    // 2. 기존 파일 존재 여부 확인 (기존 파일 수정 시 sha 필요)
    let existingSha: string | undefined = undefined;
    try {
      const getRes = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      if (getRes.ok) {
        const getJson = await getRes.json();
        existingSha = getJson.sha;
      }
    } catch {
      // 신규 파일일 경우 sha 생략
    }

    // 3. 파일 생성 또는 업데이트 단행
    const bodyPayload: Record<string, unknown> = {
      message: commitMessage,
      content: base64Content,
    };
    if (existingSha) {
      bodyPayload.sha = existingSha;
    }

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify(bodyPayload),
    });

    const json = await response.json();

    if (response.ok) {
      return {
        success: true,
        commitSha: json.commit.sha,
        contentUrl: json.content.html_url,
      };
    } else {
      return {
        success: false,
        errorMessage: json.message || "알 수 없는 GitHub API 오류",
      };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "네트워크 오류";
    return { success: false, errorMessage: msg };
  }
}
```

---

## 3. 실시간 토큰 푸시 동기화 규정 (Token Push Sync)

3.1 **로컬 우선 사용**: 사이드바 및 오프스크린은 `chrome.storage.local`에 저장된 `githubToken`을 우선 인출하여 고속 커밋을 단행합니다.  
3.2 **서버 푸시 최신화 수용**: 서버(`WebCrawlServer`)에서 웹소켓 패킷(`action: "UPDATE_AUTH_TOKEN"`)이 들어오면 `offscreen.ts`가 이를 수신하여 로컬 스토리지의 토큰을 최신화합니다.  

```typescript
// plugins/basic-plugin/src/offscreen.ts 내 토큰 푸시 수신기

if (packet.action === "UPDATE_AUTH_TOKEN") {
  const { tokenType, token } = packet.payload as { tokenType: string; token: string };
  
  // 로컬 스토리지 자동 최신화
  await chrome.storage.local.set({ [tokenType]: token });
  
  // 사이드바 UI로 토큰 갱신 알림 중계
  chrome.runtime.sendMessage({
    type: "TOKEN_REFRESHED",
    tokenType,
  });
}
```

---

## 4. GitHub Actions 원격 트리거 규정 (`workflow_dispatch`)

사이드바 버튼 클릭 한 번으로 깃허브의 CI/CD 파이프라인이나 백엔드 파이썬 크롤러를 원격 가동시킬 수 있습니다.

```typescript
/**
 * GitHub Actions 워크플로를 원격 실행시킵니다.
 */
export async function triggerGithubWorkflow(
  token: string,
  owner: string,
  repo: string,
  workflowId: string,
  ref: string = "main"
): Promise<boolean> {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({ ref }),
  });

  return response.ok;
}
```

---

## 5. 검증 체크리스트

- [ ] GitHub PAT 토큰을 이용해 텍스트/JSON 데이터가 지정 저장소 경로로 정상 커밋/푸시되는가?
- [ ] 텍스트 유니코드 데이터가 Base64로 안전하게 인코딩되어 깨짐 없이 푸시되는가?
- [ ] 서버에서 `UPDATE_AUTH_TOKEN` 패킷을 전송했을 때 모든 프로필 플러그인의 로컬 토큰이 자동으로 최신화되는가?
- [ ] 깃허브 API 호출 실패 시 명확한 오류 문구가 사이드바 UI에 피드백되는가?
