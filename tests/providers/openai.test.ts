import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message, ToolDefinition } from "../../src/core/types.js";
import { OpenAIProvider } from "../../src/providers/openai.js";

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

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider({
      apiKey: "test-key",
      model: "gpt-4",
    });
  });

  it("parses tool_calls from OpenAI response into Action[]", async () => {
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
                  arguments: JSON.stringify({ path: "/src/index.ts" }),
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 30 },
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
    });
    expect(result.rawUsage).toEqual({ prompt: 50, completion: 30 });
  });

  it("handles text-only response as stop action with summary", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Task completed successfully.",
            tool_calls: null,
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
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
});