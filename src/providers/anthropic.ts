import { Anthropic } from "@anthropic-ai/sdk";
import type { Message, LLMResponse, ToolDefinition, Action, ToolCallRecord } from "../core/types.js";
import type { LLMProvider } from "./interface.js";

export interface AnthropicConfig {
  apiKey: string;
  model: string;
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(config: AnthropicConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model;
  }

  async chat(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const systemParam = systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n")
      : undefined;

    const anthropicMessages = nonSystemMessages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const anthropicTools = tools.length > 0
      ? tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        }))
      : undefined;

    const response = await this.client.messages.create({
      model: this.model,
      system: systemParam,
      messages: anthropicMessages,
      max_tokens: 4096,
      ...(anthropicTools ? { tools: anthropicTools } : {}),
    });

    const actions: Action[] = [];
    const toolCalls: ToolCallRecord[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        actions.push({
          type: "tool_call",
          toolName: block.name,
          parameters: block.input as Record<string, unknown>,
          toolCallId: block.id,
        });
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
        });
      }
    }

    if (actions.length === 0) {
      const textBlocks = response.content.filter(
        (block): block is { type: "text"; text: string } => block.type === "text"
      );
      const summary = textBlocks.map((b) => b.text).join("\n") || "No response content";
      actions.push({
        type: "stop",
        summary,
      });
    }

    return {
      actions,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      rawUsage: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
      },
    };
  }
}