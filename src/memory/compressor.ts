import type { ConversationTurn, CompressedSummary } from "../core/types.js";
import type { LLMProvider } from "../providers/interface.js";

const SYSTEM_PROMPT = `You are a conversation summarizer. Summarize the following conversation turns into a JSON object with these fields:
- originalTask: string describing what the user originally asked for
- approaches: array of strings describing approaches tried
- keyFindings: array of strings describing key findings
- failures: array of strings describing failures encountered

Return ONLY valid JSON, no other text.`;

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function defaultSummary(): CompressedSummary {
  return {
    originalTask: "(compression failed)",
    approaches: [],
    keyFindings: [],
    failures: [],
    compressedAt: Date.now(),
  };
}

export async function compressConversation(
  turns: ConversationTurn[],
  provider: LLMProvider
): Promise<CompressedSummary> {
  const conversationText = turns
    .map((t) => `[${t.role}]: ${t.content}`)
    .join("\n");

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: conversationText },
  ];

  const response = await provider.chat(messages, []);
  const rawContent = response.actions[0]?.parameters?.content as string | undefined;

  if (!rawContent || rawContent.trim().length === 0) {
    return defaultSummary();
  }

  try {
    const jsonStr = extractJson(rawContent);
    const parsed = JSON.parse(jsonStr);

    return {
      originalTask: typeof parsed.originalTask === "string" ? parsed.originalTask : "(compression failed)",
      approaches: Array.isArray(parsed.approaches) ? parsed.approaches : [],
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      failures: Array.isArray(parsed.failures) ? parsed.failures : [],
      compressedAt: Date.now(),
    };
  } catch {
    return defaultSummary();
  }
}