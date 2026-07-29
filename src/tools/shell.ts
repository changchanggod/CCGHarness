import { execSync } from "node:child_process";
import type { ToolDefinition, ToolResult } from "../core/types.js";

export function createShellTool(): ToolDefinition {
  return {
    name: "shell",
    description: "Executes a shell command and returns its output",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        cwd: { type: "string", description: "Optional working directory" },
      },
      required: ["command"],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const command = params.command as string;
      const cwd = typeof params.cwd === "string" ? params.cwd : undefined;

      try {
        const stdout = execSync(command, {
          cwd,
          timeout: 60_000,
          stdio: "pipe",
          encoding: "utf-8",
        });

        return {
          success: true,
          output: stdout,
          metadata: {
            exitCode: 0,
            stderr: "",
          },
        };
      } catch (e: unknown) {
        const err = e as NodeJS.ErrnoException & {
          stdout?: Buffer | string;
          stderr?: Buffer | string;
          status?: number;
        };
        return {
          success: false,
          output: typeof err.stdout === "string" ? err.stdout : (err.stdout?.toString() ?? ""),
          error: err.message,
          metadata: {
            exitCode: err.status ?? 1,
            stderr: typeof err.stderr === "string" ? err.stderr : (err.stderr?.toString() ?? ""),
          },
        };
      }
    },
  };
}