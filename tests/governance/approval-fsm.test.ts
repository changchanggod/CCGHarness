import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApprovalFSM } from "../../src/governance/approval-fsm.js";
import type { ApprovalRequest } from "../../src/governance/approval-fsm.js";

function makeRequest(overrides?: Partial<ApprovalRequest>): ApprovalRequest {
  return {
    actionDescription: "rm -rf /",
    riskLevel: "block",
    matchedRules: ["Recursive force delete on root/home"],
    ...overrides,
  };
}

describe("ApprovalFSM", () => {
  let fsm: ApprovalFSM;

  beforeEach(() => {
    vi.useFakeTimers();
    fsm = new ApprovalFSM({ timeoutMs: 30000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("starts in idle state", () => {
      expect(fsm.getState()).toBe("idle");
    });

    it("has no pending request initially", () => {
      expect(fsm.getPendingRequest()).toBeNull();
    });
  });

  describe("requestApproval", () => {
    it("transitions from idle to waiting", () => {
      fsm.requestApproval(makeRequest());
      expect(fsm.getState()).toBe("waiting");
    });

    it("stores the pending request", () => {
      const req = makeRequest();
      fsm.requestApproval(req);
      expect(fsm.getPendingRequest()).toEqual(req);
    });

    it("does not allow double request while waiting", () => {
      fsm.requestApproval(makeRequest());
      expect(() => fsm.requestApproval(makeRequest())).toThrow(
        "Cannot request approval in state: waiting",
      );
    });
  });

  describe("submitDecision", () => {
    it("approve transitions from waiting to approved", () => {
      fsm.requestApproval(makeRequest());
      fsm.submitDecision("approve");
      expect(fsm.getState()).toBe("approved");
    });

    it("deny transitions from waiting to denied", () => {
      fsm.requestApproval(makeRequest());
      fsm.submitDecision("deny");
      expect(fsm.getState()).toBe("denied");
    });

    it("throws on submitDecision while idle", () => {
      expect(() => fsm.submitDecision("approve")).toThrow(
        "Cannot submit decision in state: idle",
      );
    });

    it("throws on double submitDecision", () => {
      fsm.requestApproval(makeRequest());
      fsm.submitDecision("approve");
      expect(() => fsm.submitDecision("approve")).toThrow(
        "Cannot submit decision in state: approved",
      );
    });

    it("throws on approve_all via submitDecision", () => {
      fsm.requestApproval(makeRequest());
      expect(() => fsm.submitDecision("approve_all")).toThrow(
        'Invalid decision: approve_all',
      );
    });
  });

  describe("timeout", () => {
    it("transitions to timeout after timeoutMs elapses", () => {
      fsm.requestApproval(makeRequest());
      vi.advanceTimersByTime(30000);
      expect(fsm.getState()).toBe("timeout");
    });

    it("does not timeout before timeoutMs", () => {
      fsm.requestApproval(makeRequest());
      vi.advanceTimersByTime(29999);
      expect(fsm.getState()).toBe("waiting");
    });

    it("clears timeout when decision is submitted before timeout", () => {
      fsm.requestApproval(makeRequest());
      fsm.submitDecision("approve");
      vi.advanceTimersByTime(30000);
      expect(fsm.getState()).toBe("approved");
    });
  });

  describe("approveAll", () => {
    it("approveAll transitions to approved and stores auto-approve flag", () => {
      fsm.approveAll();
      expect(fsm.getState()).toBe("approved");
    });

    it("auto-approves subsequent requests after approveAll", () => {
      fsm.approveAll();
      fsm.requestApproval(makeRequest());
      expect(fsm.getState()).toBe("approved");
    });

    it("resets approveAll flag on reset", () => {
      fsm.approveAll();
      fsm.reset();
      fsm.requestApproval(makeRequest());
      expect(fsm.getState()).toBe("waiting");
    });
  });

  describe("reset", () => {
    it("resets to idle from any state", () => {
      const states = ["waiting", "approved", "denied", "timeout"] as const;
      for (const state of states) {
        fsm.requestApproval(makeRequest());
        if (state === "approved") fsm.submitDecision("approve");
        else if (state === "denied") fsm.submitDecision("deny");
        else if (state === "timeout") vi.advanceTimersByTime(30000);
        expect(fsm.getState()).toBe(state);
        fsm.reset();
        expect(fsm.getState()).toBe("idle");
      }
    });

    it("clears pending request on reset", () => {
      fsm.requestApproval(makeRequest());
      fsm.reset();
      expect(fsm.getPendingRequest()).toBeNull();
    });

    it("clears timeout on reset", () => {
      fsm.requestApproval(makeRequest());
      fsm.reset();
      vi.advanceTimersByTime(30000);
      expect(fsm.getState()).toBe("idle");
    });
  });

  describe("pending request details", () => {
    it("returns full request details via getPendingRequest", () => {
      const req = makeRequest({
        actionDescription: "git push --force",
        riskLevel: "warn",
        matchedRules: ["Force push", "Dangerous git operation"],
      });
      fsm.requestApproval(req);
      const pending = fsm.getPendingRequest();
      expect(pending).toEqual(req);
      expect(pending?.actionDescription).toBe("git push --force");
      expect(pending?.riskLevel).toBe("warn");
      expect(pending?.matchedRules).toHaveLength(2);
    });

    it("returns null after reset", () => {
      fsm.requestApproval(makeRequest());
      fsm.reset();
      expect(fsm.getPendingRequest()).toBeNull();
    });
  });
});