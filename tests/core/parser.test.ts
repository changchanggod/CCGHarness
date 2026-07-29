import { describe, it, expect } from "vitest";
import { parseActions } from "../../src/core/parser.js";
import type { LLMResponse, Action } from "../../src/core/types.js";

describe("parseActions", () => {
  it("returns actions array from LLMResponse", () => {
    const actions: Action[] = [
      { type: "tool_call", toolName: "read_file", parameters: { path: "src/index.ts" } },
      { type: "tool_call", toolName: "write_file", parameters: { path: "src/out.ts", content: "hello" } },
    ];
    const response: LLMResponse = {
      actions,
      rawUsage: { prompt: 100, completion: 50 },
    };

    const result = parseActions(response);
    expect(result).toEqual(actions);
    expect(result).toHaveLength(2);
  });

  it("handles stop actions", () => {
    const actions: Action[] = [
      { type: "stop", summary: "Task completed." },
    ];
    const response: LLMResponse = {
      actions,
      rawUsage: { prompt: 30, completion: 10 },
    };

    const result = parseActions(response);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("stop");
    expect(result[0].summary).toBe("Task completed.");
  });

  it("handles empty actions array", () => {
    const response: LLMResponse = {
      actions: [],
      rawUsage: { prompt: 0, completion: 0 },
    };

    const result = parseActions(response);
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("handles mixed actions (tool_call and stop)", () => {
    const actions: Action[] = [
      { type: "tool_call", toolName: "run_shell", parameters: { cmd: "npm test" } },
      { type: "stop", summary: "Tests pass." },
    ];
    const response: LLMResponse = { actions, rawUsage: { prompt: 200, completion: 100 } };

    const result = parseActions(response);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("tool_call");
    expect(result[1].type).toBe("stop");
  });
});