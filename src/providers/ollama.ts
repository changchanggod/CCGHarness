import type { Message, LLMResponse, ToolDefinition, Action } from "../core/types.js";
import type { LLMProvider } from "./interface.js";

export interface OllamaConfig {
  baseURL: string;
  model: string;
}

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaChatResponse {
  message: {
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  prompt_eval_count: number;
  eval_count: number;
}

export class OllamaProvider implements LLMProvider {
  private baseURL: string;
  private model: string;

  constructor(config: OllamaConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, "");
    this.model = config.model;
  }

  async chat(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const ollamaMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const ollamaTools = tools.length > 0
      ? tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }))
      : undefined;

    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: ollamaMessages,
        ...(ollamaTools ? { tools: ollamaTools } : {}),
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as OllamaChatResponse;

    const actions: Action[] = [];

    if (data.message.tool_calls && data.message.tool_calls.length > 0) {
      for (const toolCall of data.message.tool_calls) {
        actions.push({
          type: "tool_call",
          toolName: toolCall.function.name,
          parameters: toolCall.function.arguments,
        });
      }
    } else {
      actions.push({
        type: "stop",
        summary: data.message.content || "No response content",
      });
    }

    return {
      actions,
      rawUsage: {
        prompt: data.prompt_eval_count,
        completion: data.eval_count,
      },
    };
  }
}