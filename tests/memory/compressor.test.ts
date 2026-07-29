import { describe, it, expect } from "vitest";
import { compressConversation } from "../../src/memory/compressor.js";
import type { LLMProvider } from "../../src/providers/interface.js";
import type { LLMResponse, Message, ToolDefinition, ConversationTurn } from "../../src/core/types.js";

function makeProvider(responses: LLMResponse[]): LLMProvider {
  let index = 0;
  return {
    async chat(_messages: Message[], _tools: ToolDefinition[]): Promise<LLMResponse> {
      if (index >= responses.length) {
        throw new Error("No more mock responses available");
      }
      return responses[index++];
    },
  };
}

function makeTurn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
  return {
    role: "assistant",
    content: "test content",
    timestamp: 1700000000000,
    tokenCount: 10,
    ...overrides,
  };
}

function makeResponse(content: string): LLMResponse {
  return {
    actions: [
      {
        type: "tool_call",
        toolName: "respond",
        parameters: { content },
      },
    ],
    rawUsage: { prompt: 10, completion: 5 },
  };
}

describe("compressConversation", () => {
  it("sends a system prompt to the LLM and parses the JSON summary response", async () => {
    const summaryJson = JSON.stringify({
      originalTask: "write a simple web server",
      approaches: ["express", "fastify"],
      keyFindings: ["express is simpler"],
      failures: ["fastify port conflict"],
    });
    const provider = makeProvider([makeResponse(summaryJson)]);

    const turns: ConversationTurn[] = [
      makeTurn({ role: "user", content: "build a web server" }),
      makeTurn({ role: "assistant", content: "I'll use express" }),
      makeTurn({ role: "tool", content: "npm install express" }),
    ];

    const result = await compressConversation(turns, provider);

    expect(result.originalTask).toBe("write a simple web server");
    expect(result.approaches).toEqual(["express", "fastify"]);
    expect(result.keyFindings).toEqual(["express is simpler"]);
    expect(result.failures).toEqual(["fastify port conflict"]);
    expect(result.compressedAt).toBeGreaterThan(0);
  });

  it("falls back to default summary on parse failure", async () => {
    const provider = makeProvider([makeResponse("not valid json")]);

    const turns: ConversationTurn[] = [
      makeTurn({ role: "user", content: "do something" }),
    ];

    const result = await compressConversation(turns, provider);

    expect(result.originalTask).toBe("(compression failed)");
    expect(result.approaches).toEqual([]);
    expect(result.keyFindings).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(result.compressedAt).toBeGreaterThan(0);
  });

  it("falls back to default summary when LLM returns empty content", async () => {
    const provider = makeProvider([makeResponse("")]);

    const turns: ConversationTurn[] = [
      makeTurn({ role: "user", content: "do something" }),
    ];

    const result = await compressConversation(turns, provider);

    expect(result.originalTask).toBe("(compression failed)");
    expect(result.approaches).toEqual([]);
    expect(result.keyFindings).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it("handles partial JSON by filling in missing fields", async () => {
    const partialJson = JSON.stringify({
      originalTask: "just a task",
    });
    const provider = makeProvider([makeResponse(partialJson)]);

    const turns: ConversationTurn[] = [
      makeTurn({ role: "user", content: "task" }),
    ];

    const result = await compressConversation(turns, provider);

    expect(result.originalTask).toBe("just a task");
    expect(result.approaches).toEqual([]);
    expect(result.keyFindings).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it("extracts JSON from LLM response wrapped in code fences", async () => {
    const wrappedJson = '```json\n{"originalTask":"wrapped task","approaches":["a"],"keyFindings":["b"],"failures":["c"]}\n```';
    const provider = makeProvider([makeResponse(wrappedJson)]);

    const turns: ConversationTurn[] = [
      makeTurn({ role: "user", content: "task" }),
    ];

    const result = await compressConversation(turns, provider);

    expect(result.originalTask).toBe("wrapped task");
    expect(result.approaches).toEqual(["a"]);
    expect(result.keyFindings).toEqual(["b"]);
    expect(result.failures).toEqual(["c"]);
  });
});