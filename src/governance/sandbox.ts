import type { Action } from "../core/types.js";
import * as path from "node:path";

export interface SandboxConfig {
  workspace: string;
  allowedCommands: string[];
  blockedCommands: string[];
  allowNetwork: boolean;
}

export interface SandboxResult {
  allowed: boolean;
  reason?: string;
}

export function checkSandbox(action: Action, config: SandboxConfig): SandboxResult {
  if (action.type === "stop") {
    return { allowed: true };
  }

  const toolName = action.toolName;

  if (toolName === "write_file") {
    const filePath = typeof action.parameters?.filePath === "string" ? action.parameters.filePath : "";
    if (!filePath) {
      return { allowed: false, reason: "write_file requires a filePath parameter" };
    }
    const resolved = path.resolve(filePath);
    const resolvedWorkspace = path.resolve(config.workspace);
    const normalizedWorkspace = resolvedWorkspace.endsWith(path.sep)
      ? resolvedWorkspace
      : resolvedWorkspace + path.sep;

    if (!resolved.startsWith(normalizedWorkspace) && resolved !== resolvedWorkspace) {
      return {
        allowed: false,
        reason: `write_file path "${resolved}" is outside workspace "${resolvedWorkspace}"`,
      };
    }
    return { allowed: true };
  }

  if (toolName === "shell") {
    const command = typeof action.parameters?.command === "string" ? action.parameters.command : "";

    for (const blocked of config.blockedCommands) {
      if (command.includes(blocked)) {
        return {
          allowed: false,
          reason: `Shell command contains blocked pattern: "${blocked}"`,
        };
      }
    }

    if (config.allowedCommands.length > 0) {
      const allowed = config.allowedCommands.some((prefix) => command.startsWith(prefix));
      if (!allowed) {
        return {
          allowed: false,
          reason: `Shell command "${command}" does not match any allowed prefix`,
        };
      }
    }

    return { allowed: true };
  }

  return { allowed: true };
}