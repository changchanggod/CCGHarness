import { describe, it, expect } from "vitest";
import type {
  Action,
  ToolResult,
  Issue,
  ValidationResult,
  Message,
  LLMResponse,
  ToolDefinition,
  ClassificationResult,
  CommandCategory,
  RiskLevel,
  GuardrailRule,
  ApprovalState,
  ApprovalDecision,
  ConversationTurn,
  CompressedSummary,
  LoopConfig,
  LoopState,
} from "../../src/core/types.js";

describe("core types", () => {
  it("types module exists and is importable at runtime", async () => {
    const mod = await import("../../src/core/types.js");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("Action: tool_call with all fields", () => {
    const action: Action = {
      type: "tool_call",
      toolName: "read_file",
      parameters: { path: "src/index.ts" },
      summary: "read the entry point",
    };
    expect(action.type).toBe("tool_call");
    expect(action.toolName).toBe("read_file");
    expect(action.parameters).toEqual({ path: "src/index.ts" });
    expect(action.summary).toBe("read the entry point");
  });

  it("Action: stop variant with optional fields absent", () => {
    const action: Action = { type: "stop" };
    expect(action.type).toBe("stop");
    expect(action.toolName).toBeUndefined();
    expect(action.parameters).toBeUndefined();
    expect(action.summary).toBeUndefined();
  });

  it("ToolResult: success with metadata", () => {
    const result: ToolResult = {
      success: true,
      output: "ok",
      metadata: { exitCode: 0, stderr: "" },
    };
    expect(result.success).toBe(true);
    expect(result.output).toBe("ok");
    expect(result.error).toBeUndefined();
    expect(result.metadata?.exitCode).toBe(0);
    expect(result.metadata?.stderr).toBe("");
  });

  it("ToolResult: failure with error, no metadata", () => {
    const result: ToolResult = {
      success: false,
      output: "",
      error: "command not found",
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe("command not found");
    expect(result.metadata).toBeUndefined();
  });

  it("Issue: error severity with file and line", () => {
    const issue: Issue = {
      severity: "error",
      file: "src/core/types.ts",
      line: 42,
      message: "type mismatch",
    };
    expect(issue.severity).toBe("error");
    expect(issue.file).toBe("src/core/types.ts");
    expect(issue.line).toBe(42);
    expect(issue.message).toBe("type mismatch");
  });

  it("Issue: warning severity without optional fields", () => {
    const issue: Issue = { severity: "warning", message: "unused variable" };
    expect(issue.severity).toBe("warning");
    expect(issue.file).toBeUndefined();
    expect(issue.line).toBeUndefined();
  });

  it("ValidationResult: passed with empty issues", () => {
    const result: ValidationResult = { passed: true, issues: [] };
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("ValidationResult: failed with issues", () => {
    const issue: Issue = { severity: "error", message: "boom" };
    const result: ValidationResult = { passed: false, issues: [issue] };
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toBe("boom");
  });

  it("Message: all roles constructible, toolCallId optional", () => {
    const roles: Array<Message["role"]> = ["system", "user", "assistant", "tool"];
    expect(roles).toHaveLength(4);
    for (const role of roles) {
      const msg: Message = { role, content: `hello from ${role}` };
      expect(msg.role).toBe(role);
      expect(msg.content).toContain(role);
      expect(msg.toolCallId).toBeUndefined();
    }
    const toolMsg: Message = { role: "tool", content: "result", toolCallId: "call_1" };
    expect(toolMsg.toolCallId).toBe("call_1");
  });

  it("LLMResponse: actions array and rawUsage token counts", () => {
    const response: LLMResponse = {
      actions: [
        { type: "tool_call", toolName: "run_tests", parameters: {} },
        { type: "stop", summary: "done" },
      ],
      rawUsage: { prompt: 100, completion: 25 },
    };
    expect(response.actions).toHaveLength(2);
    expect(response.actions[0].type).toBe("tool_call");
    expect(response.actions[1].type).toBe("stop");
    expect(response.rawUsage.prompt).toBe(100);
    expect(response.rawUsage.completion).toBe(25);
  });

  it("ToolDefinition: shape and execute returns a ToolResult", async () => {
    const tool: ToolDefinition = {
      name: "echo",
      description: "echoes the input",
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      execute: async (params) => ({
        success: true,
        output: String(params.text),
      }),
    };
    expect(tool.name).toBe("echo");
    expect(tool.description).toBe("echoes the input");
    expect(tool.parameters.type).toBe("object");
    expect(tool.parameters.properties).toEqual({ text: { type: "string" } });
    expect(tool.parameters.required).toEqual(["text"]);
    const result = await tool.execute({ text: "hi" });
    expect(result.success).toBe(true);
    expect(result.output).toBe("hi");
  });

  it("ToolDefinition: required may be omitted", () => {
    const tool: ToolDefinition = {
      name: "noop",
      description: "does nothing",
      parameters: { type: "object", properties: {} },
      execute: async () => ({ success: true, output: "" }),
    };
    expect(tool.parameters.required).toBeUndefined();
  });

  it("CommandCategory: all six members are valid", () => {
    const categories: CommandCategory[] = [
      "file_read",
      "file_write",
      "shell",
      "build_test",
      "network",
      "unknown",
    ];
    expect(categories).toHaveLength(6);
    expect(categories).toContain("file_read");
    expect(categories).toContain("unknown");
  });

  it("RiskLevel: all three members are valid", () => {
    const levels: RiskLevel[] = ["safe", "warn", "block"];
    expect(levels).toEqual(["safe", "warn", "block"]);
  });

  it("ClassificationResult: category, score, level, matched rules", () => {
    const result: ClassificationResult = {
      category: "shell",
      riskScore: 85,
      riskLevel: "block",
      matchedRules: ["rm -rf", "sudo"],
    };
    expect(result.category).toBe("shell");
    expect(result.riskScore).toBe(85);
    expect(result.riskLevel).toBe("block");
    expect(result.matchedRules).toEqual(["rm -rf", "sudo"]);
  });

  it("GuardrailRule: pattern, score, description", () => {
    const rule: GuardrailRule = {
      pattern: "rm\\s+-rf",
      score: 90,
      description: "recursive force delete",
    };
    expect(rule.pattern).toBe("rm\\s+-rf");
    expect(rule.score).toBe(90);
    expect(rule.description).toBe("recursive force delete");
  });

  it("ApprovalState: all five members are valid", () => {
    const states: ApprovalState[] = ["idle", "waiting", "approved", "denied", "timeout"];
    expect(states).toHaveLength(5);
    expect(states).toContain("waiting");
    expect(states).toContain("timeout");
  });

  it("ApprovalDecision: all three members are valid", () => {
    const decisions: ApprovalDecision[] = ["approve", "deny", "approve_all"];
    expect(decisions).toEqual(["approve", "deny", "approve_all"]);
  });

  it("ConversationTurn: role, content, timestamp, tokenCount", () => {
    const turn: ConversationTurn = {
      role: "assistant",
      content: "I will run the tests",
      timestamp: 1700000000000,
      tokenCount: 12,
    };
    expect(turn.role).toBe("assistant");
    expect(turn.content).toBe("I will run the tests");
    expect(turn.timestamp).toBe(1700000000000);
    expect(turn.tokenCount).toBe(12);
    const roles: Array<ConversationTurn["role"]> = ["user", "assistant", "tool"];
    expect(roles).toHaveLength(3);
  });

  it("CompressedSummary: all fields present", () => {
    const summary: CompressedSummary = {
      originalTask: "fix the bug",
      approaches: ["tried X", "tried Y"],
      keyFindings: ["root cause in parser"],
      failures: ["approach X broke tests"],
      compressedAt: 1700000000000,
    };
    expect(summary.originalTask).toBe("fix the bug");
    expect(summary.approaches).toEqual(["tried X", "tried Y"]);
    expect(summary.keyFindings).toEqual(["root cause in parser"]);
    expect(summary.failures).toEqual(["approach X broke tests"]);
    expect(summary.compressedAt).toBe(1700000000000);
  });

  it("LoopConfig: three numeric limits", () => {
    const config: LoopConfig = {
      maxRounds: 50,
      maxConsecutiveFailures: 3,
      llmRetryAttempts: 2,
    };
    expect(config.maxRounds).toBe(50);
    expect(config.maxConsecutiveFailures).toBe(3);
    expect(config.llmRetryAttempts).toBe(2);
  });

  it("LoopState: full state with compressed summary", () => {
    const summary: CompressedSummary = {
      originalTask: "task",
      approaches: [],
      keyFindings: [],
      failures: [],
      compressedAt: 1,
    };
    const turn: ConversationTurn = {
      role: "user",
      content: "do it",
      timestamp: 1,
      tokenCount: 2,
    };
    const state: LoopState = {
      round: 3,
      consecutiveFailures: 1,
      conversationHistory: [turn],
      compressedSummary: summary,
      finished: false,
      finalResult: "",
    };
    expect(state.round).toBe(3);
    expect(state.consecutiveFailures).toBe(1);
    expect(state.conversationHistory).toHaveLength(1);
    expect(state.conversationHistory[0].role).toBe("user");
    expect(state.compressedSummary).not.toBeNull();
    expect(state.compressedSummary?.originalTask).toBe("task");
    expect(state.finished).toBe(false);
    expect(state.finalResult).toBe("");
  });

  it("LoopState: compressedSummary may be null", () => {
    const state: LoopState = {
      round: 0,
      consecutiveFailures: 0,
      conversationHistory: [],
      compressedSummary: null,
      finished: true,
      finalResult: "all done",
    };
    expect(state.compressedSummary).toBeNull();
    expect(state.finished).toBe(true);
    expect(state.finalResult).toBe("all done");
  });
});
