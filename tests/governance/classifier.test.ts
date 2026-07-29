import { describe, it, expect } from "vitest";
import { classifyCommand } from "../../src/governance/classifier.js";
import type { Action } from "../../src/core/types.js";

function act(toolName: string): Action {
  return { type: "tool_call", toolName, parameters: {} };
}

describe("classifyCommand", () => {
  it("classifies read_file as file_read, safe", () => {
    const result = classifyCommand(act("read_file"));
    expect(result.category).toBe("file_read");
    expect(result.riskLevel).toBe("safe");
    expect(result.riskScore).toBe(0);
  });

  it("classifies write_file as file_write, safe", () => {
    const result = classifyCommand(act("write_file"));
    expect(result.category).toBe("file_write");
    expect(result.riskLevel).toBe("safe");
    expect(result.riskScore).toBe(0);
  });

  it("classifies shell as shell, safe", () => {
    const result = classifyCommand(act("shell"));
    expect(result.category).toBe("shell");
    expect(result.riskLevel).toBe("safe");
    expect(result.riskScore).toBe(0);
  });

  it("classifies run_tests as build_test", () => {
    const result = classifyCommand(act("run_tests"));
    expect(result.category).toBe("build_test");
  });

  it("classifies run_lint as build_test", () => {
    const result = classifyCommand(act("run_lint"));
    expect(result.category).toBe("build_test");
  });

  it("classifies unknown tool as unknown, safe", () => {
    const result = classifyCommand(act("unknown_tool"));
    expect(result.category).toBe("unknown");
    expect(result.riskLevel).toBe("safe");
    expect(result.riskScore).toBe(0);
  });

  it("classifies stop action as unknown, safe, empty rules", () => {
    const result = classifyCommand({ type: "stop", summary: "done" });
    expect(result.category).toBe("unknown");
    expect(result.riskLevel).toBe("safe");
    expect(result.riskScore).toBe(0);
    expect(result.matchedRules).toEqual([]);
  });
});