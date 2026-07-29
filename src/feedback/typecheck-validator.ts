import { Issue, ValidationResult } from "../core/types.js";

const TS_ERROR_REGEX = /^.+?\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)/;

export function validateTypeCheckOutput(output: string): ValidationResult {
  const issues: Issue[] = [];

  for (const line of output.split("\n")) {
    const match = line.match(TS_ERROR_REGEX);
    if (match) {
      const [, lineStr, , code, message] = match;
      const fileMatch = line.match(/^(.+?)\(/);
      const file = fileMatch ? fileMatch[1].trim() : "";

      issues.push({
        severity: "error",
        file,
        line: parseInt(lineStr, 10),
        message: `${code}: ${message.trim()}`,
      });
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}