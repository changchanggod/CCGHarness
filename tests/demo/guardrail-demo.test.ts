import { describe, it, expect, vi } from "vitest";
import { MockLLMProvider } from "../../src/providers/mock.js";
import { GuardOrchestrator } from "../../src/governance/guard.js";
import type { Action, LLMResponse, GuardrailRule } from "../../src/core/types.js";
import type { SandboxConfig } from "../../src/governance/sandbox.js";
import type { ApprovalRequest, ApprovalDecision } from "../../src/governance/approval-fsm.js";
import { AgentLoop } from "../../src/core/loop.js";
import type { AgentLoopConfig } from "../../src/core/loop.js";

const dangerousRules: GuardrailRule[] = [
  { pattern: "rm\\s+(-[rRf]+\\s+)+[/~]", score: 100, description: "Recursive force delete on root/home" },
  { pattern: "shutdown|reboot|halt", score: 100, description: "System shutdown/reboot" },
  { pattern: "curl.*\\|\\s*bash", score: 100, description: "Curl pipe bash" },
];

const sandboxConfig: SandboxConfig = {
  workspace: "/tmp/workspace",
  allowedCommands: [],
  blockedCommands: [],
  allowNetwork: false,
};

function act(toolName: string, params: Record<string, unknown> = {}): Action {
  return { type: "tool_call", toolName, parameters: params };
}

function makeGuardOrchestrator(overrides: {
  rules?: GuardrailRule[];
  hitlEnabled?: boolean;
  onApprovalRequired?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
} = {}) {
  return new GuardOrchestrator({
    rules: overrides.rules ?? dangerousRules,
    sandboxConfig,
    hitlEnabled: overrides.hitlEnabled ?? false,
    hitlTimeout: 5000,
    onApprovalRequired: overrides.onApprovalRequired ?? (async () => "approve"),
  });
}

describe("Mechanism Demo 1: Guardrail intercepting dangerous action", () => {
  describe("rm -rf / is blocked by GuardOrchestrator", () => {
    it("blocks shell(rm -rf /) with riskLevel 'block' and matched rule", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("shell", { command: "rm -rf /" }));

      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe("block");
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain("blocked");
      expect(result.matchedRules).toContain("Recursive force delete on root/home");
    });

    it("blocks rm -rf ~ (home directory) with same rule", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("shell", { command: "rm -rf ~" }));

      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe("block");
      expect(result.matchedRules).toContain("Recursive force delete on root/home");
    });

    it("blocks rm -Rf /etc with same rule", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("shell", { command: "rm -Rf /etc" }));

      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe("block");
      expect(result.matchedRules).toContain("Recursive force delete on root/home");
    });
  });

  describe("safe commands are not blocked", () => {
    it("allows shell(echo hello)", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("shell", { command: "echo hello" }));

      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe("safe");
      expect(result.matchedRules).toEqual([]);
    });

    it("allows shell(ls -la)", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("shell", { command: "ls -la" }));

      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe("safe");
      expect(result.matchedRules).toEqual([]);
    });
  });

  describe("shutdown is blocked", () => {
    it("blocks shell(shutdown now)", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("shell", { command: "shutdown now" }));

      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe("block");
      expect(result.matchedRules).toContain("System shutdown/reboot");
    });
  });

  describe("MockLLM + GuardOrchestrator integration via AgentLoop", () => {
    it("mock LLM produces rm -rf /, guard blocks it, loop continues and stops", async () => {
      const responses: LLMResponse[] = [
        {
          actions: [act("shell", { command: "rm -rf /" })],
          rawUsage: { prompt: 10, completion: 5 },
        },
        {
          actions: [{ type: "stop", summary: "Task completed after guard blocked dangerous action" }],
          rawUsage: { prompt: 10, completion: 5 },
        },
      ];

      const config: AgentLoopConfig = {
        provider: new MockLLMProvider(responses),
        guard: makeGuardOrchestrator(),
        tools: [],
        maxRounds: 10,
        maxConsecutiveFailures: 3,
        systemPrompt: "You are a helpful assistant.",
        projectContext: "",
      };

      const loop = new AgentLoop(config);
      const result = await loop.run("Delete everything");

      expect(result).toContain("Task completed");

      const state = loop.getState();
      expect(state.finished).toBe(true);
      expect(state.round).toBe(2);

      const guardBlockedTurn = state.conversationHistory.find(
        (t) => t.role === "tool" && t.content.includes("Guard blocked")
      );
      expect(guardBlockedTurn).toBeDefined();
      expect(guardBlockedTurn!.content).toContain("blocked");
    });
  });
});