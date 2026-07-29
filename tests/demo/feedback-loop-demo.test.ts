import { describe, it, expect } from "vitest";
import type { LLMResponse, ToolDefinition, ToolResult } from "../../src/core/types.js";
import { MockLLMProvider } from "../../src/providers/mock.js";
import { GuardOrchestrator } from "../../src/governance/guard.js";
import { AgentLoop } from "../../src/core/loop.js";
import type { AgentLoopConfig } from "../../src/core/loop.js";

function createFailingTool(): ToolDefinition {
  return {
    name: "dangerous_op",
    description: "An operation that always fails",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (): Promise<ToolResult> => {
      return { success: false, output: "", error: "Operation failed: permission denied" };
    },
  };
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

function createPermissiveGuard(): GuardOrchestrator {
  return new GuardOrchestrator({
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
  });
}

describe("Mechanism Demo 2: Feedback loop receives failure and adjusts", () => {
  describe("tool fails → loop records failure → continues with next tool → completes", () => {
    it("loop sees tool failure, adjusts, and completes successfully", async () => {
      const responses: LLMResponse[] = [
        {
          actions: [
            { type: "tool_call", toolName: "dangerous_op", parameters: {} },
          ],
          rawUsage: { prompt: 10, completion: 5 },
        },
        {
          actions: [
            { type: "tool_call", toolName: "echo", parameters: { message: "fallback plan worked" } },
          ],
          rawUsage: { prompt: 10, completion: 5 },
        },
        {
          actions: [
            { type: "stop", summary: "Task completed: dangerous_op failed, used fallback" },
          ],
          rawUsage: { prompt: 10, completion: 5 },
        },
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createPermissiveGuard(),
        tools: [createFailingTool(), createEchoTool()],
        maxRounds: 10,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "",
      };

      const loop = new AgentLoop(config);
      const result = await loop.run("Perform risky operation with fallback");

      expect(result).toContain("Task completed");

      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.round).toBe(3);

      const failureTurns = state.conversationHistory.filter(
        (t) => t.role === "tool" && t.content.includes("Operation failed")
      );
      expect(failureTurns.length).toBe(1);
      expect(failureTurns[0].content).toContain("permission denied");

      const successTurns = state.conversationHistory.filter(
        (t) => t.role === "tool" && t.content.includes("echo:")
      );
      expect(successTurns.length).toBe(1);
      expect(successTurns[0].content).toContain("fallback plan worked");

      expect(state.consecutiveFailures).toBe(0);
    });
  });

  describe("consecutive failures reset after success", () => {
    it("failure counter resets to 0 after a successful tool call", async () => {
      const responses: LLMResponse[] = [
        {
          actions: [
            { type: "tool_call", toolName: "dangerous_op", parameters: {} },
          ],
          rawUsage: { prompt: 10, completion: 5 },
        },
        {
          actions: [
            { type: "tool_call", toolName: "echo", parameters: { message: "recovered" } },
          ],
          rawUsage: { prompt: 10, completion: 5 },
        },
        {
          actions: [
            { type: "stop", summary: "recovered after failure" },
          ],
          rawUsage: { prompt: 10, completion: 5 },
        },
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createPermissiveGuard(),
        tools: [createFailingTool(), createEchoTool()],
        maxRounds: 10,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "",
      };

      const loop = new AgentLoop(config);
      await loop.run("Recover from failure");

      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.consecutiveFailures).toBe(0);
    });
  });

  describe("loop continues after tool failure feedback", () => {
    it("loop does not stop after a single tool failure", async () => {
      const responses: LLMResponse[] = [
        {
          actions: [
            { type: "tool_call", toolName: "dangerous_op", parameters: {} },
          ],
          rawUsage: { prompt: 10, completion: 5 },
        },
        {
          actions: [
            { type: "tool_call", toolName: "dangerous_op", parameters: {} },
          ],
          rawUsage: { prompt: 10, completion: 5 },
        },
        {
          actions: [
            { type: "stop", summary: "done despite failures" },
          ],
          rawUsage: { prompt: 10, completion: 5 },
        },
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: createPermissiveGuard(),
        tools: [createFailingTool()],
        maxRounds: 10,
        maxConsecutiveFailures: 5,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "",
      };

      const loop = new AgentLoop(config);
      const result = await loop.run("Handle multiple failures");

      expect(result).toContain("done despite failures");

      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.round).toBe(3);

      const failureCount = state.conversationHistory.filter(
        (t) => t.role === "tool" && t.content.includes("permission denied")
      ).length;
      expect(failureCount).toBe(2);
    });
  });
});