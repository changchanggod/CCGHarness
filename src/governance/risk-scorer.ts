import type { Action, ClassificationResult, GuardrailRule, RiskLevel } from "../core/types.js";

export function getCommandString(action: Action): string {
  if (action.type === "stop") return "";
  if (!action.toolName) return "";

  switch (action.toolName) {
    case "shell":
      return typeof action.parameters?.command === "string" ? action.parameters.command : "";
    case "write_file":
      return typeof action.parameters?.filePath === "string" ? action.parameters.filePath : action.toolName;
    default:
      return action.toolName;
  }
}

export function scoreRisk(
  action: Action,
  classification: ClassificationResult,
  rules: GuardrailRule[],
): ClassificationResult {
  const command = getCommandString(action);
  let totalScore = 0;
  const matchedRules: string[] = [];

  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.pattern, "i");
      if (regex.test(command)) {
        totalScore += rule.score;
        matchedRules.push(rule.description);
      }
    } catch {
      // skip invalid regex
    }
  }

  totalScore = Math.min(totalScore, 100);

  let riskLevel: RiskLevel = "safe";
  if (totalScore > 70) {
    riskLevel = "block";
  } else if (totalScore > 30) {
    riskLevel = "warn";
  }

  return {
    category: classification.category,
    riskScore: totalScore,
    riskLevel,
    matchedRules,
  };
}