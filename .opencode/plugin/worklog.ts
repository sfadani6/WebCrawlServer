// 파일명: .opencode/plugin/worklog.ts
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "@opencode-ai/plugin";

/** 도구 실행 결과를 프로젝트 내부 로그에 남기는 OpenCode 플러그인이다. */
export const WorklogPlugin: Plugin = async ({ directory }) => {
  const logDirectory = join(directory, ".opencode", "logs");
  mkdirSync(logDirectory, { recursive: true });

  return {
    "chat.message": async (input, output) => {
      const message = output.message;
      await writeRecord(logDirectory, "conversation.jsonl", {
        timestamp: new Date().toISOString(),
        type: "user",
        sessionID: input.sessionID,
        messageID: input.messageID,
        parts: output.parts.map((part) => redact(JSON.stringify(part))),
      });
    },
    event: async ({ event }) => {
      if (event.type !== "message.updated" || event.properties.info.role !== "assistant") {
        return;
      }
      await writeRecord(logDirectory, "conversation.jsonl", {
        timestamp: new Date().toISOString(),
        type: "assistant",
        sessionID: event.properties.info.sessionID,
        messageID: event.properties.info.id,
        message: redact(JSON.stringify(event.properties.info)),
      });
    },
    "tool.execute.after": async (input, output) => {
      await writeRecord(logDirectory, "tool-execution.jsonl", {
        timestamp: new Date().toISOString(),
        tool: input.tool,
        callID: input.callID,
        title: output.title,
        output: redact(output.output),
      });
    },
  };
};

/** 프로젝트 내부 JSONL 파일에 로그 레코드를 추가한다. */
async function writeRecord(logDirectory: string, fileName: string, record: Record<string, unknown>): Promise<void> {
  const logPath = join(logDirectory, fileName);
  appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
}

/** 로그에 포함될 수 있는 API 키 형태의 값을 가린다. */
function redact(value: string): string {
  return value.replace(/(api[_-]?key|token|secret)(\s*[:=]\s*)([^\s,}]+)/gi, "$1$2[REDACTED]");
}
