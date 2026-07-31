import type { Action, GuardrailRule } from "../core/types.js";
import { classifyCommand } from "./classifier.js";
import { scoreRisk } from "./risk-scorer.js";
import { checkSandbox } from "./sandbox.js";
import type { SandboxConfig } from "./sandbox.js";
import type { ApprovalRequest, ApprovalDecision } from "./approval-fsm.js";
import { ApprovalFSM } from "./approval-fsm.js";

export interface GuardResult {
  allowed: boolean;
  riskLevel: string;
  reason?: string;
  matchedRules: string[];
}

export interface GuardOrchestratorConfig {
  rules: GuardrailRule[];
  sandboxConfig: SandboxConfig;
  hitlEnabled: boolean;
  hitlTimeout: number;
  onApprovalRequired: (request: ApprovalRequest) => Promise<ApprovalDecision>;
}

function describeAction(action: Action): string {
  if (action.type === "stop") return "Stop execution";
  const toolName = action.toolName ?? "unknown";

  switch (toolName) {
    case "shell":
      return `Execute shell command: ${action.parameters?.command ?? ""}`;
    case "write_file":
      return `Write file: ${action.parameters?.path ?? ""}`;
    case "read_file":
      return `Read file: ${action.parameters?.path ?? ""}`;
    case "run_tests":
      return "Run tests";
    case "run_lint":
      return "Run lint";
    default:
      return `Execute ${toolName}`;
  }
}

export class GuardOrchestrator {
  private config: GuardOrchestratorConfig;
  private fsm: ApprovalFSM;

  constructor(config: GuardOrchestratorConfig) {
    this.config = config;
    this.fsm = new ApprovalFSM({ timeoutMs: config.hitlTimeout * 1000 });
  }

  async guard(action: Action): Promise<GuardResult> {
    const classification = classifyCommand(action);
    const scored = scoreRisk(action, classification, this.config.rules);

    if (scored.riskLevel === "block") {
      return {
        allowed: false,
        riskLevel: scored.riskLevel,
        reason: "Action blocked by guardrail rules",
        matchedRules: scored.matchedRules,
      };
    }

    if (scored.riskLevel === "warn" && this.config.hitlEnabled) {
      const request: ApprovalRequest = {
        actionDescription: describeAction(action),
        riskLevel: scored.riskLevel,
        matchedRules: scored.matchedRules,
      };

      this.fsm.requestApproval(request);

      if (this.fsm.getState() === "approved") {
        this.fsm.reset();
        return this.getSandboxResult(action, scored.riskLevel, scored.matchedRules);
      }

      if (this.fsm.getState() === "timeout") {
        this.fsm.reset();
        return {
          allowed: false,
          riskLevel: "warn",
          reason: "HITL approval timed out",
          matchedRules: scored.matchedRules,
        };
      }

      const decision = await this.config.onApprovalRequired(request);

      if (decision === "approve_all") {
        this.fsm.approveAll();
      } else {
        this.fsm.submitDecision(decision);
      }

      const state = this.fsm.getState();

      if (state === "denied" || state === "timeout") {
        this.fsm.reset();
        return {
          allowed: false,
          riskLevel: "warn",
          reason: state === "timeout" ? "HITL approval timed out" : "Action denied by user",
          matchedRules: scored.matchedRules,
        };
      }

      this.fsm.reset();
    }

    return this.getSandboxResult(action, scored.riskLevel, scored.matchedRules);
  }

  private getSandboxResult(action: Action, riskLevel: string, matchedRules: string[]): GuardResult {
    const sandboxResult = checkSandbox(action, this.config.sandboxConfig);
    if (!sandboxResult.allowed) {
      return {
        allowed: false,
        riskLevel,
        reason: sandboxResult.reason,
        matchedRules,
      };
    }

    return {
      allowed: true,
      riskLevel,
      matchedRules,
    };
  }
}

export { describeAction };