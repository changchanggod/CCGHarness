import type { Message, LLMResponse, Action, ToolDefinition, ToolResult, ConversationTurn, LoopState } from "./types.js";
import type { LLMProvider } from "../providers/interface.js";
import type { GuardOrchestrator, GuardResult } from "../governance/guard.js";
import { ConversationManager } from "../memory/conversation.js";
import { compressConversation } from "../memory/compressor.js";

export interface AgentLoopConfig {
  provider: LLMProvider;
  guard: GuardOrchestrator;
  tools: ToolDefinition[];
  maxRounds: number;
  maxConsecutiveFailures: number;
  systemPrompt: string;
  projectContext: string;
  maxTokens?: number;
  compressionThreshold?: number;
}

export class AgentLoop {
  private config: AgentLoopConfig;
  private memory: ConversationManager;
  private round: number;
  private consecutiveFailures: number;
  private finished: boolean;
  private finalResult: string;

  constructor(config: AgentLoopConfig) {
    this.config = config;
    this.memory = new ConversationManager(config.maxTokens ?? 100000);
    this.round = 0;
    this.consecutiveFailures = 0;
    this.finished = false;
    this.finalResult = "";
  }

  async run(task: string): Promise<string> {
    this.round = 0;
    this.consecutiveFailures = 0;
    this.finished = false;
    this.finalResult = "";

    this.memory.addTurn({
      role: "user",
      content: task,
      timestamp: Date.now(),
      tokenCount: task.length,
    });

    return this.executeLoop();
  }

  clearContext(): void {
    this.memory = new ConversationManager(this.config.maxTokens ?? 100000);
    this.round = 0;
    this.consecutiveFailures = 0;
    this.finished = false;
    this.finalResult = "";
  }

  getState(): LoopState {
    return {
      round: this.round,
      consecutiveFailures: this.consecutiveFailures,
      conversationHistory: this.memory.getHistory(),
      compressedSummary: null,
      finished: this.finished,
      finalResult: this.finalResult,
    };
  }

  private async executeLoop(): Promise<string> {
    const threshold = this.config.compressionThreshold ?? 0.8;

    while (this.round < this.config.maxRounds && !this.finished) {
      this.round++;

      this.checkAndCompress(threshold);

      const messages = this.buildMessages();
      let response: LLMResponse;
      try {
        response = await this.config.provider.chat(messages, this.config.tools);
      } catch {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
          this.finished = true;
          this.finalResult = "Stopped: max consecutive failures reached";
          return this.finalResult;
        }
        continue;
      }

      this.memory.addTurn({
        role: "assistant",
        content: JSON.stringify(response.actions),
        timestamp: Date.now(),
        tokenCount: JSON.stringify(response.actions).length,
        ...(response.toolCalls ? { toolCalls: response.toolCalls } : {}),
      });

      for (const action of response.actions) {
        if (action.type === "stop") {
          this.finished = true;
          this.finalResult = action.summary ?? "Task completed";
          return this.finalResult;
        }

        if (action.type === "tool_call") {
          const guardResult = await this.config.guard.guard(action);
          if (!guardResult.allowed) {
            this.consecutiveFailures++;
            this.memory.addTurn({
              role: "tool",
              content: `Guard blocked action: ${guardResult.reason}`,
              timestamp: Date.now(),
              tokenCount: 30,
              ...(action.toolCallId ? { toolCallId: action.toolCallId } : {}),
            });
            if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
              this.finished = true;
              this.finalResult = "Stopped: max consecutive failures reached";
              return this.finalResult;
            }
            continue;
          }

          const toolName = action.toolName ?? "";
          const tool = this.config.tools.find((t) => t.name === toolName);

          if (!tool) {
            this.consecutiveFailures++;
            this.memory.addTurn({
              role: "tool",
              content: `Tool not found: ${toolName}`,
              timestamp: Date.now(),
              tokenCount: 20,
              ...(action.toolCallId ? { toolCallId: action.toolCallId } : {}),
            });
            if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
              this.finished = true;
              this.finalResult = "Stopped: max consecutive failures reached";
              return this.finalResult;
            }
            continue;
          }

          let result: ToolResult;
          try {
            result = await tool.execute(action.parameters ?? {});
          } catch {
            result = { success: false, output: "", error: "Tool execution threw exception" };
          }

          this.memory.addTurn({
            role: "tool",
            content: result.success ? result.output : `Tool error: ${result.error}`,
            timestamp: Date.now(),
            tokenCount: 20,
            ...(action.toolCallId ? { toolCallId: action.toolCallId } : {}),
          });

          if (result.success) {
            this.consecutiveFailures = 0;
          } else {
            this.consecutiveFailures++;
            if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
              this.finished = true;
              this.finalResult = "Stopped: max consecutive failures reached";
              return this.finalResult;
            }
          }
        }
      }
    }

    if (!this.finished) {
      this.finished = true;
      this.finalResult = "Stopped: max rounds reached";
    }

    return this.finalResult;
  }

  private buildMessages(): Message[] {
    const messages: Message[] = [];
    messages.push({ role: "system", content: this.config.systemPrompt });
    if (this.config.projectContext) {
      messages.push({ role: "system", content: this.config.projectContext });
    }
    messages.push(...this.memory.toMessages());
    return messages;
  }

  private checkAndCompress(threshold: number): void {
    if (this.memory.needsCompression(threshold)) {
      const oldest = this.memory.getOldestHalf();
      if (oldest.length > 0) {
        const summary = compressConversationSync(oldest);
        this.memory.replaceOldestWithSummary(summary);
      }
    }
  }
}

function compressConversationSync(turns: ConversationTurn[]): string {
  const content = turns.map((t) => `[${t.role}]: ${t.content}`).join("\n");
  return `[Compressed ${turns.length} turns]: ${content}`;
}