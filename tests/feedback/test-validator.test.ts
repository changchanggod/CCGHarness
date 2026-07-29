import { describe, it, expect } from "vitest";
import { validateTestOutput } from "../../src/feedback/test-validator.js";

describe("validateTestOutput", () => {
  it("returns passed=true with no issues for passing test output", () => {
    const output = `
PASS  tests/tools/read-file.test.ts
PASS  tests/tools/write-file.test.ts
PASS  tests/tools/shell.test.ts

Tests:  3 passed, 3 total
`;

    const result = validateTestOutput(output);

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("returns passed=true with no issues for empty output", () => {
    const result = validateTestOutput("");

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("detects FAIL lines and returns passed=false with issues", () => {
    const output = `
PASS  tests/tools/read-file.test.ts
FAIL  tests/tools/write-file.test.ts
FAIL  tests/tools/shell.test.ts

Tests:  1 passed, 2 failed, 3 total
`;

    const result = validateTestOutput(output);

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].severity).toBe("error");
    expect(result.issues[0].file).toBe("tests/tools/write-file.test.ts");
    expect(result.issues[0].message).toBe("Test failed");
    expect(result.issues[1].severity).toBe("error");
    expect(result.issues[1].file).toBe("tests/tools/shell.test.ts");
  });

  it("detects ● blocks as test failures", () => {
    const output = `
 ● tests/tools/write-file.test.ts › writeFile › should write content to file

   Expected: "hello"
   Received: "goodbye"

 ● tests/tools/shell.test.ts › shell › should execute command

   Command not found

Tests:  0 passed, 2 failed, 2 total
`;

    const result = validateTestOutput(output);

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].file).toBe("tests/tools/write-file.test.ts");
    expect(result.issues[0].message).toContain("Expected: \"hello\"");
    expect(result.issues[1].file).toBe("tests/tools/shell.test.ts");
    expect(result.issues[1].message).toContain("Command not found");
  });

  it("handles both FAIL lines and ● blocks in the same output", () => {
    const output = `
FAIL  tests/tools/read-file.test.ts
 ● tests/tools/write-file.test.ts › writeFile › should write content

   Expected: "hello"
   Received: "goodbye"

Tests:  0 passed, 2 failed, 2 total
`;

    const result = validateTestOutput(output);

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].file).toBe("tests/tools/read-file.test.ts");
    expect(result.issues[1].file).toBe("tests/tools/write-file.test.ts");
  });
});