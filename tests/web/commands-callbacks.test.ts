import { describe, it, expect, vi } from "vitest";
import { runTask } from "../../src/cli/commands.js";
import { MockLLMProvider } from "../../src/providers/mock.js";
import type { LLMResponse } from "../../src/core/types.js";

const mockResponse: LLMResponse = {
  actions: [{ type: "stop", summary: "done" }],
  rawUsage: { prompt: 0, completion: 0 },
};

describe("runTask callbacks", () => {
  it("calls onToolStart and onToolResult during execution", async () => {
    const onToolStart = vi.fn();
    const onToolResult = vi.fn();

    const mockProvider = new MockLLMProvider([
      {
        actions: [
          { type: "tool_call", toolName: "read_file", parameters: { path: "test.txt" }, toolCallId: "call_1" },
        ],
        rawUsage: { prompt: 0, completion: 0 },
      },
      mockResponse,
    ]);

    const result = await runTask(
      "test task",
      "ccg.yaml",
      false,
      mockProvider,
      undefined,
      { onToolStart, onToolResult },
    );

    expect(onToolStart).toHaveBeenCalledWith("read_file", { path: "test.txt" });
    expect(onToolResult).toHaveBeenCalled();
    expect(result).toBe("done");
  });
});