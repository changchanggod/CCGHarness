import type { Action, ClassificationResult, CommandCategory } from "../core/types.js";

const CATEGORY_MAP: Record<string, CommandCategory> = {
  read_file: "file_read",
  write_file: "file_write",
  shell: "shell",
  run_tests: "build_test",
  run_lint: "build_test",
};

export function classifyCommand(action: Action): ClassificationResult {
  const toolName = action.toolName;
  const category = toolName ? (CATEGORY_MAP[toolName] ?? "unknown") : "unknown";

  return {
    category,
    riskScore: 0,
    riskLevel: "safe",
    matchedRules: [],
  };
}