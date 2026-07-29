import type { Message, LLMResponse, ToolDefinition } from "../core/types.js";
import type { LLMProvider } from "./interface.js";

export class MockLLMProvider implements LLMProvider {
  private responses: LLMResponse[];
  private index: number;

  constructor(responses: LLMResponse[]) {
    this.responses = responses;
    this.index = 0;
  }

  async chat(_messages: Message[], _tools: ToolDefinition[]): Promise<LLMResponse> {
    if (this.index >= this.responses.length) {
      throw new Error("No more mock responses available");
    }
    return this.responses[this.index++];
  }
}