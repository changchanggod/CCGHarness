import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { createAgentLoop } from "../src/cli/commands.js";
import type { ApprovalRequest, ApprovalDecision } from "../src/governance/approval-fsm.js";
import type { AgentLoop } from "../src/core/loop.js";

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
    const hitlResolves: Array<(decision: ApprovalDecision) => void> = [];
    let loop: AgentLoop | null = null;

    ws.on("close", () => {
      for (const resolve of hitlResolves.splice(0)) {
        resolve("deny");
      }
    });

    const callbacks = {
      onToolStart: (toolName: string, params: Record<string, unknown>) => {
        send(ws, { type: "tool_start", payload: { toolName, params } });
      },
      onToolResult: (toolName: string, success: boolean, output: string) => {
        send(ws, { type: "tool_result", payload: { toolName, success, output: (output ?? "").substring(0, 1000) } });
      },
      onApprovalRequired: async (request: ApprovalRequest): Promise<ApprovalDecision> => {
        send(ws, { type: "hitl_request", payload: { action: request.actionDescription, risk: request.riskLevel } });
        return new Promise((resolve) => {
          hitlResolves.push(resolve);
        });
      },
    };

    async function ensureLoop(): Promise<AgentLoop> {
      if (!loop) {
        loop = await createAgentLoop("ccg.yaml", false, undefined, undefined, callbacks);
      }
      return loop;
    }

    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: "error", payload: { message: "Invalid JSON" } });
        return;
      }

      if (msg.type === "hitl_response") {
        const resolve = hitlResolves.shift();
        if (resolve) {
          const decision = (msg.payload?.decision as ApprovalDecision) ?? "deny";
          resolve(decision);
        }
        return;
      }

      if (msg.type === "new_session") {
        if (loop) {
          loop.clearContext();
        }
        loop = null;
        send(ws, { type: "done", payload: { result: "New session started." } });
        return;
      }

      if (msg.type === "task") {
        const task = msg.payload?.task as string;
        if (!task) {
          send(ws, { type: "error", payload: { message: "Task is required" } });
          return;
        }

        try {
          const currentLoop = await ensureLoop();
          const result = await currentLoop.run(task);
          send(ws, { type: "done", payload: { result } });
        } catch (e) {
          send(ws, { type: "error", payload: { message: (e as Error).message } });
        }
      } else {
        send(ws, { type: "error", payload: { message: `Unknown message type: ${msg.type}` } });
      }
    });
  });
}