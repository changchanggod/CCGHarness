import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import http from "node:http";

let server: http.Server;
let wsUrl: string;
const PORT = 3097;

beforeAll(async () => {
  const { startServer } = await import("../../web/server.js");
  server = await startServer(PORT);
  wsUrl = `ws://localhost:${PORT}/ws`;
});

afterAll(() => {
  server?.close();
});

describe("WebSocket Handler", () => {
  it("connects and receives acknowledgment", async () => {
    const ws = new WebSocket(wsUrl);
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

  it("receives error for invalid message", async () => {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "unknown" }));
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        expect(msg.type).toBe("error");
        ws.close();
      });
      ws.on("close", () => resolve());
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 5000);
    });
  });
});