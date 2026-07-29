import yaml from "js-yaml";
import * as fs from "node:fs";

export interface AppConfig {
  llm: {
    provider: string;
    model: string;
    maxRounds: number;
    temperature: number;
  };
  guardrails: {
    rulesFile: string;
    hitlEnabled: boolean;
    hitlTimeout: number;
    sandbox: {
      workspace: string;
      allowedCommands: string[];
      blockedCommands: string[];
      allowNetwork: boolean;
    };
  };
  tools: {
    enabled: string[];
  };
  feedback: {
    autoLint: boolean;
    autoTest: boolean;
    testCommand: string;
    lintCommand: string;
  };
}

const DEFAULTS: AppConfig = {
  llm: {
    provider: "openai",
    model: "gpt-4o",
    maxRounds: 20,
    temperature: 0.1,
  },
  guardrails: {
    rulesFile: "guardrails.yaml",
    hitlEnabled: true,
    hitlTimeout: 120,
    sandbox: {
      workspace: ".",
      allowedCommands: [],
      blockedCommands: [],
      allowNetwork: false,
    },
  },
  tools: {
    enabled: ["read_file", "write_file", "shell", "run_tests", "run_lint"],
  },
  feedback: {
    autoLint: true,
    autoTest: true,
    testCommand: "npm test",
    lintCommand: "npm run lint",
  },
};

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(mapKeys);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = mapKeys(value);
    }
    return result;
  }
  return obj;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const targetValue = target[key];
      if (targetValue !== null && typeof targetValue === "object" && !Array.isArray(targetValue)) {
        deepMerge(targetValue as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        target[key] = value;
      }
    } else {
      target[key] = value;
    }
  }
}

export function loadConfig(filePath: string): AppConfig {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw);
  const mapped = mapKeys(parsed ?? {}) as Record<string, unknown>;
  const config = JSON.parse(JSON.stringify(DEFAULTS)) as AppConfig;
  deepMerge(config as unknown as Record<string, unknown>, mapped);
  return config;
}