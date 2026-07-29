import { describe, it, expect } from "vitest";
import { createRunLintTool } from "../../src/tools/run-lint.js";

describe("createRunLintTool", () => {
  it("returns a ToolDefinition with correct name, description, and required params", () => {
    const tool = createRunLintTool();

    expect(tool.name).toBe("run_lint");
    expect(tool.description).toBeTruthy();
    expect(tool.parameters.type).toBe("object");
    expect(tool.parameters.properties).toHaveProperty("command");
    expect(tool.parameters.properties).toHaveProperty("cwd");
    expect(typeof tool.execute).toBe("function");
  });

  it("executes a successful command with default command", async () => {
    const tool = createRunLintTool("echo default_lint");

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.output).toContain("default_lint");
    expect(result.error).toBeFalsy();
    expect(result.metadata).toBeDefined();
    expect(result.metadata).toHaveProperty("exitCode");
    expect(result.metadata).toHaveProperty("stderr");
  });

  it("overrides default command with params.command", async () => {
    const tool = createRunLintTool("echo default_lint");

    const result = await tool.execute({ command: "echo overridden_lint" });

    expect(result.success).toBe(true);
    expect(result.output).toContain("overridden_lint");
    expect(result.output).not.toContain("default_lint");
  });

  it("returns metadata with exitCode 0 and empty stderr on success", async () => {
    const tool = createRunLintTool("echo success");

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.metadata!.exitCode).toBe(0);
    expect(result.metadata!.stderr).toBe("");
  });

  it("returns failure for nonexistent command", async () => {
    const tool = createRunLintTool();

    const result = await tool.execute({ command: "nonexistent_command_xyz" });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.exitCode).not.toBe(0);
    expect(result.metadata!.stderr).toBeTruthy();
  });

  it("works without default command when params.command is provided", async () => {
    const tool = createRunLintTool();

    const result = await tool.execute({ command: "echo no_default" });

    expect(result.success).toBe(true);
    expect(result.output).toContain("no_default");
  });

  it("captures stderr in metadata on failure", async () => {
    const tool = createRunLintTool();

    const result = await tool.execute({
      command: 'cmd /c "echo stdout_text & echo stderr_text 1>&2 & exit 1"',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("stdout_text");
    expect(result.metadata!.stderr).toContain("stderr_text");
  });
});