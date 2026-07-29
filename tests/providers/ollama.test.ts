import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message, ToolDefinition } from "../../src/core/types.js";
import { OllamaProvider } from "../../src/providers/ollama.js";

describe("OllamaProvider", () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    provider = new OllamaProvider({
      baseURL: "http://localhost:11434",
      model: "llama3",
    });
  });

  it("parses Ollama tool_calls response into Action[]", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          content: "",
          tool_calls: [
            {
              function: {
                name: "read_file",
                arguments: { path: "/src/index.ts" },
              },
            },
          ],
        },
        prompt_eval_count: 50,
        eval_count: 30,
      }),
    }));

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

  it("handles content-only response as stop action with summary", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          content: "Task completed successfully.",
        },
        prompt_eval_count: 100,
        eval_count: 20,
      }),
    }));

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

  it("throws on non-ok response with status info", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    }));

    const messages: Message[] = [
      { role: "user", content: "Hello" },
    ];

    await expect(provider.chat(messages, [])).rejects.toThrow(
      "Ollama API error: 500 Internal Server Error"
    );
  });
});