import { describe, it, expect } from "vitest";
import { validateLintOutput } from "../../src/feedback/lint-validator.js";

describe("validateLintOutput", () => {
  it("returns passed=true with no issues for clean lint output", () => {
    const output = "";

    const result = validateLintOutput(output);

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("parses error lines and returns passed=false", () => {
    const output = `
src/tools/write-file.ts:10:5: error: Missing return type on function
src/tools/shell.ts:20:12: error: 'cmd' is not defined
`;

    const result = validateLintOutput(output);

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toEqual({
      severity: "error",
      file: "src/tools/write-file.ts",
      line: 10,
      message: "Missing return type on function",
    });
    expect(result.issues[1]).toEqual({
      severity: "error",
      file: "src/tools/shell.ts",
      line: 20,
      message: "'cmd' is not defined",
    });
  });

  it("parses warning lines and returns passed=true with warnings", () => {
    const output = `
src/tools/read-file.ts:5:1: warning: Unused variable 'x'
src/tools/shell.ts:8:3: warning: Use const instead of let
`;

    const result = validateLintOutput(output);

    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].severity).toBe("warning");
    expect(result.issues[0].file).toBe("src/tools/read-file.ts");
    expect(result.issues[0].line).toBe(5);
    expect(result.issues[0].message).toBe("Unused variable 'x'");
    expect(result.issues[1].severity).toBe("warning");
    expect(result.issues[1].file).toBe("src/tools/shell.ts");
    expect(result.issues[1].line).toBe(8);
    expect(result.issues[1].message).toBe("Use const instead of let");
  });

  it("fails when there are any errors even with warnings present", () => {
    const output = `
src/tools/write-file.ts:10:5: error: Missing return type
src/tools/read-file.ts:5:1: warning: Unused variable
`;

    const result = validateLintOutput(output);

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it("handles output with no parsable lint lines", () => {
    const output = "No linting issues found. Everything is clean!\n";

    const result = validateLintOutput(output);

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });
});