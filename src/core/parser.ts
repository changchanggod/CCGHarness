import type { LLMResponse, Action } from "./types.js";

export function parseActions(response: LLMResponse): Action[] {
  return response.actions;
}