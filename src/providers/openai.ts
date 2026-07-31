import OpenAI from "openai";
import type { Message, LLMResponse, ToolDefinition, Action, ToolCallRecord } from "../core/types.js";
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
    if (process.env.DEBUG === "true") {
      process.env.DEBUG = "false";
    }
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      maxRetries: 0,
    });
    this.model = config.model;
  }

  async chat(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const openaiMessages = messages.map((msg) => {
      const base: Record<string, unknown> = {
        role: msg.role,
        content: msg.content,
      };
      if (msg.toolCallId) {
        base.tool_call_id = msg.toolCallId;
      }
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        base.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        }));
      }
      return base;
    }) as unknown as OpenAI.ChatCompletionMessageParam[];

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
      stream: false,
      ...(openaiTools ? { tools: openaiTools } : {}),
    });

    const actions: Action[] = [];
    const toolCalls: ToolCallRecord[] = [];
    const choice = response.choices[0];
    const msg = choice.message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const toolCall of msg.tool_calls) {
        const args = toolCall.function.arguments || "{}";
        actions.push({
          type: "tool_call",
          toolName: toolCall.function.name,
          parameters: JSON.parse(args),
          toolCallId: toolCall.id,
        });
        toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: args,
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
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      rawUsage: {
        prompt: response.usage?.prompt_tokens ?? 0,
        completion: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}