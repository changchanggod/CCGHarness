import { describe, it, expect } from "vitest";
import { MockLLMProvider } from "../../src/providers/mock.js";
import { LLMProvider } from "../../src/providers/interface.js";
import type { Message, LLMResponse, ToolDefinition } from "../../src/core/types.js";

function makeResponse(actionType: "tool_call" | "stop", overrides?: Partial<LLMResponse>): LLMResponse {
  return {
    actions: [
      actionType === "stop"
        ? { type: "stop", summary: "done" }
        : { type: "tool_call", toolName: "test_tool", parameters: {} },
    ],
    rawUsage: { prompt: 10, completion: 5 },
    ...overrides,
  };
}

const emptyMessages: Message[] = [];
const noTools: ToolDefinition[] = [];

describe("MockLLMProvider", () => {
  it("returns responses in order", async () => {
    const r1 = makeResponse("tool_call");
    const r2 = makeResponse("stop");
    const provider = new MockLLMProvider([r1, r2]);

    const resp1 = await provider.chat(emptyMessages, noTools);
    const resp2 = await provider.chat(emptyMessages, noTools);

    expect(resp1).toEqual(r1);
    expect(resp2).toEqual(r2);
  });

  it("throws when no more mock responses are available", async () => {
    const provider = new MockLLMProvider([makeResponse("stop")]);

    await provider.chat(emptyMessages, noTools);

    await expect(provider.chat(emptyMessages, noTools)).rejects.toThrow(
      "No more mock responses available"
    );
  });
});