import { describe, it, expect, afterEach, afterAll } from "vitest";
import { loadProjectContext } from "../../src/memory/project-context.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("loadProjectContext", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccg-test-"));
  const rulesPath = path.join(tmpDir, "rules.txt");

  afterEach(() => {
    try {
      if (fs.existsSync(rulesPath)) {
        fs.unlinkSync(rulesPath);
      }
    } catch {
      // ignore cleanup errors
    }
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    } catch {
      // ignore cleanup errors
    }
  });

  it("returns file contents when rules file exists", () => {
    const content = "PROJECT = CCGHarness\nVERSION = 1.0.0";
    fs.writeFileSync(rulesPath, content, "utf-8");

    const result = loadProjectContext(rulesPath);

    expect(result).toBe(content);
  });

  it("returns empty string when rules file does not exist", () => {
    const result = loadProjectContext(path.join(tmpDir, "nonexistent.txt"));

    expect(result).toBe("");
  });

  it("reads multi-line content correctly", () => {
    const content = "line 1\nline 2\nline 3";
    fs.writeFileSync(rulesPath, content, "utf-8");

    const result = loadProjectContext(rulesPath);

    expect(result).toBe(content);
  });
});