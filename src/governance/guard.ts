import type { Action, GuardrailRule } from "../core/types.js";
import { classifyCommand } from "./classifier.js";
import { scoreRisk } from "./risk-scorer.js";
import { checkSandbox } from "./sandbox.js";
import type { SandboxConfig } from "./sandbox.js";
import type { ApprovalRequest, ApprovalDecision } from "./approval-fsm.js";

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
      return `Write file: ${action.parameters?.filePath ?? ""}`;
    case "read_file":
      return `Read file: ${action.parameters?.filePath ?? ""}`;
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

  constructor(config: GuardOrchestratorConfig) {
    this.config = config;
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
      const decision = await this.config.onApprovalRequired({
        actionDescription: describeAction(action),
        riskLevel: scored.riskLevel,
        matchedRules: scored.matchedRules,
      });

      if (decision === "deny") {
        return {
          allowed: false,
          riskLevel: "warn",
          reason: "Action denied by user",
          matchedRules: scored.matchedRules,
        };
      }
    }

    const sandboxResult = checkSandbox(action, this.config.sandboxConfig);
    if (!sandboxResult.allowed) {
      return {
        allowed: false,
        riskLevel: scored.riskLevel,
        reason: sandboxResult.reason,
        matchedRules: scored.matchedRules,
      };
    }

    return {
      allowed: true,
      riskLevel: scored.riskLevel,
      matchedRules: scored.matchedRules,
    };
  }
}

export { describeAction };