import OpenAI from "openai";
import type { Message, LLMResponse, ToolDefinition, Action } from "../core/types.js";
import type { LLMProvider } from "./interface.js";

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
  }

  async chat(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const openaiMessages = messages.map((msg) => ({
      role: msg.role as "system" | "user" | "assistant" | "tool",
      content: msg.content,
      ...(msg.toolCallId ? { tool_call_id: msg.toolCallId } : {}),
    })) as OpenAI.ChatCompletionMessageParam[];

    const openaiTools = tools.length > 0
      ? tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }))
      : undefined;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      ...(openaiTools ? { tools: openaiTools } : {}),
    });

    const actions: Action[] = [];
    const choice = response.choices[0];
    const msg = choice.message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const toolCall of msg.tool_calls) {
        actions.push({
          type: "tool_call",
          toolName: toolCall.function.name,
          parameters: JSON.parse(toolCall.function.arguments || "{}"),
        });
      }
    } else {
      actions.push({
        type: "stop",
        summary: msg.content ?? "No response content",
      });
    }

    return {
      actions,
      rawUsage: {
        prompt: response.usage?.prompt_tokens ?? 0,
        completion: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}