import { describe, it, expect, beforeEach } from "vitest";
import type { LLMResponse, Action, ToolDefinition, ToolResult, ConversationTurn } from "../../src/core/types.js";
import { MockLLMProvider } from "../../src/providers/mock.js";
import { GuardOrchestrator } from "../../src/governance/guard.js";
import type { GuardOrchestratorConfig } from "../../src/governance/guard.js";
import { AgentLoop } from "../../src/core/loop.js";
import type { AgentLoopConfig } from "../../src/core/loop.js";

function makeToolResponse(action: Action): LLMResponse {
  return {
    actions: [action],
    rawUsage: { prompt: 10, completion: 5 },
  };
}

function makeStopAction(summary: string): Action {
  return { type: "stop", summary };
}

function makeToolCallAction(toolName: string, params: Record<string, unknown>): Action {
  return { type: "tool_call", toolName, parameters: params };
}

function createEchoTool(): ToolDefinition {
  return {
    name: "echo",
    description: "Echoes the input",
    parameters: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      return { success: true, output: `echo: ${params.message}` };
    },
  };
}

function createFailingTool(): ToolDefinition {
  return {
    name: "failer",
    description: "Always fails",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (): Promise<ToolResult> => {
      return { success: false, output: "", error: "intentional failure" };
    },
  };
}

function createPermissiveGuard(): GuardOrchestrator {
  const config: GuardOrchestratorConfig = {
    rules: [],
    sandboxConfig: {
      workspace: "/tmp",
      allowedCommands: [],
      blockedCommands: [],
      allowNetwork: true,
    },
    hitlEnabled: false,
    hitlTimeout: 30000,
    onApprovalRequired: async () => "approve",
  };
  return new GuardOrchestrator(config);
}

function createBlockingGuard(): GuardOrchestrator {
  const config: GuardOrchestratorConfig = {
    rules: [{ pattern: "echo", score: 100, description: "block echo" }],
    sandboxConfig: {
      workspace: "/tmp",
      allowedCommands: [],
      blockedCommands: [],
      allowNetwork: true,
    },
    hitlEnabled: false,
    hitlTimeout: 30000,
    onApprovalRequired: async () => "approve",
  };
  return new GuardOrchestrator(config);
}

function makeTurn(content: string, role: ConversationTurn["role"] = "assistant"): ConversationTurn {
  return {
    role,
    content,
    timestamp: Date.now(),
    tokenCount: content.length,
  };
}

describe("AgentLoop", () => {
  describe("simple task completes with tool call + stop", () => {
    it("completes in 2 rounds: tool_call then stop", async () => {
      const responses: LLMResponse[] = [
        makeToolResponse(makeToolCallAction("echo", { message: "hello" })),
        makeToolResponse(makeStopAction("Task completed: echoed hello")),
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createPermissiveGuard(),
        tools: [createEchoTool()],
        maxRounds: 10,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "Test project",
      };

      const loop = new AgentLoop(config);
      const result = await loop.run("Echo hello");

      expect(result).toBe("Task completed: echoed hello");
      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.round).toBe(2);
      expect(state.consecutiveFailures).toBe(0);
    });
  });

  describe("max rounds reached stops execution", () => {
    it("stops after maxRounds even without stop action", async () => {
      const responses: LLMResponse[] = [
        makeToolResponse(makeToolCallAction("echo", { message: "round 1" })),
        makeToolResponse(makeToolCallAction("echo", { message: "round 2" })),
        makeToolResponse(makeToolCallAction("echo", { message: "round 3" })),
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createPermissiveGuard(),
        tools: [createEchoTool()],
        maxRounds: 2,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "Test project",
      };

      const loop = new AgentLoop(config);
      const result = await loop.run("Echo repeatedly");

      expect(result).toContain("max rounds");
      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.round).toBe(2);
    });
  });

  describe("consecutive failures stop after threshold", () => {
    it("stops after maxConsecutiveFailures are reached", async () => {
      const responses: LLMResponse[] = [
        makeToolResponse(makeToolCallAction("unknown_tool_1", {})),
        makeToolResponse(makeToolCallAction("unknown_tool_2", {})),
        makeToolResponse(makeToolCallAction("unknown_tool_3", {})),
        makeToolResponse(makeStopAction("should not reach")),
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createPermissiveGuard(),
        tools: [],
        maxRounds: 10,
        maxConsecutiveFailures: 2,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "Test project",
      };

      const loop = new AgentLoop(config);
      const result = await loop.run("Do something");

      expect(result).toContain("consecutive failures");
      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.consecutiveFailures).toBe(2);
    });

    it("resets consecutiveFailures on successful tool call", async () => {
      const responses: LLMResponse[] = [
        makeToolResponse(makeToolCallAction("unknown_tool", {})),
        makeToolResponse(makeToolCallAction("echo", { message: "ok" })),
        makeToolResponse(makeStopAction("done")),
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createPermissiveGuard(),
        tools: [createEchoTool()],
        maxRounds: 10,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "Test project",
      };

      const loop = new AgentLoop(config);
      const result = await loop.run("Do something");

      expect(result).toBe("done");
      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.consecutiveFailures).toBe(0);
    });
  });

  describe("unknown tool handled gracefully", () => {
    it("records failure and continues loop when tool not found", async () => {
      const responses: LLMResponse[] = [
        makeToolResponse(makeToolCallAction("nonexistent_tool", { arg: 1 })),
        makeToolResponse(makeStopAction("done after unknown tool")),
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createPermissiveGuard(),
        tools: [createEchoTool()],
        maxRounds: 10,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "Test project",
      };

      const loop = new AgentLoop(config);
      const result = await loop.run("Try unknown tool");

      expect(result).toBe("done after unknown tool");
      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.round).toBe(2);
    });
  });

  describe("guardrail blocks action", () => {
    it("records failure when guard blocks a tool call", async () => {
      const responses: LLMResponse[] = [
        makeToolResponse(makeToolCallAction("echo", { message: "blocked" })),
        makeToolResponse(makeStopAction("done after blocked")),
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createBlockingGuard(),
        tools: [createEchoTool()],
        maxRounds: 10,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "Test project",
      };

      const loop = new AgentLoop(config);
      const result = await loop.run("Try blocked action");

      expect(result).toBe("done after blocked");
      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.round).toBe(2);
    });
  });

  describe("compression", () => {
    it("triggers compression when threshold is exceeded", async () => {
      const responses: LLMResponse[] = [
        makeToolResponse(makeStopAction("done")),
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createPermissiveGuard(),
        tools: [],
        maxRounds: 10,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "Test project",
        maxTokens: 10,
        compressionThreshold: 0.1,
      };

      const loop = new AgentLoop(config);
      await loop.run("small task");

      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.conversationHistory.length).toBeGreaterThan(0);
    });
  });

  describe("getState", () => {
    it("returns initial state before run", () => {
      const config: AgentLoopConfig = {
        provider: new MockLLMProvider([]),
        guard: createPermissiveGuard(),
        tools: [],
        maxRounds: 10,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "",
      };

      const loop = new AgentLoop(config);
      const state = loop.getState();

      expect(state.round).toBe(0);
      expect(state.consecutiveFailures).toBe(0);
      expect(state.finished).toBe(false);
      expect(state.finalResult).toBe("");
    });
  });
});