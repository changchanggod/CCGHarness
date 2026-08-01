import * as fs from "node:fs";
import * as readline from "node:readline";
import * as path from "node:path";
import * as os from "node:os";
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

const PROVIDERS_WITHOUT_KEY = new Set(["ollama"]);

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
  sharedRl?: readline.Interface,
): (request: ApprovalRequest) => Promise<ApprovalDecision> {
  const rl = sharedRl ?? readline.createInterface({
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

const PROVIDER_MODEL_DEFAULTS: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  deepseek: "deepseek-chat",
  ollama: "llama3",
};

export async function createAgentLoop(
  configPath: string,
  verbose: boolean = false,
  injectProvider?: LLMProvider,
  sharedRl?: readline.Interface,
  callbacks?: {
    onToolStart?: (toolName: string, params: Record<string, unknown>) => void;
    onToolResult?: (toolName: string, success: boolean, output: string) => void;
    onApprovalRequired?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
  },
): Promise<AgentLoop> {
  const config = loadConfig(configPath);

  let provider: LLMProvider;
  if (injectProvider) {
    provider = injectProvider;
  } else {
    const providerName = config.llm.provider;
    const needsKey = !PROVIDERS_WITHOUT_KEY.has(providerName);

    if (needsKey) {
      const apiKey = await getApiKey(providerName);
      if (!apiKey) {
        throw new Error(
          `No API key found for provider "${providerName}". Run "ccg setup" to configure.`,
        );
      }

      const model = config.llm.model || PROVIDER_MODEL_DEFAULTS[providerName] || "gpt-4o";
      const llmConfig: LLMConfig = (() => {
        switch (providerName) {
          case "openai":
            return { provider: providerName, apiKey, model };
          case "anthropic":
            return { provider: providerName, apiKey, model };
          case "deepseek":
            return { provider: providerName, apiKey, model };
          default:
            throw new Error(`Unsupported provider: ${providerName}`);
        }
      })();
      provider = createProvider(llmConfig);
    } else {
      const model = config.llm.model || PROVIDER_MODEL_DEFAULTS[providerName] || "llama3";
      provider = createProvider({ provider: providerName as "ollama", baseURL: "http://localhost:11434", model });
    }
  }

  const rulesFile = path.resolve(path.dirname(configPath), config.guardrails.rulesFile);
  const rules = loadGuardrailRules(rulesFile);

  const tools = createTools(config);

  let effectiveTools = tools;
  if (callbacks) {
    effectiveTools = tools.map((tool) => ({
      ...tool,
      execute: async (params: Record<string, unknown>) => {
        callbacks.onToolStart?.(tool.name, params);
        const result = await tool.execute(params);
        callbacks.onToolResult?.(tool.name, result.success, result.output);
        return result;
      },
    }));
  }

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
    onApprovalRequired: callbacks?.onApprovalRequired ?? createHITLHandler(verbose, sharedRl),
  });

  const platform = os.platform();
  const platformHint = platform === "win32"
    ? `You are running on Windows. Use Windows commands (dir, findstr, type, del, etc.), not Unix commands (ls, grep, cat, rm). Use 'cmd /c' prefix for shell commands when needed.`
    : `You are running on ${platform}. Use standard Unix/Linux commands.`;

  const toolNames = effectiveTools.map((t) => t.name).join(", ");
  const toolHint = `Available tools: ${toolNames}. Use only these tools.`;

  return new AgentLoop({
    provider,
    guard,
    tools: effectiveTools,
    maxRounds: config.llm.maxRounds,
    maxConsecutiveFailures: 3,
    systemPrompt: `You are a coding agent. Complete the user's task using the available tools.\n${platformHint}\n${toolHint}`,
    projectContext: "",
  });
}

export async function runTask(
  task: string,
  configPath: string,
  verbose: boolean = false,
  injectProvider?: LLMProvider,
  sharedRl?: readline.Interface,
  callbacks?: {
    onToolStart?: (toolName: string, params: Record<string, unknown>) => void;
    onToolResult?: (toolName: string, success: boolean, output: string) => void;
    onApprovalRequired?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
  },
): Promise<string> {
  const loop = await createAgentLoop(configPath, verbose, injectProvider, sharedRl, callbacks);
  const config = loadConfig(configPath);

  if (verbose) {
    console.log(`[CCG] Running task: ${task}`);
    console.log(`[CCG] Provider: ${config.llm.provider}, Model: ${config.llm.model}`);
    console.log(`[CCG] Max rounds: ${config.llm.maxRounds}`);
    console.log(`[CCG] Tools: ${config.tools.enabled.join(", ")}`);
    console.log(`[CCG] HITL: ${config.guardrails.hitlEnabled ? "enabled" : "disabled"}`);
  }

  const result = await loop.run(task);

  if (verbose) {
    const state = loop.getState();
    console.log(`\n[CCG] Completed in ${state.round} rounds`);
    console.log(`[CCG] Result: ${result}`);
  }

  return result;
}