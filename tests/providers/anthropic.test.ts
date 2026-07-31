import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message, ToolDefinition } from "../../src/core/types.js";
import { AnthropicProvider } from "../../src/providers/anthropic.js";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider({
      apiKey: "test-key",
      model: "claude-sonnet-4-20250514",
    });
  });

  it("parses tool_use blocks from Anthropic response content into Action[]", async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_01A",
          name: "read_file",
          input: { path: "/src/index.ts" },
        },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
    });

    const messages: Message[] = [
      { role: "user", content: "Read the file" },
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
      parameters: { path: "/src/index.ts" },
      toolCallId: "toolu_01A",
    });
    expect(result.rawUsage).toEqual({ prompt: 50, completion: 30 });
  });

  it("handles text-only response (end_turn) as stop action with summary", async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "Task completed successfully.",
        },
      ],
      usage: { input_tokens: 100, output_tokens: 20 },
    });

    const messages: Message[] = [
      { role: "user", content: "Do something" },
    ];
    const tools: ToolDefinition[] = [];

    const result = await provider.chat(messages, tools);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({
      type: "stop",
      summary: "Task completed successfully.",
    });
    expect(result.rawUsage).toEqual({ prompt: 100, completion: 20 });
  });

  it("filters system messages from the messages array and passes them as separate system param", async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "OK" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const messages: Message[] = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ];
    const tools: ToolDefinition[] = [];

    await provider.chat(messages, tools);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "You are a helpful assistant.",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
  });

  it("maps tools to Anthropic format with input_schema", async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "OK" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const messages: Message[] = [
      { role: "user", content: "Run a command" },
    ];
    const tools: ToolDefinition[] = [
      {
        name: "run_command",
        description: "Run a shell command",
        parameters: {
          type: "object",
          properties: { cmd: { type: "string" } },
          required: ["cmd"],
        },
        execute: async () => ({ success: true, output: "" }),
      },
    ];

    await provider.chat(messages, tools);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          {
            name: "run_command",
            description: "Run a shell command",
            input_schema: {
              type: "object",
              properties: { cmd: { type: "string" } },
              required: ["cmd"],
            },
          },
        ],
      }),
    );
  });
});