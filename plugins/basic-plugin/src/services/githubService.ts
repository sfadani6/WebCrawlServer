// plugins/basic-plugin/src/services/githubService.ts
// NOTE (보류): 이 파일의 깃허브 자동 커밋/푸시 기능은 현재 우선순위에서 제외되어
// 있습니다. 구현 내용은 문서상으로 보관하되, 실제 배포/자동화 작업으로 즉시 사용하지
// 않도록 백로그(Deferred)로 표기합니다.

/** GitHub 파일 커밋 옵션 구조체 */
export interface CommitFileOptions {
  /** GitHub Personal Access Token (PAT) */
  token: string;
  /** GitHub 계정 또는 조직명 */
  owner: string;
  /** 타깃 저장소 이름 */
  repo: string;
  /** 저장소 내 파일 상대 경로 (예: "crawled/data.json") */
  filePath: string;
  /** 텍스트/JSON 파일 내용 */
  content: string;
  /** 커밋 메시지 */
  commitMessage: string;
}

/** GitHub 파일 커밋 실행 결과 구조체 */
export interface CommitFileResult {
  /** 실행 성공 여부 */
  success: boolean;
  /** 성공 시 커밋 SHA */
  commitSha?: string;
  /** 성공 시 파일 HTML URL */
  contentUrl?: string;
  /** 실패 시 오류 메시지 */
  errorMessage?: string;
}

/**
 * 수집된 데이터를 GitHub REST API를 통해 지정 저장소로 자동 커밋/푸시합니다.
 * 기존 파일이 있을 경우 SHA를 취득하여 업데이트(PUT)하고, 없을 경우 신규 생성합니다.
 * ADR-003: 백그라운드 페치 스크래핑 및 깃허브 동기화 규격 준수
 *
 * @param options - 커밋 옵션 객체
 * @returns 커밋 실행 결과
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
    // 텍스트 콘텐츠를 Base64로 인코딩 (GitHub API 요구사항)
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    // 기존 파일 존재 여부 확인 (sha 취득 - 업데이트 시 필요)
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
      // 신규 파일 처리 (sha 취득 실패 무시)
    }

    // PUT 요청 바디 구성 (기존 파일 있을 경우 sha 포함)
    const bodyPayload: Record<string, unknown> = {
      message: commitMessage,
      content: base64Content,
    };
    if (existingSha) {
      bodyPayload.sha = existingSha;
    }

    // GitHub API PUT 요청 단행
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
        commitSha: json.commit?.sha,
        contentUrl: json.content?.html_url,
      };
    } else {
      return {
        success: false,
        errorMessage: json.message || "GitHub API 오류 발생",
      };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "네트워크 예외";
    return { success: false, errorMessage: msg };
  }
}

/**
 * GitHub Actions 워크플로를 원격으로 실행(dispatch)합니다.
 *
 * @param token - GitHub PAT
 * @param owner - 계정명
 * @param repo - 저장소명
 * @param workflowId - 워크플로 파일명 또는 ID
 * @param ref - 브랜치명 (기본값: "main")
 * @returns 실행 트리거 성공 여부
 */
export async function triggerGithubWorkflow(
  token: string,
  owner: string,
  repo: string,
  workflowId: string,
  ref: string = "main",
): Promise<boolean> {
  try {
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
  } catch {
    return false;
  }
}
