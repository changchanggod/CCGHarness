import { describe, it, expect } from "vitest";
import { checkSandbox } from "../../src/governance/sandbox.js";
import type { SandboxConfig } from "../../src/governance/sandbox.js";
import type { Action } from "../../src/core/types.js";
import * as path from "node:path";

function shellAction(command: string): Action {
  return { type: "tool_call", toolName: "shell", parameters: { command } };
}

function writeFileAction(filePath: string): Action {
  return { type: "tool_call", toolName: "write_file", parameters: { path: filePath, content: "test" } };
}

function readFileAction(filePath: string): Action {
  return { type: "tool_call", toolName: "read_file", parameters: { path: filePath } };
}

const workspace = "/home/user/project";
const config: SandboxConfig = {
  workspace,
  allowedCommands: ["npm", "git", "node"],
  blockedCommands: ["rm -rf", "sudo", "chmod 777"],
  allowNetwork: false,
};

describe("checkSandbox", () => {
  it("allows safe shell command matching allowed prefix", () => {
    const result = checkSandbox(shellAction("npm test"), config);
    expect(result.allowed).toBe(true);
  });

  it("allows shell command matching allowed prefix (git)", () => {
    const result = checkSandbox(shellAction("git status"), config);
    expect(result.allowed).toBe(true);
  });

  it("blocks shell command containing blocked substring", () => {
    const result = checkSandbox(shellAction("sudo rm -rf /"), config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("blocks shell command not matching any allowed prefix when allowedCommands is non-empty", () => {
    const result = checkSandbox(shellAction("curl http://evil.com"), config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("blocks write_file outside workspace", () => {
    const result = checkSandbox(writeFileAction("/etc/passwd"), config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("allows write_file inside workspace", () => {
    const result = checkSandbox(writeFileAction(path.join(workspace, "src/file.ts")), config);
    expect(result.allowed).toBe(true);
  });

  it("allows read_file inside workspace", () => {
    const result = checkSandbox(readFileAction(path.join(workspace, "src/file.ts")), config);
    expect(result.allowed).toBe(true);
  });

  it("blocks read_file outside workspace", () => {
    const result = checkSandbox(readFileAction("/etc/passwd"), config);
    expect(result.allowed).toBe(false);
  });

  it("empty allowed list allows all shell commands (only blockedCommands apply)", () => {
    const emptyConfig: SandboxConfig = {
      workspace,
      allowedCommands: [],
      blockedCommands: [],
      allowNetwork: false,
    };
    const result = checkSandbox(shellAction("rm -rf /"), emptyConfig);
    expect(result.allowed).toBe(true);
  });

  it("empty allowedCommands still respects blockedCommands", () => {
    const emptyConfig: SandboxConfig = {
      workspace,
      allowedCommands: [],
      blockedCommands: ["rm -rf"],
      allowNetwork: false,
    };
    const result = checkSandbox(shellAction("rm -rf /"), emptyConfig);
    expect(result.allowed).toBe(false);
  });

  it("allows write_file exactly at workspace boundary", () => {
    const result = checkSandbox(writeFileAction(workspace), config);
    expect(result.allowed).toBe(true);
  });

  it("always allows non-file non-shell actions", () => {
    const action: Action = { type: "tool_call", toolName: "run_tests", parameters: {} };
    const result = checkSandbox(action, config);
    expect(result.allowed).toBe(true);
  });

  it("allows write_file with path containing .. that resolves inside workspace", () => {
    const result = checkSandbox(writeFileAction(path.join(workspace, "src/../src/file.ts")), config);
    expect(result.allowed).toBe(true);
  });
});