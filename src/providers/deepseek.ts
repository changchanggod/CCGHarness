import { OpenAIProvider } from "./openai.js";
import type { LLMProvider } from "./interface.js";

export interface DeepSeekConfig {
  apiKey: string;
  model?: string;
}

export class DeepSeekProvider extends OpenAIProvider implements LLMProvider {
  constructor(config: DeepSeekConfig) {
    super({
      apiKey: config.apiKey,
      model: config.model ?? "deepseek-chat",
      baseURL: "https://api.deepseek.com",
    });
  }
}