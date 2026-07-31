import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message, ToolDefinition } from "../../src/core/types.js";
import { DeepSeekProvider } from "../../src/providers/deepseek.js";

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

describe("DeepSeekProvider", () => {
  let provider: DeepSeekProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new DeepSeekProvider({
      apiKey: "sk-test",
    });
  });

  it("defaults to deepseek-chat model", () => {
    expect(provider).toBeInstanceOf(DeepSeekProvider);
  });

  it("accepts custom model", () => {
    const custom = new DeepSeekProvider({
      apiKey: "sk-test",
      model: "deepseek-reasoner",
    });
    expect(custom).toBeInstanceOf(DeepSeekProvider);
  });

  it("handles tool calls from DeepSeek API response", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "read_file",
                  arguments: JSON.stringify({ path: "/src/main.ts" }),
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 40, completion_tokens: 25 },
    });

    const messages: Message[] = [
      { role: "user", content: "Read main.ts" },
    ];
    const tools: ToolDefinition[] = [
      {
        name: "read_file",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
        execute: async () => ({ success: true, output: "" }),
      },
    ];

    const result = await provider.chat(messages, tools);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({
      type: "tool_call",
      toolName: "read_file",
      parameters: { path: "/src/main.ts" },
      toolCallId: "call_1",
    });
    expect(result.rawUsage).toEqual({ prompt: 40, completion: 25 });
  });

  it("handles text response as stop action", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Done.",
            tool_calls: null,
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const messages: Message[] = [
      { role: "user", content: "Hello" },
    ];
    const tools: ToolDefinition[] = [];

    const result = await provider.chat(messages, tools);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({
      type: "stop",
      summary: "Done.",
    });
  });
});