import { describe, it, expect, vi } from "vitest";
import { GuardOrchestrator } from "../../src/governance/guard.js";
import { classifyCommand } from "../../src/governance/classifier.js";
import { scoreRisk, getCommandString } from "../../src/governance/risk-scorer.js";
import { checkSandbox } from "../../src/governance/sandbox.js";
import type { Action, GuardrailRule } from "../../src/core/types.js";
import type { SandboxConfig } from "../../src/governance/sandbox.js";
import type { ApprovalRequest, ApprovalDecision } from "../../src/governance/approval-fsm.js";

const governanceRules: GuardrailRule[] = [
  { pattern: "rm\\s+(-[rRf]+\\s+)+[/~]", score: 100, description: "Recursive force delete on root/home" },
  { pattern: "git\\s+push\\s+.*--force", score: 60, description: "Force push" },
  { pattern: "shutdown|reboot|halt", score: 100, description: "System shutdown/reboot" },
  { pattern: "curl\\s+.*\\|\\s*bash", score: 100, description: "Curl pipe bash" },
  { pattern: "chmod\\s+777", score: 50, description: "Chmod 777" },
];

const sandboxConfig: SandboxConfig = {
  workspace: "/tmp/workspace",
  allowedCommands: ["echo", "ls", "git", "cat"],
  blockedCommands: ["rm"],
  allowNetwork: false,
};

function act(toolName: string, params: Record<string, unknown> = {}): Action {
  return { type: "tool_call", toolName, parameters: params };
}

function makeGuardOrchestrator(overrides: {
  rules?: GuardrailRule[];
  sandboxConfig?: SandboxConfig;
  hitlEnabled?: boolean;
  onApprovalRequired?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
} = {}) {
  return new GuardOrchestrator({
    rules: overrides.rules ?? governanceRules,
    sandboxConfig: overrides.sandboxConfig ?? sandboxConfig,
    hitlEnabled: overrides.hitlEnabled ?? true,
    hitlTimeout: 5000,
    onApprovalRequired: overrides.onApprovalRequired ?? (async () => "approve"),
  });
}

describe("Mechanism Demo 3: Deep dimension — Governance pipeline (all 4 layers)", () => {
  describe("Layer 1: Classifier", () => {
    it("classifies read_file as file_read", () => {
      const result = classifyCommand(act("read_file", { path: "src/main.ts" }));
      expect(result.category).toBe("file_read");
    });

    it("classifies shell as shell", () => {
      const result = classifyCommand(act("shell", { command: "git push" }));
      expect(result.category).toBe("shell");
    });

    it("classifies write_file as file_write", () => {
      const result = classifyCommand(act("write_file", { path: "test.txt" }));
      expect(result.category).toBe("file_write");
    });

    it("classifies run_tests as build_test", () => {
      const result = classifyCommand(act("run_tests", {}));
      expect(result.category).toBe("build_test");
    });
  });

  describe("Layer 2: Risk Scorer", () => {
    it("safe read_file scores 0 and is safe", () => {
      const classification = classifyCommand(act("read_file", { path: "src/main.ts" }));
      const result = scoreRisk(act("read_file", { path: "src/main.ts" }), classification, governanceRules);
      expect(result.riskScore).toBe(0);
      expect(result.riskLevel).toBe("safe");
      expect(result.matchedRules).toEqual([]);
    });

    it("warn-level git push --force scores 60", () => {
      const action = act("shell", { command: "git push origin main --force" });
      const classification = classifyCommand(action);
      const result = scoreRisk(action, classification, governanceRules);
      expect(result.riskScore).toBe(60);
      expect(result.riskLevel).toBe("warn");
      expect(result.matchedRules).toContain("Force push");
    });

    it("block-level rm -rf / scores 100", () => {
      const action = act("shell", { command: "rm -rf /" });
      const classification = classifyCommand(action);
      const result = scoreRisk(action, classification, governanceRules);
      expect(result.riskScore).toBe(100);
      expect(result.riskLevel).toBe("block");
      expect(result.matchedRules).toContain("Recursive force delete on root/home");
    });

    it("multiple rules accumulate score", () => {
      const rules: GuardrailRule[] = [
        { pattern: "rm", score: 40, description: "Contains rm" },
        { pattern: "rf", score: 40, description: "Contains rf" },
      ];
      const action = act("shell", { command: "rm -rf /tmp" });
      const classification = classifyCommand(action);
      const result = scoreRisk(action, classification, rules);
      expect(result.riskScore).toBe(80);
      expect(result.riskLevel).toBe("block");
      expect(result.matchedRules).toHaveLength(2);
    });
  });

  describe("Layer 3: GuardOrchestrator — action classification", () => {
    it("safe: read_file passes through guard", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("read_file", { path: "/tmp/workspace/main.ts" }));
      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe("safe");
      expect(result.matchedRules).toEqual([]);
    });

    it("warn: git push --force triggers HITL, approved by mock callback", async () => {
      const onApprovalRequired = vi.fn(async (_req: ApprovalRequest) => "approve" as const);
      const guard = makeGuardOrchestrator({ onApprovalRequired });
      const result = await guard.guard(act("shell", { command: "git push origin main --force" }));

      expect(onApprovalRequired).toHaveBeenCalledOnce();
      const call = onApprovalRequired.mock.calls[0][0];
      expect(call.riskLevel).toBe("warn");
      expect(call.matchedRules).toContain("Force push");
      expect(call.actionDescription).toContain("git push");

      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe("warn");
    });

    it("warn: git push --force denied by mock HITL callback", async () => {
      const onApprovalRequired = vi.fn(async (_req: ApprovalRequest) => "deny" as const);
      const guard = makeGuardOrchestrator({ onApprovalRequired });
      const result = await guard.guard(act("shell", { command: "git push origin main --force" }));

      expect(onApprovalRequired).toHaveBeenCalledOnce();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("denied");
    });

    it("block: rm -rf / is rejected immediately, no HITL", async () => {
      const onApprovalRequired = vi.fn(async () => "approve" as const);
      const guard = makeGuardOrchestrator({ onApprovalRequired });
      const result = await guard.guard(act("shell", { command: "rm -rf /" }));

      expect(onApprovalRequired).not.toHaveBeenCalled();
      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe("block");
      expect(result.matchedRules).toContain("Recursive force delete on root/home");
    });
  });

  describe("Layer 4: Sandbox enforcement", () => {
    it("write_file outside workspace is rejected by sandbox", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("write_file", { path: "/etc/passwd", content: "x" }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("outside workspace");
    });

    it("write_file inside workspace passes sandbox", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("write_file", { path: "/tmp/workspace/output.txt" }));
      expect(result.allowed).toBe(true);
    });

    it("shell with blocked command is rejected by sandbox", async () => {
      const guard = makeGuardOrchestrator();
      const result = await guard.guard(act("shell", { command: "rm file.txt" }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("blocked");
    });

    it("shell with allowed command passes sandbox when allowlist is active", async () => {
      const guard = makeGuardOrchestrator({
        sandboxConfig: {
          workspace: "/tmp/workspace",
          allowedCommands: ["echo", "ls"],
          blockedCommands: [],
          allowNetwork: false,
        },
      });
      const result = await guard.guard(act("shell", { command: "echo hello" }));
      expect(result.allowed).toBe(true);
    });
  });

  describe("End-to-end governance pipeline: 3 actions with different risk levels", () => {
    it("correctly classifies and handles safe, warn, and block actions", async () => {
      const onApprovalRequired = vi.fn(async (_req: ApprovalRequest) => "approve" as const);
      const guard = makeGuardOrchestrator({ onApprovalRequired });

      const safeResult = await guard.guard(act("read_file", { path: "/tmp/workspace/README.md" }));
      expect(safeResult.allowed).toBe(true);
      expect(safeResult.riskLevel).toBe("safe");
      expect(safeResult.matchedRules).toEqual([]);

      const warnResult = await guard.guard(act("shell", { command: "git push origin main --force" }));
      expect(onApprovalRequired).toHaveBeenCalledTimes(1);
      expect(warnResult.allowed).toBe(true);
      expect(warnResult.riskLevel).toBe("warn");
      expect(warnResult.matchedRules).toContain("Force push");

      const blockResult = await guard.guard(act("shell", { command: "rm -rf /" }));
      expect(onApprovalRequired).toHaveBeenCalledTimes(1);
      expect(blockResult.allowed).toBe(false);
      expect(blockResult.riskLevel).toBe("block");
      expect(blockResult.reason).toContain("blocked");
      expect(blockResult.matchedRules).toContain("Recursive force delete on root/home");
    });
  });
});