const chat = document.getElementById("chat")!;
const taskInput = document.getElementById("taskInput") as HTMLInputElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const togglePanel = document.getElementById("togglePanel")!;
const panel = document.getElementById("panel")!;
const providerSel = document.getElementById("provider") as HTMLSelectElement;
const modelInput = document.getElementById("model") as HTMLInputElement;
const saveConfigBtn = document.getElementById("saveConfig")!;
const hitlModal = document.getElementById("hitlModal")!;
const hitlAction = document.getElementById("hitlAction")!;
const hitlRisk = document.getElementById("hitlRisk")!;

let ws: WebSocket | null = null;
let running = false;

function connect(): void {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case "tool_start":
        appendMsg(`${msg.payload.toolName}`, "tool");
        break;
      case "tool_result":
        const icon = msg.payload.success ? "OK" : "FAIL";
        appendMsg(`${msg.payload.toolName} ${icon}`, "tool");
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

saveConfigBtn.addEventListener("click", async () => {
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
    if (res.ok) {
      const data = await res.json();
      providerSel.value = data.provider;
      modelInput.value = data.model;
    }
  } catch {}
})();

connect();