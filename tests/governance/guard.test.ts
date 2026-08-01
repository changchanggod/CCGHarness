import { describe, it, expect, vi, beforeEach } from "vitest";
import { GuardOrchestrator } from "../../src/governance/guard.js";
import type { Action, GuardrailRule } from "../../src/core/types.js";
import type { SandboxConfig } from "../../src/governance/sandbox.js";
import type { ApprovalRequest, ApprovalDecision } from "../../src/governance/approval-fsm.js";

const defaultRules: GuardrailRule[] = [
  { pattern: "rm\\s+(-[rRf]+\\s+)+[/~]", score: 100, description: "Recursive force delete on root/home" },
  { pattern: "git\\s+push\\s+.*--force", score: 60, description: "Force push" },
  { pattern: "shutdown|reboot|halt", score: 100, description: "System shutdown/reboot" },
];

const sandboxConfig: SandboxConfig = {
  workspace: "/tmp/workspace",
  allowedCommands: ["echo", "ls", "git"],
  blockedCommands: ["rm"],
  allowNetwork: false,
};

function act(toolName: string, params: Record<string, unknown> = {}): Action {
  return { type: "tool_call", toolName, parameters: params };
}

function makeOrchestrator(overrides: {
  rules?: GuardrailRule[];
  sandboxConfig?: SandboxConfig;
  hitlEnabled?: boolean;
  onApprovalRequired?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
} = {}) {
  return new GuardOrchestrator({
    rules: overrides.rules ?? defaultRules,
    sandboxConfig: overrides.sandboxConfig ?? sandboxConfig,
    hitlEnabled: overrides.hitlEnabled ?? true,
    hitlTimeout: 5000,
    onApprovalRequired: overrides.onApprovalRequired ?? (async () => "approve"),
  });
}

describe("GuardOrchestrator", () => {
  describe("safe command", () => {
    it("passes a safe command", async () => {
      const orchestrator = makeOrchestrator();
      const result = await orchestrator.guard(act("shell", { command: "echo hello" }));
      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe("safe");
      expect(result.matchedRules).toEqual([]);
    });
  });

  describe("block", () => {
    it("rejects a blocked action", async () => {
      const orchestrator = makeOrchestrator();
      const result = await orchestrator.guard(act("shell", { command: "rm -rf /" }));
      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe("block");
      expect(result.reason).toBeDefined();
      expect(result.matchedRules).toContain("Recursive force delete on root/home");
    });
  });

  describe("warn with HITL", () => {
    it("passes when user approves a warn-level action", async () => {
      const onApprovalRequired = vi.fn(async (_request: ApprovalRequest) => "approve" as const);
      const orchestrator = makeOrchestrator({ onApprovalRequired });
      const result = await orchestrator.guard(act("shell", { command: "git push origin main --force" }));
      expect(onApprovalRequired).toHaveBeenCalledOnce();
      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe("warn");
      expect(result.matchedRules).toContain("Force push");
    });

    it("rejects when user denies a warn-level action", async () => {
      const onApprovalRequired = vi.fn(async (_request: ApprovalRequest) => "deny" as const);
      const orchestrator = makeOrchestrator({ onApprovalRequired });
      const result = await orchestrator.guard(act("shell", { command: "git push origin main --force" }));
      expect(onApprovalRequired).toHaveBeenCalledOnce();
      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe("warn");
      expect(result.reason).toBeDefined();
    });
  });

  describe("sandbox", () => {
    it("rejects a sandbox violation", async () => {
      const orchestrator = makeOrchestrator();
      const result = await orchestrator.guard(act("write_file", { path: "/etc/passwd", content: "x" }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain("outside workspace");
    });
  });

  describe("HITL disabled", () => {
    it("skips approval when HITL is disabled for warn-level action", async () => {
      const onApprovalRequired = vi.fn(async (_request: ApprovalRequest) => "approve" as const);
      const orchestrator = makeOrchestrator({ hitlEnabled: false, onApprovalRequired });
      const result = await orchestrator.guard(act("shell", { command: "git push origin main --force" }));
      expect(onApprovalRequired).not.toHaveBeenCalled();
      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe("warn");
    });
  });
});