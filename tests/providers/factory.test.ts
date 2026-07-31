import { describe, it, expect } from "vitest";
import { createProvider, type LLMConfig } from "../../src/providers/factory.js";
import { OpenAIProvider } from "../../src/providers/openai.js";
import { AnthropicProvider } from "../../src/providers/anthropic.js";
import { OllamaProvider } from "../../src/providers/ollama.js";
import { DeepSeekProvider } from "../../src/providers/deepseek.js";
import { MockLLMProvider } from "../../src/providers/mock.js";
import type { LLMResponse } from "../../src/core/types.js";

const mockResponses: LLMResponse[] = [
  {
    actions: [{ type: "stop", summary: "mock response" }],
    rawUsage: { prompt: 0, completion: 0 },
  },
];

describe("createProvider", () => {
  it("creates OpenAIProvider for openai config", () => {
    const config: LLMConfig = {
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4",
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("creates AnthropicProvider for anthropic config", () => {
    const config: LLMConfig = {
      provider: "anthropic",
      apiKey: "sk-ant-test",
      model: "claude-3",
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("creates OllamaProvider for ollama config", () => {
    const config: LLMConfig = {
      provider: "ollama",
      baseURL: "http://localhost:11434",
      model: "llama3",
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it("creates DeepSeekProvider for deepseek config", () => {
    const config: LLMConfig = {
      provider: "deepseek",
      apiKey: "sk-test",
      model: "deepseek-chat",
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(DeepSeekProvider);
  });

  it("creates MockLLMProvider for mock config", () => {
    const config: LLMConfig = {
      provider: "mock",
      responses: mockResponses,
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(MockLLMProvider);
  });

  it("throws for unknown provider type", () => {
    expect(() =>
      createProvider({ provider: "unknown" } as unknown as LLMConfig)
    ).toThrow(/unknown provider/i);
  });
});