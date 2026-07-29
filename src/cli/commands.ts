import * as fs from "node:fs";
import * as readline from "node:readline";
import * as path from "node:path";
import yaml from "js-yaml";
import type { LLMProvider } from "../providers/interface.js";
import type { GuardrailRule, ToolDefinition } from "../core/types.js";
import type { AppConfig } from "../config/loader.js";
import { loadConfig } from "../config/loader.js";
import { getApiKey } from "./setup.js";
import { createProvider } from "../providers/factory.js";
import type { LLMConfig } from "../providers/factory.js";
import { createReadFileTool } from "../tools/read-file.js";
import { createWriteFileTool } from "../tools/write-file.js";
import { createShellTool } from "../tools/shell.js";
import { createRunTestsTool } from "../tools/run-tests.js";
import { createRunLintTool } from "../tools/run-lint.js";
import { GuardOrchestrator } from "../governance/guard.js";
import type { ApprovalRequest, ApprovalDecision } from "../governance/approval-fsm.js";
import { AgentLoop } from "../core/loop.js";

function loadGuardrailRules(rulesFile: string): GuardrailRule[] {
  if (!fs.existsSync(rulesFile)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(rulesFile, "utf-8");
    const parsed = yaml.load(raw) as { rules?: GuardrailRule[] } | undefined;
    return parsed?.rules ?? [];
  } catch {
    return [];
  }
}

function createTools(config: AppConfig): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  const enabled = config.tools.enabled;

  if (enabled.includes("read_file")) tools.push(createReadFileTool());
  if (enabled.includes("write_file")) tools.push(createWriteFileTool());
  if (enabled.includes("shell")) tools.push(createShellTool());
  if (enabled.includes("run_tests")) tools.push(createRunTestsTool(config.feedback.testCommand));
  if (enabled.includes("run_lint")) tools.push(createRunLintTool(config.feedback.lintCommand));

  return tools;
}

function createHITLHandler(
  verbose: boolean,
): (request: ApprovalRequest) => Promise<ApprovalDecision> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return async (request: ApprovalRequest): Promise<ApprovalDecision> => {
    if (verbose) {
      console.log(`\n[HITL] Action requires approval:`);
      console.log(`  Action: ${request.actionDescription}`);
      console.log(`  Risk: ${request.riskLevel}`);
      console.log(`  Matched rules: ${request.matchedRules.join(", ")}`);
    }

    return new Promise((resolve) => {
      rl.question(
        `\nAllow this action? [y]es / [n]o / [a]pprove all: `,
        (answer: string) => {
          const trimmed = answer.trim().toLowerCase();
          if (trimmed === "a" || trimmed === "approve" || trimmed === "approve all") {
            resolve("approve_all");
          } else if (trimmed === "y" || trimmed === "yes") {
            resolve("approve");
          } else {
            resolve("deny");
          }
        },
      );
    });
  };
}

export async function runTask(
  task: string,
  configPath: string,
  verbose: boolean = false,
  injectProvider?: LLMProvider,
): Promise<string> {
  const config = loadConfig(configPath);

  let provider: LLMProvider;
  if (injectProvider) {
    provider = injectProvider;
  } else {
    const apiKey = await getApiKey(config.llm.provider);
    if (!apiKey) {
      throw new Error(
        `No API key found for provider "${config.llm.provider}". Run "ccg setup" to configure.`,
      );
    }

    const llmConfig: LLMConfig = (() => {
      const provider = config.llm.provider;
      switch (provider) {
        case "openai":
          return { provider, apiKey, model: config.llm.model };
        case "anthropic":
          return { provider, apiKey, model: config.llm.model };
        case "ollama":
          return { provider, baseURL: "http://localhost:11434", model: config.llm.model };
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    })();
    provider = createProvider(llmConfig);
  }

  const rulesFile = path.resolve(path.dirname(configPath), config.guardrails.rulesFile);
  const rules = loadGuardrailRules(rulesFile);

  const tools = createTools(config);

  const guard = new GuardOrchestrator({
    rules,
    sandboxConfig: {
      workspace: config.guardrails.sandbox.workspace,
      allowedCommands: config.guardrails.sandbox.allowedCommands,
      blockedCommands: config.guardrails.sandbox.blockedCommands,
      allowNetwork: config.guardrails.sandbox.allowNetwork,
    },
    hitlEnabled: config.guardrails.hitlEnabled,
    hitlTimeout: config.guardrails.hitlTimeout,
    onApprovalRequired: createHITLHandler(verbose),
  });

  const loop = new AgentLoop({
    provider,
    guard,
    tools,
    maxRounds: config.llm.maxRounds,
    maxConsecutiveFailures: 3,
    systemPrompt: "You are a coding agent. Complete the user's task using the available tools.",
    projectContext: "",
  });

  if (verbose) {
    console.log(`[CCG] Running task: ${task}`);
    console.log(`[CCG] Provider: ${config.llm.provider}, Model: ${config.llm.model}`);
    console.log(`[CCG] Max rounds: ${config.llm.maxRounds}`);
    console.log(`[CCG] Tools: ${config.tools.enabled.join(", ")}`);
    console.log(`[CCG] HITL: ${config.guardrails.hitlEnabled ? "enabled" : "disabled"}`);
    console.log(`[CCG] Guardrail rules: ${rules.length}`);
  }

  const result = await loop.run(task);

  if (verbose) {
    const state = loop.getState();
    console.log(`\n[CCG] Completed in ${state.round} rounds`);
    console.log(`[CCG] Result: ${result}`);
  }

  return result;
}