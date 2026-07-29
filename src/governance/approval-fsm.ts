export interface ApprovalRequest {
  actionDescription: string;
  riskLevel: string;
  matchedRules: string[];
}

export type ApprovalState = "idle" | "waiting" | "approved" | "denied" | "timeout";
export type ApprovalDecision = "approve" | "deny" | "approve_all";

export interface ApprovalFSMConfig {
  timeoutMs: number;
}

export class ApprovalFSM {
  private state: ApprovalState = "idle";
  private pendingRequest: ApprovalRequest | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private approveAllFlag = false;
  private readonly timeoutMs: number;

  constructor(config: ApprovalFSMConfig) {
    this.timeoutMs = config.timeoutMs;
  }

  requestApproval(request: ApprovalRequest): void {
    if (this.approveAllFlag) {
      this.state = "approved";
      return;
    }
    if (this.state !== "idle") {
      throw new Error(`Cannot request approval in state: ${this.state}`);
    }
    this.pendingRequest = request;
    this.state = "waiting";
    this.timeoutId = setTimeout(() => {
      this.state = "timeout";
    }, this.timeoutMs);
  }

  submitDecision(decision: ApprovalDecision): void {
    if (decision === "approve_all") {
      throw new Error("Invalid decision: approve_all");
    }
    if (this.state !== "waiting") {
      throw new Error(`Cannot submit decision in state: ${this.state}`);
    }
    this.clearTimeout();
    this.state = decision === "approve" ? "approved" : "denied";
  }

  approveAll(): void {
    this.clearTimeout();
    this.approveAllFlag = true;
    this.state = "approved";
  }

  reset(): void {
    this.clearTimeout();
    this.state = "idle";
    this.pendingRequest = null;
    this.approveAllFlag = false;
  }

  getState(): ApprovalState {
    return this.state;
  }

  getPendingRequest(): ApprovalRequest | null {
    return this.pendingRequest;
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}