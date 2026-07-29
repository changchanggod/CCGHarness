import { Issue, ValidationResult } from "../core/types.js";

const ESLINT_LINE_REGEX = /^(.+?):(\d+):(\d+):\s+(error|warning):\s+(.+)/;

export function validateLintOutput(output: string): ValidationResult {
  const issues: Issue[] = [];

  for (const line of output.split("\n")) {
    const match = line.match(ESLINT_LINE_REGEX);
    if (match) {
      const [, file, lineStr, , severity, message] = match;
      issues.push({
        severity: severity as "error" | "warning",
        file,
        line: parseInt(lineStr, 10),
        message: message.trim(),
      });
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    passed: !hasErrors,
    issues,
  };
}