// .opencode/plugin/session-logger.ts

/**
 * OpenCode 세션 로거 플러그인
 *
 * - 사용자 질문(메시지), 어시스턴트 응답 텍스트, 도구 실행 진행 상태 등
 *   세션 전체 활동을 프로젝트 내부 `.opencode/logs/<YYYY-MM-DD>.jsonl` 원장에 기록한다.
 * - 이벤트 버스(`event` 훅)로 유입되는 전체 이벤트 중 고빈도 노이즈
 *   (time./lsp./file.watcher. 접두어)와 스트리밍 델타만 제외하고 원장에 남긴다.
 * - 스트리밍 중 반복 발생하는 `message.part.updated` 이벤트는 파트 단위 버퍼링 후
 *   디바운스(텍스트 800ms / 도구 300ms)하여 중복 라인 생성을 최소화한다.
 */
import type { Plugin } from "@opencode-ai/plugin"
import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

/** 무시할 이벤트 타입 접두어 목록 (초당 다수 발생하여 원장 가치가 없는 이벤트 계열) */
const IGNORED_EVENT_PREFIXES: readonly string[] = ["time.", "lsp.", "file.watcher."]

/** 텍스트 파트 기록 디바운스 대기 시간 (단위: ms, 기본값: 800, 권장 범위: 200~3000) */
const TEXT_FLUSH_DELAY_MS = 800

/** 도구 파트 기록 디바운스 대기 시간 (단위: ms, 기본값: 300, 권장 범위: 100~1000) */
const TOOL_FLUSH_DELAY_MS = 300

/** 이벤트 버스에서 유입되는 원시 이벤트의 최소 형태 정의 (외부 스키마 의존 제거용) */
interface BusEvent {
  /** 이벤트 타입 식별자 (예: "message.updated", "session.created") */
  type: string
  /** 이벤트 부가 속성 (타입별 상이하며 없을 수 있음) */
  properties?: Record<string, unknown>
}

/** 메시지 파트의 최소 형태 정의 (text/tool 판별과 원장 라인 구성에 필요한 필드만 사용) */
interface MessagePartLike {
  /** 파트 고유 ID (파트 단위 디바운스 버퍼 키로 사용) */
  id?: string
  /** 파트 종류 ("text" | "tool" | 기타) */
  type?: string
  /** 소속 세션 ID */
  sessionID?: string
  /** 소속 메시지 ID */
  messageID?: string
  /** text 파트의 본문 내용 */
  text?: string
  /** tool 파트의 도구 식별자 (예: "bash", "edit") */
  tool?: string
  /** tool 파트의 실행 상태 정보 */
  state?: {
    /** 실행 상태 (예: "pending", "running", "completed", "error") */
    status?: string
    /** 도구 실행 요약 제목 */
    title?: string
  }
}

/** 파트 ID별 지연 기록 대기 항목 (원장 라인, 중복 억제 스냅샷, 타이머) */
interface PendingPart {
  /** 플러시 시점에 원장에 기록될 라인 객체 */
  line: Record<string, unknown>
  /** 직전 기록 대비 중복 여부 판정용 스냅샷 문자열 */
  snapshot: string
  /** 디바운스 타이머 핸들 (플러시 후 null) */
  timer: ReturnType<typeof setTimeout> | null
}

/** 두 자리 미만 숫자를 0으로 채운 두 자리 문자열로 변환한다.
 *
 * @param value - 0~99 범위의 정수 값
 * @returns 0으로 패딩된 두 자리 문자열 (예: 7 → "07")
 */
const pad2 = (value: number): string => String(value).padStart(2, "0")

/** 로컬 시간대 기준 YYYY-MM-DD 날짜 문자열을 반환한다.
 *
 * @returns 로컬 날짜 문자열 (예: "2026-08-22")
 */
const localDate = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** 로컬 시간대 기준 YYYY-MM-DD HH:mm:ss.SSS 타임스탬프를 반환한다.
 *
 * @returns 밀리초 정밀도의 로컬 타임스탬프 문자열
 */
const localTimestamp = (): string => {
  const now = new Date()
  return `${localDate()} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}.${String(now.getMilliseconds()).padStart(3, "0")}`
}

/**
 * OpenCode 세션 로거 플러그인 엔트리.
 *
 * @param input.directory - 플러그인이 동작하는 프로젝트 절대 경로 (로그 출력 루트 기준)
 * @returns 이벤트 버스를 구독하는 플러그인 훅 묶음
 */
export default (async ({ directory }) => {
  /** JSONL 원장 출력 디렉터리 (프로젝트 내부 위치 보장) */
  const logDir = join(directory, ".opencode", "logs")
  // 디렉터리를 재귀 생성한다. 이미 존재하면 아무 동작도 하지 않는다.
  mkdirSync(logDir, { recursive: true })

  /** 현재 로컬 일자에 대응하는 원장 파일 전체 경로를 반환한다. */
  const logFilePath = (): string => join(logDir, `${localDate()}.jsonl`)

  /**
   * JSONL 원장에 한 줄을 추가 기록한다. 일자 경계를 넘으면 자동으로 새 파일로 롤오버된다.
   *
   * @param line - 기록할 라인 객체 (ts 필드는 호출 시점에 주입)
   */
  const appendLine = (line: Record<string, unknown>): void => {
    try {
      appendFileSync(logFilePath(), `${JSON.stringify({ ts: localTimestamp(), ...line })}\n`, "utf8")
    } catch (error) {
      console.error("[session-logger] 로그 기록 실패:", error)
    }
  }

  /** 파트 ID별 디바운스 버퍼 (파트 ID → 지연 기록 대기 항목) */
  const pendingParts = new Map<string, PendingPart>()

  /**
   * 특정 파트의 대기 라인을 즉시 원장에 기록하고 버퍼에서 제거한다.
   *
   * @param partId - 플러시할 파트 고유 ID
   */
  const flushPart = (partId: string): void => {
    const entry = pendingParts.get(partId)
    if (!entry) return
    if (entry.timer !== null) clearTimeout(entry.timer)
    pendingParts.delete(partId)
    appendLine(entry.line)
  }

  /** 프로세스 종료 시점에 미기록 버퍼를 모두 동기 플러시한다. */
  const flushAllPending = (): void => {
    for (const partId of Array.from(pendingParts.keys())) flushPart(partId)
  }
  process.once("exit", flushAllPending)

  /**
   * 파트 라인을 지연 기록으로 등록한다. 직전 스냅샷과 동일한 갱신은 무시하여 중복을 억제한다.
   *
   * @param partId - 파트 고유 ID (버퍼 키)
   * @param line - 플러시 시점에 기록될 라인 객체
   * @param snapshot - 내용 변경 판정용 스냅샷 문자열
   * @param delayMs - 디바운스 대기 시간 (단위: ms)
   */
  const schedulePart = (
    partId: string,
    line: Record<string, unknown>,
    snapshot: string,
    delayMs: number,
  ): void => {
    const existing = pendingParts.get(partId)
    if (existing && existing.snapshot === snapshot) return
    if (existing && existing.timer !== null) clearTimeout(existing.timer)
    const timer = setTimeout(() => flushPart(partId), delayMs)
    pendingParts.set(partId, { line, snapshot, timer })
  }

  /**
   * `message.part.updated` 이벤트의 part를 해석하여 text/tool 원장 라인으로 변환·등록한다.
   *
   * @param value - 이벤트 properties.part 원시 값 (형태 검증 후 사용)
   */
  const handlePartUpdated = (value: unknown): void => {
    if (!value || typeof value !== "object") return
    const part = value as MessagePartLike
    const partId = typeof part.id === "string" ? part.id : ""
    if (!partId) return

    if (part.type === "text") {
      const text = typeof part.text === "string" ? part.text : ""
      schedulePart(
        partId,
        {
          kind: "chat.text",
          sessionId: part.sessionID ?? "",
          messageId: part.messageID ?? "",
          partId,
          text,
        },
        text,
        TEXT_FLUSH_DELAY_MS,
      )
      return
    }

    if (part.type === "tool") {
      const toolName = typeof part.tool === "string" ? part.tool : "unknown"
      const status = typeof part.state?.status === "string" ? part.state.status : "unknown"
      const title = typeof part.state?.title === "string" ? part.state.title : ""
      schedulePart(
        partId,
        {
          kind: "chat.tool",
          sessionId: part.sessionID ?? "",
          messageId: part.messageID ?? "",
          partId,
          tool: toolName,
          status,
          title,
        },
        `${toolName}|${status}|${title}`,
        TOOL_FLUSH_DELAY_MS,
      )
    }
  }

  return {
    /** 이벤트 버스 구독 훅: 전체 이벤트를 필터링·디바운스하여 원장에 기록한다. */
    event: async ({ event }) => {
      const busEvent = event as unknown as BusEvent
      const eventType = typeof busEvent.type === "string" ? busEvent.type : ""

      // 초당 수십 회 반복되는 노이즈 이벤트(time/lsp/파일감시)는 기록하지 않는다.
      if (IGNORED_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix))) return

      // 메시지 파트 갱신은 디바운스 버퍼를 거쳐 text/tool 라인으로 기록한다.
      if (eventType === "message.part.updated") {
        handlePartUpdated(busEvent.properties?.part)
        return
      }

      // 스트리밍 델타 이벤트는 최종 파트 갱신으로 대체 가능하므로 원장에서 제외한다.
      if (eventType === "message.part.delta") return

      // 나머지 세션/메시지/권한/파일 이벤트는 원시 속성 그대로 남긴다.
      appendLine({ kind: "event", type: eventType, properties: busEvent.properties })
    },
  }
}) satisfies Plugin
