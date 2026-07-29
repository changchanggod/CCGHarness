import { describe, it, expect } from "vitest";
import { loadConfig, AppConfig } from "../../src/config/loader.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function writeTempYaml(content: string): string {
  const filePath = path.join(os.tmpdir(), `ccg-test-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("loadConfig", () => {
  it("throws when file does not exist", () => {
    expect(() => loadConfig("/nonexistent/path/config.yaml")).toThrow();
  });

  it("returns defaults for an empty YAML file", () => {
    const filePath = writeTempYaml("");
    try {
      const config = loadConfig(filePath);
      expect(config.llm.provider).toBe("openai");
      expect(config.llm.model).toBe("gpt-4o");
      expect(config.llm.maxRounds).toBe(20);
      expect(config.llm.temperature).toBe(0.1);
      expect(config.guardrails.rulesFile).toBe("guardrails.yaml");
      expect(config.guardrails.hitlEnabled).toBe(true);
      expect(config.guardrails.hitlTimeout).toBe(120);
      expect(config.guardrails.sandbox.workspace).toBe(".");
      expect(config.guardrails.sandbox.allowedCommands).toEqual([]);
      expect(config.guardrails.sandbox.blockedCommands).toEqual([]);
      expect(config.guardrails.sandbox.allowNetwork).toBe(false);
      expect(config.tools.enabled).toEqual(["read_file", "write_file", "shell", "run_tests", "run_lint"]);
      expect(config.feedback.autoLint).toBe(true);
      expect(config.feedback.autoTest).toBe(true);
      expect(config.feedback.testCommand).toBe("npm test");
      expect(config.feedback.lintCommand).toBe("npm run lint");
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it("maps snake_case keys to camelCase", () => {
    const yaml = `
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  max_rounds: 10
  temperature: 0.5
guardrails:
  rules_file: my-rules.yaml
  hitl_enabled: false
  hitl_timeout: 60
  sandbox:
    workspace: /tmp/sandbox
    allowed_commands: ["ls", "cat"]
    blocked_commands: ["rm"]
    allow_network: true
tools:
  enabled: ["shell", "run_tests"]
feedback:
  auto_lint: false
  auto_test: false
  test_command: "make test"
  lint_command: "make lint"
`;
    const filePath = writeTempYaml(yaml);
    try {
      const config = loadConfig(filePath);
      expect(config.llm.provider).toBe("anthropic");
      expect(config.llm.model).toBe("claude-sonnet-4-20250514");
      expect(config.llm.maxRounds).toBe(10);
      expect(config.llm.temperature).toBe(0.5);
      expect(config.guardrails.rulesFile).toBe("my-rules.yaml");
      expect(config.guardrails.hitlEnabled).toBe(false);
      expect(config.guardrails.hitlTimeout).toBe(60);
      expect(config.guardrails.sandbox.workspace).toBe("/tmp/sandbox");
      expect(config.guardrails.sandbox.allowedCommands).toEqual(["ls", "cat"]);
      expect(config.guardrails.sandbox.blockedCommands).toEqual(["rm"]);
      expect(config.guardrails.sandbox.allowNetwork).toBe(true);
      expect(config.tools.enabled).toEqual(["shell", "run_tests"]);
      expect(config.feedback.autoLint).toBe(false);
      expect(config.feedback.autoTest).toBe(false);
      expect(config.feedback.testCommand).toBe("make test");
      expect(config.feedback.lintCommand).toBe("make lint");
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it("merges partial config with defaults", () => {
    const yaml = `
llm:
  max_rounds: 5
tools:
  enabled: ["shell"]
`;
    const filePath = writeTempYaml(yaml);
    try {
      const config = loadConfig(filePath);
      expect(config.llm.maxRounds).toBe(5);
      expect(config.llm.provider).toBe("openai");
      expect(config.llm.model).toBe("gpt-4o");
      expect(config.tools.enabled).toEqual(["shell"]);
      expect(config.feedback.autoLint).toBe(true);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it("exposes the AppConfig type", () => {
    const config: AppConfig = {
      llm: { provider: "openai", model: "gpt-4o", maxRounds: 20, temperature: 0.1 },
      guardrails: {
        rulesFile: "guardrails.yaml",
        hitlEnabled: true,
        hitlTimeout: 120,
        sandbox: { workspace: ".", allowedCommands: [], blockedCommands: [], allowNetwork: false },
      },
      tools: { enabled: ["read_file", "write_file", "shell", "run_tests", "run_lint"] },
      feedback: { autoLint: true, autoTest: true, testCommand: "npm test", lintCommand: "npm run lint" },
    };
    expect(config.llm.provider).toBe("openai");
  });
});