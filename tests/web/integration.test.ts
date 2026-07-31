import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import WebSocket from "ws";

let server: http.Server;
const PORT = 3096;

beforeAll(async () => {
  const { startServer } = await import("../../web/server.js");
  server = await startServer(PORT);
});

afterAll(() => {
  server?.close();
});

describe("Web Console Integration", () => {
  it("serves HTML and CSS", async () => {
    const htmlRes = await fetch(`http://localhost:${PORT}/`);
    expect(htmlRes.status).toBe(200);
    expect(await htmlRes.text()).toContain("CCG Web Console");

    const cssRes = await fetch(`http://localhost:${PORT}/style.css`);
    expect(cssRes.status).toBe(200);
  });

  it("serves app.js", async () => {
    const res = await fetch(`http://localhost:${PORT}/app.js`);
    expect(res.status).toBe(200);
  });

  it("config API works end-to-end", async () => {
    const postRes = await fetch(`http://localhost:${PORT}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "deepseek", model: "deepseek-chat" }),
    });
    expect(postRes.status).toBe(200);

    const getRes = await fetch(`http://localhost:${PORT}/api/config`);
    const data = await getRes.json();
    expect(data.provider).toBe("deepseek");
    expect(data.model).toBe("deepseek-chat");
  });

  it("WebSocket accepts connections", async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 5000);
    });
    await new Promise<void>((resolve) => {
      ws.on("close", () => resolve());
      ws.close();
    });
  });
});