import { describe, it, expect } from "vitest";
import { validateTypeCheckOutput } from "../../src/feedback/typecheck-validator.js";

describe("validateTypeCheckOutput", () => {
  it("returns passed=true with no issues for clean typecheck output", () => {
    const output = "";

    const result = validateTypeCheckOutput(output);

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("parses TS error lines and returns passed=false", () => {
    const output = `
src/tools/write-file.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/tools/shell.ts(20,12): error TS2304: Cannot find name 'cmd'.
`;

    const result = validateTypeCheckOutput(output);

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toEqual({
      severity: "error",
      file: "src/tools/write-file.ts",
      line: 10,
      message: "TS2322: Type 'string' is not assignable to type 'number'.",
    });
    expect(result.issues[1]).toEqual({
      severity: "error",
      file: "src/tools/shell.ts",
      line: 20,
      message: "TS2304: Cannot find name 'cmd'.",
    });
  });

  it("handles output with no parsable TS error lines", () => {
    const output = "src/index.ts: compiled successfully\n";

    const result = validateTypeCheckOutput(output);

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("handles multiple errors in the same file", () => {
    const output = `
src/tools/shell.ts(5,1): error TS2304: Cannot find name 'foo'.
src/tools/shell.ts(12,8): error TS7006: Parameter 'x' implicitly has an 'any' type.
src/tools/shell.ts(20,3): error TS2554: Expected 2 arguments, but got 1.
`;

    const result = validateTypeCheckOutput(output);

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(3);
    expect(result.issues[0].file).toBe("src/tools/shell.ts");
    expect(result.issues[0].line).toBe(5);
    expect(result.issues[0].message).toContain("TS2304");
    expect(result.issues[1].file).toBe("src/tools/shell.ts");
    expect(result.issues[1].line).toBe(12);
    expect(result.issues[1].message).toContain("TS7006");
    expect(result.issues[2].file).toBe("src/tools/shell.ts");
    expect(result.issues[2].line).toBe(20);
    expect(result.issues[2].message).toContain("TS2554");
  });
});