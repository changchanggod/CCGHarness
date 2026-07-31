export interface Action {
  type: "tool_call" | "stop";
  toolName?: string;
  parameters?: Record<string, unknown>;
  summary?: string;
  toolCallId?: string;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface Issue {
  severity: "error" | "warning";
  file?: string;
  line?: number;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: Issue[];
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCallRecord[];
}

export interface LLMResponse {
  actions: Action[];
  rawUsage: { prompt: number; completion: number };
  toolCalls?: ToolCallRecord[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export type CommandCategory = "file_read" | "file_write" | "shell" | "build_test" | "network" | "unknown";

export type RiskLevel = "safe" | "warn" | "block";

export interface ClassificationResult {
  category: CommandCategory;
  riskScore: number;
  riskLevel: RiskLevel;
  matchedRules: string[];
}

export interface GuardrailRule {
  pattern: string;
  score: number;
  description: string;
}

export type ApprovalState = "idle" | "waiting" | "approved" | "denied" | "timeout";

export type ApprovalDecision = "approve" | "deny" | "approve_all";

export interface ConversationTurn {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp: number;
  tokenCount: number;
  toolCallId?: string;
  toolCalls?: ToolCallRecord[];
}

export interface CompressedSummary {
  originalTask: string;
  approaches: string[];
  keyFindings: string[];
  failures: string[];
  compressedAt: number;
}

export interface LoopConfig {
  maxRounds: number;
  maxConsecutiveFailures: number;
  llmRetryAttempts: number;
}

export interface LoopState {
  round: number;
  consecutiveFailures: number;
  conversationHistory: ConversationTurn[];
  compressedSummary: CompressedSummary | null;
  finished: boolean;
  finalResult: string;
}