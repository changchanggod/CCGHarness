import * as fs from "node:fs";
import type { ToolDefinition, ToolResult } from "../core/types.js";

export function createReadFileTool(): ToolDefinition {
  return {
    name: "read_file",
    description: "Reads content from a file with optional line range slicing",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        startLine: { type: "number", description: "Optional start line (1-indexed)" },
        endLine: { type: "number", description: "Optional end line (1-indexed, inclusive)" },
      },
      required: ["path"],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const filePath = params.path as string;

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const hasTrailingNewline = content.endsWith("\n");
        const lines = content.split("\n");

        const startLine = typeof params.startLine === "number" ? params.startLine : 1;
        const defaultEndLine = hasTrailingNewline ? lines.length - 1 : lines.length;
        const endLine = typeof params.endLine === "number" ? params.endLine : defaultEndLine;

        const clampedEnd = Math.min(endLine, defaultEndLine);
        const startIdx = Math.max(startLine - 1, 0);
        const sliced = lines.slice(startIdx, clampedEnd);

        let output = sliced.join("\n");
        if (hasTrailingNewline && sliced.length > 0) {
          output += "\n";
        }

        return {
          success: true,
          output,
        };
      } catch (e: unknown) {
        const err = e as NodeJS.ErrnoException;
        return {
          success: false,
          output: "",
          error: err.message,
        };
      }
    },
  };
}