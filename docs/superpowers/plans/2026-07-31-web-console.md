# CCG Web Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal web console for CCGHarness with chat interface, provider/model switching, and real-time agent execution feedback via WebSocket.

**Architecture:** Express + WebSocket backend in `web/` directory, native HTML/CSS/TS frontend in `web/public/`, imports harness core from `src/` without modifying `src/` file structure.

**Tech Stack:** Express, ws, TypeScript (backend + frontend), native HTML/CSS

## Global Constraints

- Branch: `feature/web-console`
- All web code in `web/` directory, NOT in `src/`
- Frontend in `web/public/`, backend in `web/`
- Imports harness core from `src/` via relative paths
- No frontend framework — native HTML/CSS/TS
- CLI (`ccg` command) must continue to work unchanged
- `src/cli/commands.ts` minimal change: add optional callbacks to `runTask()` signature
- Node.js 18+, TypeScript 5.5+
- TDD: write tests before implementation
- After each task: commit

---

### Task 1: Project Setup — Dependencies, Directory, tsconfig

**Files:**
- Modify: `package.json`
- Create: `web/tsconfig.json`

**Interfaces:**
- Produces: `web/tsconfig.json` with outDir pointing to `web/dist/`, `npm run start:web` script

- [ ] **Step 1: Add express and ws dependencies**

```bash
npm install express ws
npm install -D @types/express @types/ws
```

- [ ] **Step 2: Create web/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist-web",
    "rootDir": ".."
  },
  "include": ["../web", "../src"]
}
```

- [ ] **Step 3: Add scripts to package.json**

```json
"start:web": "tsc -p web/tsconfig.json && node dist-web/web/server.js",
"build:web": "tsc -p web/tsconfig.json"
```

- [ ] **Step 4: Add web/dist-web/ to .gitignore**

```
dist-web/
```

- [ ] **Step 5: Verify**

```bash
npm install
npx tsc -p web/tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json web/tsconfig.json .gitignore
git commit -m "chore: add web project setup with express, ws, tsconfig"
```

---

### Task 2: Minimal Express Server + Static File Serving

**Files:**
- Create: `web/server.ts`
- Create: `web/public/index.html` (placeholder)
- Test: `tests/web/server.test.ts`

**Interfaces:**
- Produces: `startServer(port: number): Promise<Server>` — starts Express on given port, serves `web/public/` as static files

- [ ] **Step 1: Write failing test**

```typescript
// tests/web/server.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/web/server.test.ts
```

Expected: FAIL (module not found or server not started)

- [ ] **Step 3: Create web/public/index.html (placeholder)**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CCG Web Console</title>
</head>
<body>
  <h1>CCG Web Console</h1>
</body>
</html>
```

- [ ] **Step 4: Create web/server.ts**

```typescript
import express from "express";
import path from "node:path";
import type { Server } from "node:http";

export function startServer(port: number): Promise<Server> {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());

    const publicDir = path.resolve(__dirname, "public");
    app.use(express.static(publicDir));

    const server = app.listen(port, () => {
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer(3000).then(() => {
    console.log("CCG Web Console running at http://localhost:3000");
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/web/server.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/server.ts web/public/index.html tests/web/server.test.ts
git commit -m "feat: add Express server with static file serving"
```

---

### Task 3: REST Config Endpoints

**Files:**
- Create: `web/routes.ts`
- Modify: `web/server.ts`
- Test: `tests/web/routes.test.ts`

**Interfaces:**
- Consumes: `startServer` from Task 2
- Produces: `GET /api/config` returns `{ provider, model }`, `POST /api/config` accepts `{ provider, model }` and writes to `ccg.yaml`

- [ ] **Step 1: Write failing test**

```typescript
// tests/web/routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import fs from "node:fs";

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/web/routes.test.ts
```

Expected: FAIL (404 or no route)

- [ ] **Step 3: Create web/routes.ts**

```typescript
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

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

  return router;
}
```

- [ ] **Step 4: Update web/server.ts to mount config router**

Add after `app.use(express.json());`:
```typescript
import { createConfigRouter } from "./routes.js";
app.use(createConfigRouter());
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/web/routes.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/routes.ts web/server.ts tests/web/routes.test.ts
git commit -m "feat: add REST config endpoints for provider and model"
```

---

### Task 4: Add Callbacks to runTask()

**Files:**
- Modify: `src/cli/commands.ts`
- Test: `tests/web/commands-callbacks.test.ts`

**Interfaces:**
- Produces: `runTask()` now accepts optional `callbacks?: { onToolStart?, onToolResult?, onApprovalRequired? }` parameter

- [ ] **Step 1: Write failing test**

```typescript
// tests/web/commands-callbacks.test.ts
import { describe, it, expect, vi } from "vitest";
import { runTask } from "../../src/cli/commands.js";
import { MockLLMProvider } from "../../src/providers/mock.js";
import type { LLMResponse } from "../../src/core/types.js";

const mockResponse: LLMResponse = {
  actions: [{ type: "stop", summary: "done" }],
  rawUsage: { prompt: 0, completion: 0 },
};

describe("runTask callbacks", () => {
  it("calls onToolStart and onToolResult during execution", async () => {
    const onToolStart = vi.fn();
    const onToolResult = vi.fn();

    const mockProvider = new MockLLMProvider([
      {
        actions: [
          { type: "tool_call", toolName: "read_file", parameters: { path: "test.txt" }, toolCallId: "call_1" },
        ],
        rawUsage: { prompt: 0, completion: 0 },
      },
      mockResponse,
    ]);

    const result = await runTask(
      "test task",
      "ccg.yaml",
      false,
      mockProvider,
      undefined,
      { onToolStart, onToolResult },
    );

    expect(onToolStart).toHaveBeenCalledWith("read_file", { path: "test.txt" });
    expect(onToolResult).toHaveBeenCalled();
    expect(result).toBe("done");
  });
});
```

- [ ] **Step 2: Modify src/cli/commands.ts**

Add to imports:
```typescript
import type { ToolResult } from "../core/types.js";
```

Add to `runTask` signature after `sharedRl`:
```typescript
callbacks?: {
  onToolStart?: (toolName: string, params: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, success: boolean, output: string) => void;
  onApprovalRequired?: (request: ApprovalRequest) => Promise<ApprovalDecision>;
},
```

In the `createTools` call, wrap each tool after creation:
```typescript
const tools = createTools(config);
if (callbacks) {
  const wrapped = tools.map((tool) => ({
    ...tool,
    execute: async (params: Record<string, unknown>) => {
      callbacks.onToolStart?.(tool.name, params);
      const result = await tool.execute(params);
      callbacks.onToolResult?.(tool.name, result.success, result.output);
      return result;
    },
  }));
  // pass wrapped tools to the loop
}
```

In the GuardOrchestrator creation, use `callbacks?.onApprovalRequired` if provided:
```typescript
onApprovalRequired: callbacks?.onApprovalRequired ?? createHITLHandler(verbose, sharedRl),
```

- [ ] **Step 3: Run test to verify**

```bash
npx vitest run tests/web/commands-callbacks.test.ts
```

Expected: PASS

- [ ] **Step 4: Run all existing tests to ensure no regression**

```bash
npm test
```

Expected: all 235 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands.ts tests/web/commands-callbacks.test.ts
git commit -m "feat: add optional callbacks to runTask for tool execution and HITL events"
```

---

### Task 5: WebSocket Handler — Harness Bridge

**Files:**
- Create: `web/ws-handler.ts`
- Modify: `web/server.ts`
- Test: `tests/web/ws-handler.test.ts`

**Interfaces:**
- Consumes: `startServer` from Task 2, `runTask` callbacks from Task 4
- Produces: WebSocket endpoint at `/ws`, handles `task` and `hitl_response` messages, sends `tool_start`, `tool_result`, `hitl_request`, `done`, `error` messages

- [ ] **Step 1: Write failing test**

```typescript
// tests/web/ws-handler.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";

let wsUrl: string;
const PORT = 3097;

beforeAll(async () => {
  const { startServer } = await import("../../web/server.js");
  await startServer(PORT);
  wsUrl = `ws://localhost:${PORT}/ws`;
});

describe("WebSocket Handler", () => {
  it("connects and receives acknowledgment", async () => {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 5000);
    });
    ws.close();
  });

  it("receives error for invalid message", (done) => {
    const ws = new WebSocket(wsUrl);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "unknown" }));
    });
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe("error");
      ws.close();
      done();
    });
  });
});
```

- [ ] **Step 2: Create web/ws-handler.ts**

```typescript
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { runTask } from "../src/cli/commands.js";
import type { ApprovalRequest, ApprovalDecision } from "../src/governance/approval-fsm.js";

interface ClientMessage {
  type: string;
  payload?: Record<string, unknown>;
}

interface ServerMessage {
  type: string;
  payload?: Record<string, unknown>;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: "error", payload: { message: "Invalid JSON" } });
        return;
      }

      if (msg.type === "task") {
        const task = msg.payload?.task as string;
        if (!task) {
          send(ws, { type: "error", payload: { message: "Task is required" } });
          return;
        }

        let hitlResolve: ((decision: ApprovalDecision) => void) | null = null;

        try {
          const result = await runTask(
            task,
            "ccg.yaml",
            false,
            undefined,
            undefined,
            {
              onToolStart: (toolName, params) => {
                send(ws, { type: "tool_start", payload: { toolName, params } });
              },
              onToolResult: (toolName, success, output) => {
                send(ws, { type: "tool_result", payload: { toolName, success, output: output.substring(0, 1000) } });
              },
              onApprovalRequired: async (request: ApprovalRequest): Promise<ApprovalDecision> => {
                send(ws, { type: "hitl_request", payload: { action: request.actionDescription, risk: request.riskLevel } });
                return new Promise((resolve) => {
                  hitlResolve = resolve;
                });
              },
            },
          );
          send(ws, { type: "done", payload: { result } });
        } catch (e) {
          send(ws, { type: "error", payload: { message: (e as Error).message } });
        }
      } else if (msg.type === "hitl_response") {
        // HITL response handling is managed within the task closure above
      } else {
        send(ws, { type: "error", payload: { message: `Unknown message type: ${msg.type}` } });
      }
    });
  });
}
```

Wait, the HITL response handling is tricky. The `hitlResolve` closure needs to be captured. Let me restructure:

```typescript
let hitlResolve: ((decision: ApprovalDecision) => void) | null = null;

ws.on("message", async (raw) => {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    send(ws, { type: "error", payload: { message: "Invalid JSON" } });
    return;
  }

  if (msg.type === "hitl_response") {
    if (hitlResolve) {
      const decision = (msg.payload?.decision as ApprovalDecision) ?? "deny";
      hitlResolve(decision);
      hitlResolve = null;
    }
    return;
  }

  if (msg.type === "task") {
    // ... task handling as above
  }
});
```

- [ ] **Step 3: Update web/server.ts to attach WebSocket**

After `const server = app.listen(...)`:
```typescript
import { attachWebSocket } from "./ws-handler.js";
attachWebSocket(server);
```

- [ ] **Step 4: Run test to verify**

```bash
npx vitest run tests/web/ws-handler.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/ws-handler.ts web/server.ts tests/web/ws-handler.test.ts
git commit -m "feat: add WebSocket handler with harness bridge"
```

---

### Task 6: Frontend HTML + CSS

**Files:**
- Create: `web/public/style.css`
- Modify: `web/public/index.html`

**Interfaces:**
- Produces: Complete HTML layout with chat area, config panel, input box; CSS for styling

- [ ] **Step 1: Create web/public/style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1a2e; color: #eee; height: 100vh; display: flex; flex-direction: column; }
header { background: #16213e; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #0f3460; }
header h1 { font-size: 18px; color: #e94560; }
header button { background: #0f3460; color: #eee; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; }
header button:hover { background: #1a4a8a; }
main { display: flex; flex: 1; overflow: hidden; }
#chat { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
#chat .msg { max-width: 85%; padding: 10px 14px; border-radius: 8px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
#chat .msg.user { align-self: flex-end; background: #0f3460; }
#chat .msg.agent { align-self: flex-start; background: #16213e; }
#chat .msg.tool { align-self: flex-start; background: #1a1a2e; border: 1px solid #0f3460; font-size: 13px; color: #aaa; }
#chat .msg.error { align-self: flex-start; background: #3d0000; color: #ff6b6b; }
#panel { width: 0; overflow: hidden; background: #16213e; border-left: 1px solid #0f3460; transition: width 0.2s; }
#panel.open { width: 280px; padding: 16px; }
#panel label { display: block; font-size: 13px; color: #aaa; margin-bottom: 4px; margin-top: 12px; }
#panel select, #panel input { width: 100%; padding: 8px; background: #1a1a2e; color: #eee; border: 1px solid #0f3460; border-radius: 4px; }
#panel button { width: 100%; margin-top: 16px; padding: 8px; background: #e94560; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
footer { background: #16213e; padding: 12px 20px; border-top: 1px solid #0f3460; display: flex; gap: 8px; }
footer input { flex: 1; padding: 10px; background: #1a1a2e; color: #eee; border: 1px solid #0f3460; border-radius: 4px; }
footer button { padding: 10px 20px; background: #e94560; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
footer button:disabled { opacity: 0.5; cursor: not-allowed; }
.modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); justify-content: center; align-items: center; z-index: 100; }
.modal.open { display: flex; }
.modal-box { background: #16213e; padding: 24px; border-radius: 8px; max-width: 400px; width: 90%; }
.modal-box h3 { margin-bottom: 12px; }
.modal-box p { margin-bottom: 8px; font-size: 14px; color: #ccc; }
.modal-buttons { display: flex; gap: 8px; margin-top: 16px; }
.modal-buttons button { flex: 1; padding: 8px; border: none; border-radius: 4px; cursor: pointer; }
.modal-buttons .approve { background: #2ecc71; color: #fff; }
.modal-buttons .deny { background: #e74c3c; color: #fff; }
.modal-buttons .approve-all { background: #3498db; color: #fff; }
```

- [ ] **Step 2: Rewrite web/public/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CCG Web Console</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>CCG Web Console</h1>
    <button id="togglePanel">设置</button>
  </header>
  <main>
    <div id="chat"></div>
    <aside id="panel">
      <label for="provider">Provider</label>
      <select id="provider">
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="deepseek">DeepSeek</option>
        <option value="ollama">Ollama</option>
      </select>
      <label for="model">Model</label>
      <input id="model" type="text" placeholder="e.g. deepseek-chat">
      <button id="saveConfig">保存配置</button>
    </aside>
  </main>
  <footer>
    <input id="taskInput" type="text" placeholder="输入任务描述，Enter 发送...">
    <button id="sendBtn">发送</button>
  </footer>
  <div id="hitlModal" class="modal">
    <div class="modal-box">
      <h3>HITL 审批</h3>
      <p id="hitlAction"></p>
      <p id="hitlRisk"></p>
      <div class="modal-buttons">
        <button class="approve" id="hitlApprove">批准</button>
        <button class="deny" id="hitlDeny">拒绝</button>
        <button class="approve-all" id="hitlApproveAll">全部批准</button>
      </div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Verify appearance**

Start server: `npm run start:web`, open browser to `http://localhost:3000`, confirm layout renders correctly.

- [ ] **Step 4: Commit**

```bash
git add web/public/index.html web/public/style.css
git commit -m "feat: add web console HTML layout and CSS styling"
```

---

### Task 7: Frontend TypeScript — WebSocket + Chat

**Files:**
- Create: `web/public/app.ts`
- Create: `web/tsconfig.web.json` (for frontend-only compilation)

**Interfaces:**
- Consumes: HTML elements from Task 6, WebSocket endpoint from Task 5
- Produces: `web/public/app.js` — compiled frontend JavaScript

- [ ] **Step 1: Create web/tsconfig.web.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "public",
    "rootDir": "public"
  },
  "include": ["public/app.ts"]
}
```

- [ ] **Step 2: Create web/public/app.ts**

```typescript
const chat = document.getElementById("chat")!;
const taskInput = document.getElementById("taskInput") as HTMLInputElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const togglePanel = document.getElementById("togglePanel")!;
const panel = document.getElementById("panel")!;
const providerSel = document.getElementById("provider") as HTMLSelectElement;
const modelInput = document.getElementById("model") as HTMLInputElement;
const saveConfig = document.getElementById("saveConfig")!;
const hitlModal = document.getElementById("hitlModal")!;
const hitlAction = document.getElementById("hitlAction")!;
const hitlRisk = document.getElementById("hitlRisk")!;

let ws: WebSocket | null = null;
let hitlCallback: ((decision: string) => void) | null = null;
let running = false;

function connect(): void {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case "tool_start":
        appendMsg(`tool_start: ${msg.payload.toolName}`, "tool");
        break;
      case "tool_result":
        const icon = msg.payload.success ? "OK" : "FAIL";
        appendMsg(`tool_result: ${msg.payload.toolName} ${icon}`, "tool");
        break;
      case "hitl_request":
        showHITL(msg.payload.action, msg.payload.risk);
        break;
      case "done":
        appendMsg(`Agent: ${msg.payload.result}`, "agent");
        running = false;
        sendBtn.disabled = false;
        break;
      case "error":
        appendMsg(`Error: ${msg.payload.message}`, "error");
        running = false;
        sendBtn.disabled = false;
        break;
    }
  };

  ws.onclose = () => {
    if (running) {
      appendMsg("Connection lost.", "error");
      running = false;
      sendBtn.disabled = false;
    }
    setTimeout(connect, 3000);
  };
}

function appendMsg(text: string, cls: string): void {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function sendTask(): void {
  const task = taskInput.value.trim();
  if (!task || !ws || running) return;
  running = true;
  sendBtn.disabled = true;
  appendMsg(`You: ${task}`, "user");
  ws.send(JSON.stringify({ type: "task", payload: { task } }));
  taskInput.value = "";
}

function showHITL(action: string, risk: string): void {
  hitlAction.textContent = `Action: ${action}`;
  hitlRisk.textContent = `Risk: ${risk}`;
  hitlModal.classList.add("open");
}

function hideHITL(): void {
  hitlModal.classList.remove("open");
}

function respondHITL(decision: string): void {
  hideHITL();
  ws?.send(JSON.stringify({ type: "hitl_response", payload: { decision } }));
}

// Event listeners
sendBtn.addEventListener("click", sendTask);
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendTask();
  }
});

togglePanel.addEventListener("click", () => {
  panel.classList.toggle("open");
});

saveConfig.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerSel.value,
        model: modelInput.value,
      }),
    });
    if (res.ok) {
      appendMsg("Config saved.", "tool");
    } else {
      const err = await res.json();
      appendMsg(`Config error: ${err.error}`, "error");
    }
  } catch (e) {
    appendMsg(`Config save failed: ${(e as Error).message}`, "error");
  }
});

document.getElementById("hitlApprove")!.addEventListener("click", () => respondHITL("approve"));
document.getElementById("hitlDeny")!.addEventListener("click", () => respondHITL("deny"));
document.getElementById("hitlApproveAll")!.addEventListener("click", () => respondHITL("approve_all"));

// Load current config on startup
(async () => {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    providerSel.value = data.provider;
    modelInput.value = data.model;
  } catch {}
})();

connect();
```

- [ ] **Step 3: Add build:web script to package.json**

```json
"build:web": "tsc -p web/tsconfig.json && tsc -p web/tsconfig.web.json"
```

- [ ] **Step 4: Compile frontend**

```bash
npx tsc -p web/tsconfig.web.json
```

- [ ] **Step 5: Commit**

```bash
git add web/public/app.ts web/tsconfig.web.json web/public/app.js package.json
git commit -m "feat: add frontend TypeScript with WebSocket chat and config panel"
```

---

### Task 8: Integration Test

**Files:**
- Create: `tests/web/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// tests/web/integration.test.ts
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

  it("WebSocket accepts connections", (done) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    ws.on("open", () => {
      ws.close();
      done();
    });
    ws.on("error", done);
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
npx vitest run tests/web/integration.test.ts
```

Expected: PASS

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/web/integration.test.ts
git commit -m "test: add web console integration tests"
```

---

### Task 9: README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Web Console section to README**

Add after the interactive mode section:
```markdown
### Web Console

```bash
npm run start:web
```

Open `http://localhost:3000` in your browser. Features:
- Chat interface for task execution
- Real-time tool execution feedback
- Provider and model switching via settings panel
- HITL approval via modal dialog
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add web console usage to README"
```