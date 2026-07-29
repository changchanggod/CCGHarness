import * as fs from "fs";

export function loadProjectContext(rulesPath: string): string {
  try {
    return fs.readFileSync(rulesPath, "utf-8");
  } catch {
    return "";
  }
}