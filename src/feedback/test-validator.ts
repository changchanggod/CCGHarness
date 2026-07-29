import { Issue, ValidationResult } from "../core/types.js";

export function validateTestOutput(output: string): ValidationResult {
  const issues: Issue[] = [];

  const failLineRegex = /^FAIL\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = failLineRegex.exec(output)) !== null) {
    issues.push({
      severity: "error",
      file: match[1].trim(),
      message: "Test failed",
    });
  }

  const bulletBlockRegex = /●\s+(.+?)\n([\s\S]*?)(?=\n\s*●|\nTests:|\n\n\S|$)/g;
  while ((match = bulletBlockRegex.exec(output)) !== null) {
    const fileWithTest = match[1].trim();
    const detail = match[2].trim();

    const fileMatch = fileWithTest.match(/^(.+?)\s+›/);
    const file = fileMatch ? fileMatch[1].trim() : fileWithTest;

    const issuesFromFail = issues.filter((i) => i.file === file);
    if (issuesFromFail.length === 0) {
      const messageLines = detail
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      issues.push({
        severity: "error",
        file,
        message: messageLines.join("\n"),
      });
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}