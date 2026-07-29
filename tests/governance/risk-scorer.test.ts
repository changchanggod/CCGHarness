import { describe, it, expect } from "vitest";
import { scoreRisk, getCommandString } from "../../src/governance/risk-scorer.js";
import { classifyCommand } from "../../src/governance/classifier.js";
import type { Action, GuardrailRule } from "../../src/core/types.js";

const defaultRules: GuardrailRule[] = [
  { pattern: "rm\\s+(-[rRf]+\\s+)+[/~]", score: 100, description: "Recursive force delete on root/home" },
  { pattern: "git\\s+push\\s+.*--force", score: 60, description: "Force push" },
  { pattern: "npm\\s+publish", score: 40, description: "NPM publish" },
  { pattern: "shutdown|reboot|halt", score: 100, description: "System shutdown/reboot" },
  { pattern: "/dev/", score: 80, description: "Write to /dev/" },
  { pattern: "chmod\\s+777", score: 50, description: "chmod 777" },
];

function act(toolName: string, params: Record<string, unknown> = {}): Action {
  return { type: "tool_call", toolName, parameters: params };
}

describe("getCommandString", () => {
  it("extracts command param for shell tool", () => {
    const action = act("shell", { command: "rm -rf /" });
    expect(getCommandString(action)).toBe("rm -rf /");
  });

  it("extracts path param for write_file tool", () => {
    const action = act("write_file", { filePath: "/etc/passwd", content: "x" });
    expect(getCommandString(action)).toBe("/etc/passwd");
  });

  it("returns toolName for other tools", () => {
    const action = act("read_file", { filePath: "foo.txt" });
    expect(getCommandString(action)).toBe("read_file");
  });

  it("returns empty string for stop action", () => {
    const action = { type: "stop" as const, summary: "done" };
    expect(getCommandString(action)).toBe("");
  });

  it("returns empty string for action with no toolName", () => {
    const action = { type: "tool_call" as const, parameters: {} };
    expect(getCommandString(action)).toBe("");
  });
});

describe("scoreRisk", () => {
  it("rm -rf / → block (100)", () => {
    const action = act("shell", { command: "rm -rf /" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, defaultRules);
    expect(result.riskScore).toBe(100);
    expect(result.riskLevel).toBe("block");
    expect(result.matchedRules).toContain("Recursive force delete on root/home");
  });

  it("git push --force → warn (60)", () => {
    const action = act("shell", { command: "git push origin main --force" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, defaultRules);
    expect(result.riskScore).toBe(60);
    expect(result.riskLevel).toBe("warn");
    expect(result.matchedRules).toContain("Force push");
  });

  it("npm publish → warn (40)", () => {
    const action = act("shell", { command: "npm publish" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, defaultRules);
    expect(result.riskScore).toBe(40);
    expect(result.riskLevel).toBe("warn");
    expect(result.matchedRules).toContain("NPM publish");
  });

  it("accumulates scores from multiple matching rules", () => {
    const action = act("shell", { command: "npm publish && rm -rf /home" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, defaultRules);
    expect(result.riskScore).toBe(100);
    expect(result.matchedRules).toContain("NPM publish");
    expect(result.matchedRules).toContain("Recursive force delete on root/home");
  });

  it("caps totalScore at 100", () => {
    const action = act("shell", { command: "shutdown && rm -rf / && chmod 777 /" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, defaultRules);
    expect(result.riskScore).toBe(100);
    expect(result.riskLevel).toBe("block");
  });

  it("unmatched command → safe (0)", () => {
    const action = act("shell", { command: "echo hello" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, defaultRules);
    expect(result.riskScore).toBe(0);
    expect(result.riskLevel).toBe("safe");
    expect(result.matchedRules).toEqual([]);
  });

  it("maps ≤30 to safe", () => {
    const rules: GuardrailRule[] = [
      { pattern: "echo", score: 30, description: "echo command" },
    ];
    const action = act("shell", { command: "echo hello" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, rules);
    expect(result.riskLevel).toBe("safe");
  });

  it("maps ≤70 to warn", () => {
    const rules: GuardrailRule[] = [
      { pattern: "echo", score: 31, description: "echo command" },
    ];
    const action = act("shell", { command: "echo hello" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, rules);
    expect(result.riskLevel).toBe("warn");
  });

  it("maps >70 to block", () => {
    const rules: GuardrailRule[] = [
      { pattern: "echo", score: 71, description: "echo command" },
    ];
    const action = act("shell", { command: "echo hello" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, rules);
    expect(result.riskLevel).toBe("block");
  });

  it("skips invalid regex gracefully", () => {
    const rules: GuardrailRule[] = [
      { pattern: "[invalid", score: 100, description: "invalid regex" },
      { pattern: "echo", score: 10, description: "echo command" },
    ];
    const action = act("shell", { command: "echo hello" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, rules);
    expect(result.riskScore).toBe(10);
    expect(result.matchedRules).toEqual(["echo command"]);
  });

  it("preserves existing category from classification", () => {
    const action = act("shell", { command: "echo hello" });
    const classification = classifyCommand(action);
    const result = scoreRisk(action, classification, defaultRules);
    expect(result.category).toBe("shell");
  });
});