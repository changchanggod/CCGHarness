import { describe, it, expect } from "vitest";
import {
  Action,
  ToolResult,
  Issue,
  ValidationResult,
  Message,
  LLMResponse,
  ToolDefinition,
  ClassificationResult,
  GuardrailRule,
  ConversationTurn,
  CompressedSummary,
  LoopConfig,
  LoopState,
  CommandCategory,
  RiskLevel,
  ApprovalState,
  ApprovalDecision,
} from "../../src/core/types.js";
import * as typesModule from "../../src/core/types.js";

describe("module exports", () => {
  it("exports all expected symbols", () => {
    expect(typesModule).toBeTruthy();
    expect(typeof typesModule).toBe("object");
  });
});

describe("Action", () => {
  it("constructs a tool_call action", () => {
    const action: Action = {
      type: "tool_call",
      toolName: "read_file",
      parameters: { path: "/src/index.ts" },
    };
    expect(action.type).toBe("tool_call");
    expect(action.toolName).toBe("read_file");
    expect(action.parameters).toEqual({ path: "/src/index.ts" });
  });

  it("constructs a stop action with summary", () => {
    const action: Action = {
      type: "stop",
      summary: "Task completed.",
    };
    expect(action.type).toBe("stop");
    expect(action.summary).toBe("Task completed.");
  });
});

describe("ToolResult", () => {
  it("constructs a success result", () => {
    const result: ToolResult = {
      success: true,
      output: "file contents",
    };
    expect(result.success).toBe(true);
    expect(result.output).toBe("file contents");
  });

  it("constructs a failure result with error and metadata", () => {
    const result: ToolResult = {
      success: false,
      output: "",
      error: "command not found",
      metadata: { exitCode: 127, stderr: "bash: foo: command not found" },
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe("command not found");
    expect(result.metadata).toEqual({
      exitCode: 127,
      stderr: "bash: foo: command not found",
    });
  });
});

describe("Issue", () => {
  it("constructs an error issue", () => {
    const issue: Issue = {
      severity: "error",
      file: "src/app.ts",
      line: 42,
      message: "Unexpected token",
    };
    expect(issue.severity).toBe("error");
    expect(issue.file).toBe("src/app.ts");
    expect(issue.line).toBe(42);
    expect(issue.message).toBe("Unexpected token");
  });

  it("constructs a warning issue without file/line", () => {
    const issue: Issue = {
      severity: "warning",
      message: "Deprecated API usage",
    };
    expect(issue.severity).toBe("warning");
    expect(issue.message).toBe("Deprecated API usage");
    expect(issue.file).toBeUndefined();
    expect(issue.line).toBeUndefined();
  });
});

describe("ValidationResult", () => {
  it("constructs a passing result with no issues", () => {
    const result: ValidationResult = {
      passed: true,
      issues: [],
    };
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("constructs a failing result with issues", () => {
    const issues: Issue[] = [
      { severity: "error", message: "missing import" },
      { severity: "warning", message: "unused variable" },
    ];
    const result: ValidationResult = {
      passed: false,
      issues,
    };
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
  });
});

describe("Message", () => {
  it("constructs a system message", () => {
    const msg: Message = {
      role: "system",
      content: "You are a coding assistant.",
    };
    expect(msg.role).toBe("system");
    expect(msg.content).toBe("You are a coding assistant.");
  });

  it("constructs a tool message with toolCallId", () => {
    const msg: Message = {
      role: "tool",
      content: "result output",
      toolCallId: "call_abc123",
    };
    expect(msg.role).toBe("tool");
    expect(msg.content).toBe("result output");
    expect(msg.toolCallId).toBe("call_abc123");
  });
});

describe("LLMResponse", () => {
  it("constructs with actions and raw usage", () => {
    const actions: Action[] = [
      { type: "tool_call", toolName: "read_file", parameters: { path: "x" } },
    ];
    const response: LLMResponse = {
      actions,
      rawUsage: { prompt: 150, completion: 80 },
    };
    expect(response.actions).toHaveLength(1);
    expect(response.rawUsage.prompt).toBe(150);
    expect(response.rawUsage.completion).toBe(80);
  });
});

describe("ToolDefinition", () => {
  it("constructs a tool definition with execute function", () => {
    const tool: ToolDefinition = {
      name: "read_file",
      description: "Reads a file from disk",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
      execute: async (_params) => ({
        success: true,
        output: "stub",
      }),
    };
    expect(tool.name).toBe("read_file");
    expect(tool.parameters.type).toBe("object");
    expect(tool.parameters.required).toEqual(["path"]);
    expect(typeof tool.execute).toBe("function");
  });
});

describe("CommandCategory", () => {
  it("allows valid command categories", () => {
    const cat: CommandCategory = "file_read";
    expect(cat).toBe("file_read");
    const cats: CommandCategory[] = [
      "file_read",
      "file_write",
      "shell",
      "build_test",
      "network",
      "unknown",
    ];
    expect(cats).toHaveLength(6);
  });
});

describe("RiskLevel", () => {
  it("allows valid risk levels", () => {
    const level: RiskLevel = "safe";
    expect(level).toBe("safe");
    const levels: RiskLevel[] = ["safe", "warn", "block"];
    expect(levels).toHaveLength(3);
  });
});

describe("ClassificationResult", () => {
  it("constructs a classification result", () => {
    const result: ClassificationResult = {
      category: "shell",
      riskScore: 75,
      riskLevel: "warn",
      matchedRules: ["dangerous_cmd", "network_access"],
    };
    expect(result.category).toBe("shell");
    expect(result.riskScore).toBe(75);
    expect(result.riskLevel).toBe("warn");
    expect(result.matchedRules).toEqual(["dangerous_cmd", "network_access"]);
  });
});

describe("GuardrailRule", () => {
  it("constructs a guardrail rule", () => {
    const rule: GuardrailRule = {
      pattern: "rm\\s+-rf",
      score: 100,
      description: "Recursive force delete",
    };
    expect(rule.pattern).toBe("rm\\s+-rf");
    expect(rule.score).toBe(100);
    expect(rule.description).toBe("Recursive force delete");
  });
});

describe("ApprovalState", () => {
  it("allows valid approval states", () => {
    const state: ApprovalState = "idle";
    expect(state).toBe("idle");
    const states: ApprovalState[] = [
      "idle",
      "waiting",
      "approved",
      "denied",
      "timeout",
    ];
    expect(states).toHaveLength(5);
  });
});

describe("ApprovalDecision", () => {
  it("allows valid approval decisions", () => {
    const decision: ApprovalDecision = "approve";
    expect(decision).toBe("approve");
    const decisions: ApprovalDecision[] = ["approve", "deny", "approve_all"];
    expect(decisions).toHaveLength(3);
  });
});

describe("ConversationTurn", () => {
  it("constructs a conversation turn", () => {
    const turn: ConversationTurn = {
      role: "assistant",
      content: "I will read the file.",
      timestamp: 1700000000000,
      tokenCount: 42,
    };
    expect(turn.role).toBe("assistant");
    expect(turn.content).toBe("I will read the file.");
    expect(turn.timestamp).toBe(1700000000000);
    expect(turn.tokenCount).toBe(42);
  });
});

describe("CompressedSummary", () => {
  it("constructs a compressed summary", () => {
    const summary: CompressedSummary = {
      originalTask: "Fix TypeScript errors",
      approaches: ["check tsconfig", "run tsc --noEmit"],
      keyFindings: ["strictNullChecks causes most errors"],
      failures: [],
      compressedAt: 1700000000000,
    };
    expect(summary.originalTask).toBe("Fix TypeScript errors");
    expect(summary.approaches).toHaveLength(2);
    expect(summary.keyFindings).toHaveLength(1);
    expect(summary.failures).toEqual([]);
    expect(summary.compressedAt).toBe(1700000000000);
  });
});

describe("LoopConfig", () => {
  it("constructs a loop config", () => {
    const config: LoopConfig = {
      maxRounds: 10,
      maxConsecutiveFailures: 3,
      llmRetryAttempts: 2,
    };
    expect(config.maxRounds).toBe(10);
    expect(config.maxConsecutiveFailures).toBe(3);
    expect(config.llmRetryAttempts).toBe(2);
  });
});

describe("LoopState", () => {
  it("constructs a loop state", () => {
    const state: LoopState = {
      round: 1,
      consecutiveFailures: 0,
      conversationHistory: [],
      compressedSummary: null,
      finished: false,
      finalResult: "",
    };
    expect(state.round).toBe(1);
    expect(state.consecutiveFailures).toBe(0);
    expect(state.finished).toBe(false);
    expect(state.compressedSummary).toBeNull();
  });
});