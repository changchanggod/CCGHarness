import { describe, it, expect, beforeEach } from "vitest";
import { ConversationManager } from "../../src/memory/conversation.js";
import type { ConversationTurn } from "../../src/core/types.js";

function makeTurn(
  overrides: Partial<ConversationTurn> = {}
): ConversationTurn {
  return {
    role: "assistant",
    content: "test content",
    timestamp: 1700000000000,
    tokenCount: 10,
    ...overrides,
  };
}

describe("ConversationManager", () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager(1000);
  });

  describe("addTurn", () => {
    it("adds a turn to history", () => {
      manager.addTurn(makeTurn());
      expect(manager.getHistory()).toHaveLength(1);
    });

    it("appends turns in order", () => {
      manager.addTurn(makeTurn({ role: "user", content: "first" }));
      manager.addTurn(makeTurn({ role: "assistant", content: "second" }));
      const history = manager.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe("first");
      expect(history[1].content).toBe("second");
    });
  });

  describe("getHistory", () => {
    it("returns empty array when no turns added", () => {
      expect(manager.getHistory()).toEqual([]);
    });

    it("returns all added turns", () => {
      const t1 = makeTurn({ content: "a" });
      const t2 = makeTurn({ content: "b" });
      const t3 = makeTurn({ content: "c" });
      manager.addTurn(t1);
      manager.addTurn(t2);
      manager.addTurn(t3);
      expect(manager.getHistory()).toEqual([t1, t2, t3]);
    });
  });

  describe("getEstimatedTokens", () => {
    it("returns 0 for empty history", () => {
      expect(manager.getEstimatedTokens()).toBe(0);
    });

    it("sums tokenCounts across all turns", () => {
      manager.addTurn(makeTurn({ tokenCount: 50 }));
      manager.addTurn(makeTurn({ tokenCount: 30 }));
      manager.addTurn(makeTurn({ tokenCount: 20 }));
      expect(manager.getEstimatedTokens()).toBe(100);
    });
  });

  describe("needsCompression", () => {
    it("returns false when estimated tokens is below threshold", () => {
      manager.addTurn(makeTurn({ tokenCount: 100 }));
      expect(manager.needsCompression(0.8)).toBe(false);
    });

    it("returns false when estimated tokens equals threshold boundary", () => {
      manager.addTurn(makeTurn({ tokenCount: 800 }));
      expect(manager.needsCompression(0.8)).toBe(false);
    });

    it("returns true when estimated tokens exceeds maxTokens * threshold", () => {
      manager.addTurn(makeTurn({ tokenCount: 400 }));
      manager.addTurn(makeTurn({ tokenCount: 500 }));
      expect(manager.needsCompression(0.8)).toBe(true);
    });
  });

  describe("getOldestHalf", () => {
    it("returns empty array for empty history", () => {
      expect(manager.getOldestHalf()).toEqual([]);
    });

    it("returns single turn for single-turn history", () => {
      const t = makeTurn();
      manager.addTurn(t);
      expect(manager.getOldestHalf()).toEqual([t]);
    });

    it("returns first half for even number of turns", () => {
      const turns = [makeTurn({ content: "1" }), makeTurn({ content: "2" }),
        makeTurn({ content: "3" }), makeTurn({ content: "4" })];
      for (const t of turns) { manager.addTurn(t); }
      expect(manager.getOldestHalf()).toEqual([turns[0], turns[1]]);
    });

    it("returns first ceil(n/2) for odd number of turns", () => {
      const turns = [makeTurn({ content: "1" }), makeTurn({ content: "2" }),
        makeTurn({ content: "3" }), makeTurn({ content: "4" }),
        makeTurn({ content: "5" })];
      for (const t of turns) { manager.addTurn(t); }
      const oldest = manager.getOldestHalf();
      expect(oldest).toHaveLength(3);
      expect(oldest[0].content).toBe("1");
      expect(oldest[1].content).toBe("2");
      expect(oldest[2].content).toBe("3");
    });
  });

  describe("replaceOldestWithSummary", () => {
    it("does nothing for empty history", () => {
      manager.replaceOldestWithSummary("summary");
      expect(manager.getHistory()).toEqual([]);
    });

    it("replaces oldest half with a single system turn", () => {
      const turns = [makeTurn({ content: "1" }), makeTurn({ content: "2" }),
        makeTurn({ content: "3" }), makeTurn({ content: "4" })];
      for (const t of turns) { manager.addTurn(t); }

      manager.replaceOldestWithSummary("Compressed summary");

      const history = manager.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].role).toBe("system");
      expect(history[0].content).toBe("Compressed summary");
      expect(history[0].tokenCount).toBeGreaterThan(0);
      expect(history[0].timestamp).toBeGreaterThan(0);
      expect(history[1]).toBe(turns[2]);
      expect(history[2]).toBe(turns[3]);
    });

    it("replaces all turns with summary when only one turn exists", () => {
      const t = makeTurn({ content: "only" });
      manager.addTurn(t);

      manager.replaceOldestWithSummary("summary");

      const history = manager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe("system");
      expect(history[0].content).toBe("summary");
    });
  });

  describe("toMessages", () => {
    it("returns empty array for empty history", () => {
      expect(manager.toMessages()).toEqual([]);
    });

    it("converts ConversationTurn to Message", () => {
      manager.addTurn(makeTurn({ role: "user", content: "Hello" }));
      manager.addTurn(makeTurn({ role: "assistant", content: "Hi" }));
      manager.addTurn(makeTurn({ role: "tool", content: "result" }));

      const messages = manager.toMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello");
      expect(messages[1].role).toBe("assistant");
      expect(messages[1].content).toBe("Hi");
      expect(messages[2].role).toBe("tool");
      expect(messages[2].content).toBe("result");
    });

    it("omits timestamp and tokenCount from messages", () => {
      manager.addTurn(makeTurn({ role: "user", content: "test", timestamp: 999, tokenCount: 42 }));

      const messages = manager.toMessages();
      expect(messages[0]).toEqual({ role: "user", content: "test" });
    });
  });
});