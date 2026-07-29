import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createShellTool } from "../../src/tools/shell.js";

describe("createShellTool", () => {
  it("returns a ToolDefinition with correct name, description, and required params", () => {
    const tool = createShellTool();

    expect(tool.name).toBe("shell");
    expect(tool.description).toBeTruthy();
    expect(tool.parameters.type).toBe("object");
    expect(tool.parameters.required).toContain("command");
    expect(tool.parameters.properties).toHaveProperty("command");
    expect(tool.parameters.properties).toHaveProperty("cwd");
    expect(typeof tool.execute).toBe("function");
  });

  it("executes a successful command (echo hello)", async () => {
    const tool = createShellTool();
    const result = await tool.execute({ command: "echo hello" });

    expect(result.success).toBe(true);
    expect(result.output).toContain("hello");
    expect(result.error).toBeFalsy();
    expect(result.metadata).toBeDefined();
    expect(result.metadata).toHaveProperty("exitCode");
    expect(result.metadata).toHaveProperty("stderr");
  });

  it("returns metadata with exitCode 0 and empty stderr on success", async () => {
    const tool = createShellTool();
    const result = await tool.execute({ command: "echo hello" });

    expect(result.success).toBe(true);
    expect(result.metadata!.exitCode).toBe(0);
    expect(result.metadata!.stderr).toBe("");
  });

  it("returns failure for nonexistent command", async () => {
    const tool = createShellTool();
    const result = await tool.execute({ command: "nonexistent_command_xyz" });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.exitCode).not.toBe(0);
    expect(result.metadata!.stderr).toBeTruthy();
  });

  it("executes command in specified cwd", async () => {
    const tmpDir = fs.mkdtempSync("shell-test-");
    try {
      const subDir = path.join(tmpDir, "subdir");
      fs.mkdirSync(subDir);
      const filePath = path.join(subDir, "test.txt");
      fs.writeFileSync(filePath, "hello from cwd", "utf-8");

      const tool = createShellTool();

      // On Windows, use cmd /c to run type command
      const result = await tool.execute({
        command: 'cmd /c "type test.txt"',
        cwd: subDir,
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain("hello from cwd");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("captures stdout and stderr separately in metadata", async () => {
    const tool = createShellTool();

    // Command that fails with non-zero exit, producing both stdout and stderr
    const result = await tool.execute({
      command: 'cmd /c "echo stdout_text & echo stderr_text 1>&2 & exit 1"',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain("stdout_text");
    expect(result.metadata!.stderr).toContain("stderr_text");
  });
});