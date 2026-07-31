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
        const task = msg.payload?.task as string;
        if (!task) {
          send(ws, { type: "error", payload: { message: "Task is required" } });
          return;
        }

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
      } else {
        send(ws, { type: "error", payload: { message: `Unknown message type: ${msg.type}` } });
      }
    });
  });
}