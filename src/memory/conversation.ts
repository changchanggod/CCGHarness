import type { ConversationTurn, Message } from "../core/types.js";

export class ConversationManager {
  private history: ConversationTurn[] = [];
  private maxTokens: number;

  constructor(maxTokens: number) {
    this.maxTokens = maxTokens;
  }

  addTurn(turn: ConversationTurn): void {
    this.history.push(turn);
  }

  getHistory(): ConversationTurn[] {
    return this.history;
  }

  getEstimatedTokens(): number {
    return this.history.reduce((sum, t) => sum + t.tokenCount, 0);
  }

  needsCompression(threshold: number): boolean {
    return this.getEstimatedTokens() > this.maxTokens * threshold;
  }

  getOldestHalf(): ConversationTurn[] {
    const n = this.history.length;
    if (n === 0) return [];
    const half = Math.ceil(n / 2);
    return this.history.slice(0, half);
  }

  replaceOldestWithSummary(summary: string): void {
    const n = this.history.length;
    if (n === 0) return;
    const half = Math.ceil(n / 2);
    const remaining = this.history.slice(half);
    const summaryTurn: ConversationTurn = {
      role: "user",
      content: `[Conversation summary] ${summary}`,
      timestamp: Date.now(),
      tokenCount: summary.length,
    };
    this.history = [summaryTurn, ...remaining];
  }

  toMessages(): Message[] {
    return this.history.map((t) => ({
      role: t.role,
      content: t.content,
      ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
      ...(t.toolCalls ? { toolCalls: t.toolCalls } : {}),
    }));
  }
}