import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createWriteFileTool } from "../../src/tools/write-file.js";

describe("createWriteFileTool", () => {
  it("returns a ToolDefinition with correct name, description, and required params", () => {
    const tool = createWriteFileTool();

    expect(tool.name).toBe("write_file");
    expect(tool.description).toBeTruthy();
    expect(tool.parameters.type).toBe("object");
    expect(tool.parameters.required).toContain("path");
    expect(tool.parameters.required).toContain("content");
    expect(tool.parameters.properties).toHaveProperty("path");
    expect(tool.parameters.properties).toHaveProperty("content");
    expect(typeof tool.execute).toBe("function");
  });

  it("writes content to a file", async () => {
    const tmpDir = fs.mkdtempSync("write-file-test-");
    try {
      const filePath = path.join(tmpDir, "output.txt");
      const content = "hello world\n";

      const tool = createWriteFileTool();
      const result = await tool.execute({ path: filePath, content });

      expect(result.success).toBe(true);
      expect(result.output).toContain(filePath);

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written).toBe(content);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates parent directories if they do not exist", async () => {
    const tmpDir = fs.mkdtempSync("write-file-test-");
    try {
      const nestedDir = path.join(tmpDir, "a", "b", "c");
      const filePath = path.join(nestedDir, "output.txt");
      const content = "nested content";

      expect(fs.existsSync(nestedDir)).toBe(false);

      const tool = createWriteFileTool();
      const result = await tool.execute({ path: filePath, content });

      expect(result.success).toBe(true);
      expect(fs.existsSync(nestedDir)).toBe(true);

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written).toBe(content);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns metadata with file path and size", async () => {
    const tmpDir = fs.mkdtempSync("write-file-test-");
    try {
      const filePath = path.join(tmpDir, "output.txt");
      const content = "hello world\n";

      const tool = createWriteFileTool();
      const result = await tool.execute({ path: filePath, content });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty("filePath", filePath);
      expect(result.metadata).toHaveProperty("sizeBytes", Buffer.byteLength(content, "utf-8"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns error when path is missing", async () => {
    const tool = createWriteFileTool();
    const result = await tool.execute({ content: "some content" });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.output).toBe("");
  });

  it("overwrites existing file", async () => {
    const tmpDir = fs.mkdtempSync("write-file-test-");
    try {
      const filePath = path.join(tmpDir, "output.txt");
      fs.writeFileSync(filePath, "old content", "utf-8");

      const newContent = "new content\n";
      const tool = createWriteFileTool();
      const result = await tool.execute({ path: filePath, content: newContent });

      expect(result.success).toBe(true);

      const written = fs.readFileSync(filePath, "utf-8");
      expect(written).toBe(newContent);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});