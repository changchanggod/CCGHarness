import type { Message, LLMResponse, ToolDefinition } from "../core/types.js";

export interface LLMProvider {
  chat(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse>;
}