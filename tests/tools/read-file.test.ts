import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createReadFileTool } from "../../src/tools/read-file.js";

describe("createReadFileTool", () => {
  it("returns a ToolDefinition with correct name, description, and required params", () => {
    const tool = createReadFileTool();

    expect(tool.name).toBe("read_file");
    expect(tool.description).toBeTruthy();
    expect(tool.parameters.type).toBe("object");
    expect(tool.parameters.required).toContain("path");
    expect(tool.parameters.properties).toHaveProperty("path");
    expect(tool.parameters.properties).toHaveProperty("startLine");
    expect(tool.parameters.properties).toHaveProperty("endLine");
    expect(typeof tool.execute).toBe("function");
  });

  it("reads file content", async () => {
    const tmpDir = fs.mkdtempSync("read-file-test-");
    try {
      const filePath = path.join(tmpDir, "test.txt");
      const content = "line1\nline2\nline3\n";
      fs.writeFileSync(filePath, content, "utf-8");

      const tool = createReadFileTool();
      const result = await tool.execute({ path: filePath });

      expect(result.success).toBe(true);
      expect(result.output).toBe(content);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns error for non-existent file", async () => {
    const tool = createReadFileTool();
    const result = await tool.execute({ path: "/nonexistent/file.txt" });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.output).toBe("");
  });

  it("slices line range with startLine only", async () => {
    const tmpDir = fs.mkdtempSync("read-file-test-");
    try {
      const filePath = path.join(tmpDir, "test.txt");
      const lines = ["line1", "line2", "line3", "line4", "line5"];
      fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");

      const tool = createReadFileTool();
      const result = await tool.execute({ path: filePath, startLine: 2 });

      expect(result.success).toBe(true);
      expect(result.output).toBe("line2\nline3\nline4\nline5\n");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("slices line range with startLine and endLine", async () => {
    const tmpDir = fs.mkdtempSync("read-file-test-");
    try {
      const filePath = path.join(tmpDir, "test.txt");
      const lines = ["line1", "line2", "line3", "line4", "line5"];
      fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");

      const tool = createReadFileTool();
      const result = await tool.execute({ path: filePath, startLine: 2, endLine: 4 });

      expect(result.success).toBe(true);
      expect(result.output).toBe("line2\nline3\nline4\n");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("clamps endLine to file length if out of range", async () => {
    const tmpDir = fs.mkdtempSync("read-file-test-");
    try {
      const filePath = path.join(tmpDir, "test.txt");
      const lines = ["line1", "line2", "line3"];
      fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");

      const tool = createReadFileTool();
      const result = await tool.execute({ path: filePath, startLine: 2, endLine: 10 });

      expect(result.success).toBe(true);
      expect(result.output).toBe("line2\nline3\n");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns full content if startLine is 1", async () => {
    const tmpDir = fs.mkdtempSync("read-file-test-");
    try {
      const filePath = path.join(tmpDir, "test.txt");
      const content = "line1\nline2\n";
      fs.writeFileSync(filePath, content, "utf-8");

      const tool = createReadFileTool();
      const result = await tool.execute({ path: filePath, startLine: 1 });

      expect(result.success).toBe(true);
      expect(result.output).toBe(content);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});