import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { storeApiKey, getApiKey } from "../src/cli/setup.js";

const VALID_PROVIDERS = ["openai", "anthropic", "deepseek", "ollama"];

function getConfigPath(): string {
  return path.resolve(process.cwd(), "ccg.yaml");
}

function readConfig(): { provider: string; model: string } {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { provider: "deepseek", model: "deepseek-chat" };
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown> | undefined;
  const llm = (parsed?.llm as Record<string, unknown>) ?? {};
  return {
    provider: (llm.provider as string) ?? "deepseek",
    model: (llm.model as string) ?? "deepseek-chat",
  };
}

function writeConfig(provider: string, model: string): void {
  const configPath = getConfigPath();
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    existing = (yaml.load(raw) as Record<string, unknown>) ?? {};
  }
  const llm = (existing.llm as Record<string, unknown>) ?? {};
  llm.provider = provider;
  llm.model = model;
  existing.llm = llm;
  fs.writeFileSync(configPath, yaml.dump(existing), "utf-8");
}

export function createConfigRouter(): Router {
  const router = Router();

  router.get("/api/config", (_req, res) => {
    res.json(readConfig());
  });

  router.post("/api/config", (req, res) => {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "Request body must be JSON" });
      return;
    }
    const { provider, model } = req.body as Record<string, unknown>;
    if (typeof provider !== "string" || !VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` });
      return;
    }
    if (typeof model !== "string" || !model.trim()) {
      res.status(400).json({ error: "Model is required" });
      return;
    }
    writeConfig(provider, model);
    res.json({ provider, model });
  });

  router.get("/api/credentials/:provider", async (req, res) => {
    const { provider } = req.params;
    if (!VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }
    const key = await getApiKey(provider);
    res.json({ provider, hasKey: key !== null });
  });

  router.post("/api/credentials", async (req, res) => {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "Request body must be JSON" });
      return;
    }
    const { provider, apiKey } = req.body as Record<string, unknown>;
    if (typeof provider !== "string" || !VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` });
      return;
    }
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      res.status(400).json({ error: "API key is required" });
      return;
    }
    await storeApiKey(provider, apiKey);
    res.json({ provider, hasKey: true });
  });

  return router;
}