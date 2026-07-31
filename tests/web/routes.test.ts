import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";

let server: http.Server;
const PORT = 3098;

beforeAll(async () => {
  const { startServer } = await import("../../web/server.js");
  server = await startServer(PORT);
});

afterAll(() => {
  server?.close();
});

describe("Config API", () => {
  it("GET /api/config returns current provider and model", async () => {
    const res = await fetch(`http://localhost:${PORT}/api/config`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("provider");
    expect(data).toHaveProperty("model");
  });

  it("POST /api/config updates provider and model", async () => {
    const res = await fetch(`http://localhost:${PORT}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", model: "gpt-4o" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.provider).toBe("openai");
    expect(data.model).toBe("gpt-4o");
  });

  it("POST /api/config rejects invalid provider", async () => {
    const res = await fetch(`http://localhost:${PORT}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "invalid" }),
    });
    expect(res.status).toBe(400);
  });
});