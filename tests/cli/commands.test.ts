import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { MockLLMProvider } from "../../src/providers/mock.js";
import type { LLMResponse } from "../../src/core/types.js";

const testDir = path.join(os.tmpdir(), `ccg-commands-test-${Date.now()}`);

function setEnv(key: string, value: string) {
  process.env[key] = value;
}

function deleteEnv(key: string) {
  delete process.env[key];
}

describe("runTask", () => {
  let runTask: typeof import("../../src/cli/commands.js").runTask;

  beforeEach(async () => {
    fs.mkdirSync(testDir, { recursive: true });
    const credsDir = path.join(testDir, ".ccg");
    setEnv("CCG_CREDS_DIR", credsDir);
    setEnv("CCG_CREDS_FILE", path.join(credsDir, "credentials.json"));

    const { storeApiKey } = await import("../../src/cli/setup.js");
    await storeApiKey("openai", "sk-test-mock-key");

    const configPath = path.join(testDir, "ccg.yaml");
    const configContent = `
llm:
  provider: openai
  model: gpt-4o
  max_rounds: 3
  temperature: 0.1
guardrails:
  rules_file: ${path.join(testDir, "guardrails.yaml").replace(/\\/g, "\\\\")}
  hitl_enabled: false
  hitl_timeout: 120
  sandbox:
    workspace: "${testDir.replace(/\\/g, "\\\\")}"
    allowed_commands: []
    blocked_commands: []
    allow_network: false
tools:
  enabled:
    - read_file
    - write_file
    - shell
    - run_tests
    - run_lint
feedback:
  auto_lint: false
  auto_test: false
  test_command: "npm test"
  lint_command: "npm run lint"
`;
    fs.writeFileSync(configPath, configContent);

    const rulesPath = path.join(testDir, "guardrails.yaml");
    const rulesContent = `
rules:
  - pattern: "rm\\\\s+(-[rRf]+\\\\s+)+[/~]"
    score: 100
    description: "Recursive force delete on root/home"
  - pattern: "git\\\\s+push\\\\s+.*--force"
    score: 60
    description: "Force push to remote"
`;
    fs.writeFileSync(rulesPath, rulesContent);

    const mod = await import("../../src/cli/commands.js");
    runTask = mod.runTask;
  });

  afterEach(() => {
    deleteEnv("CCG_CREDS_DIR");
    deleteEnv("CCG_CREDS_FILE");
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("completes a task with a mock provider", async () => {
    const mockResponses: LLMResponse[] = [
      {
        actions: [{ type: "stop", summary: "Mock task completed" }],
        rawUsage: { prompt: 10, completion: 5 },
      },
    ];
    const mockProvider = new MockLLMProvider(mockResponses);

    const result = await runTask(
      "Write a hello world script",
      path.join(testDir, "ccg.yaml"),
      false,
      mockProvider,
    );
    expect(result).toBe("Mock task completed");
  });

  it("handles a tool call sequence with mock provider", async () => {
    const mockResponses: LLMResponse[] = [
      {
        actions: [
          {
            type: "tool_call",
            toolName: "read_file",
            parameters: { path: path.join(testDir, "test.txt") },
          },
        ],
        rawUsage: { prompt: 10, completion: 5 },
      },
      {
        actions: [{ type: "stop", summary: "Task done after reading" }],
        rawUsage: { prompt: 10, completion: 5 },
      },
    ];

    // Create a file for read_file to read
    fs.writeFileSync(path.join(testDir, "test.txt"), "hello world");

    const mockProvider = new MockLLMProvider(mockResponses);

    const result = await runTask(
      "Read a file and report",
      path.join(testDir, "ccg.yaml"),
      false,
      mockProvider,
    );
    expect(result).toBe("Task done after reading");
  });
});