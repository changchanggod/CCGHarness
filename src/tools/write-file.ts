import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolDefinition, ToolResult } from "../core/types.js";

export function createWriteFileTool(): ToolDefinition {
  return {
    name: "write_file",
    description: "Writes content to a file, creating parent directories if needed",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const filePath = params.path as string;
      const content = params.content as string;

      if (!filePath) {
        return {
          success: false,
          output: "",
          error: "Missing required parameter: path",
        };
      }

      try {
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });

        const buffer = Buffer.from(content, "utf-8");
        fs.writeFileSync(filePath, buffer);

        return {
          success: true,
          output: `Wrote ${buffer.length} bytes to ${filePath}`,
          metadata: {
            filePath,
            sizeBytes: buffer.length,
          },
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