import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { storeApiKey, getApiKey, removeApiKey, checkApiKey } from "../../src/cli/setup.js";

const testDir = path.join(os.tmpdir(), `ccg-setup-test-${Date.now()}`);
const credsPath = path.join(testDir, "credentials.json");

function setEnv(key: string, value: string) {
  process.env[key] = value;
}

function deleteEnv(key: string) {
  delete process.env[key];
}

describe("setup - credential management", () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    setEnv("CCG_CREDS_DIR", testDir);
    setEnv("CCG_CREDS_FILE", credsPath);
  });

  afterEach(() => {
    deleteEnv("CCG_CREDS_DIR");
    deleteEnv("CCG_CREDS_FILE");
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("storeApiKey", () => {
    it("stores a key and makes it retrievable", async () => {
      await storeApiKey("openai", "sk-test-key-123");
      const key = await getApiKey("openai");
      expect(key).toBe("sk-test-key-123");
    });

    it("overwrites an existing key for the same provider", async () => {
      await storeApiKey("openai", "sk-old-key");
      await storeApiKey("openai", "sk-new-key");
      const key = await getApiKey("openai");
      expect(key).toBe("sk-new-key");
    });

    it("stores keys for multiple providers independently", async () => {
      await storeApiKey("openai", "sk-openai-key");
      await storeApiKey("anthropic", "sk-anthropic-key");
      expect(await getApiKey("openai")).toBe("sk-openai-key");
      expect(await getApiKey("anthropic")).toBe("sk-anthropic-key");
    });
  });

  describe("getApiKey", () => {
    it("returns null for a provider with no stored key", async () => {
      const key = await getApiKey("nonexistent");
      expect(key).toBeNull();
    });

    it("returns null when credentials file does not exist", async () => {
      if (fs.existsSync(credsPath)) fs.unlinkSync(credsPath);
      const key = await getApiKey("openai");
      expect(key).toBeNull();
    });
  });

  describe("removeApiKey", () => {
    it("removes a stored key", async () => {
      await storeApiKey("openai", "sk-test-key");
      await removeApiKey("openai");
      const key = await getApiKey("openai");
      expect(key).toBeNull();
    });

    it("does not throw when removing a non-existent key", async () => {
      await expect(removeApiKey("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("checkApiKey", () => {
    it("returns true when key exists", async () => {
      await storeApiKey("openai", "sk-test-key");
      expect(await checkApiKey("openai")).toBe(true);
    });

    it("returns false when key does not exist", async () => {
      expect(await checkApiKey("openai")).toBe(false);
    });
  });
});