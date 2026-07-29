import type { LLMResponse } from "../core/types.js";
import type { LLMProvider } from "./interface.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { OllamaProvider } from "./ollama.js";
import { MockLLMProvider } from "./mock.js";

export type LLMConfig =
  | { provider: "openai"; apiKey: string; model: string; baseURL?: string }
  | { provider: "anthropic"; apiKey: string; model: string }
  | { provider: "ollama"; baseURL: string; model: string }
  | { provider: "mock"; responses: LLMResponse[] };

export function createProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider({ apiKey: config.apiKey, model: config.model, baseURL: config.baseURL });
    case "anthropic":
      return new AnthropicProvider({ apiKey: config.apiKey, model: config.model });
    case "ollama":
      return new OllamaProvider({ baseURL: config.baseURL, model: config.model });
    case "mock":
      return new MockLLMProvider(config.responses);
    default: {
      const _exhaustive: never = config;
      throw new Error(`Unknown provider: ${(_exhaustive as { provider: string }).provider}`);
    }
  }
}