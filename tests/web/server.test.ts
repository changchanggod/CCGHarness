import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";

let server: http.Server;
const PORT = 3099;

beforeAll(async () => {
  const { startServer } = await import("../../web/server.js");
  server = await startServer(PORT);
});

afterAll(() => {
  server?.close();
});

describe("Web Server", () => {
  it("serves index.html on GET /", async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<!DOCTYPE html>");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await fetch(`http://localhost:${PORT}/nonexistent`);
    expect(res.status).toBe(404);
  });
});