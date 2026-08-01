"use strict";
const chat = document.getElementById("chat");
const taskInput = document.getElementById("taskInput");
const sendBtn = document.getElementById("sendBtn");
const togglePanel = document.getElementById("togglePanel");
const panel = document.getElementById("panel");
const providerSel = document.getElementById("provider");
const modelInput = document.getElementById("model");
const apiKeyInput = document.getElementById("apiKey");
const saveConfigBtn = document.getElementById("saveConfig");
const hitlModal = document.getElementById("hitlModal");
const hitlAction = document.getElementById("hitlAction");
const hitlRisk = document.getElementById("hitlRisk");
let ws = null;
let running = false;
function connect() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${location.host}/ws`);
    ws.onopen = () => {
        loadConfig();
    };
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
function appendMsg(text, cls) {
    const div = document.createElement("div");
    div.className = `msg ${cls}`;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}
function sendTask() {
    const task = taskInput.value.trim();
    if (!task || !ws || running)
        return;
    running = true;
    sendBtn.disabled = true;
    appendMsg(`You: ${task}`, "user");
    ws.send(JSON.stringify({ type: "task", payload: { task } }));
    taskInput.value = "";
}
function showHITL(action, risk) {
    hitlAction.textContent = `Action: ${action}`;
    hitlRisk.textContent = `Risk: ${risk}`;
    hitlModal.classList.add("open");
}
function hideHITL() {
    hitlModal.classList.remove("open");
}
function respondHITL(decision) {
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
document.getElementById("newSessionBtn").addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "new_session" }));
        chat.innerHTML = "";
        appendMsg("New session started.", "tool");
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
        }
        else {
            const err = await res.json();
            appendMsg(`Config error: ${err.error}`, "error");
            return;
        }
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            const keyRes = await fetch("/api/credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: providerSel.value, apiKey }),
            });
            if (keyRes.ok) {
                apiKeyInput.value = "";
                appendMsg("API key saved.", "tool");
            }
            else {
                const err = await keyRes.json();
                appendMsg(`Key error: ${err.error}`, "error");
            }
        }
    }
    catch (e) {
        appendMsg(`Config save failed: ${e.message}`, "error");
    }
});
document.getElementById("hitlApprove").addEventListener("click", () => respondHITL("approve"));
document.getElementById("hitlDeny").addEventListener("click", () => respondHITL("deny"));
document.getElementById("hitlApproveAll").addEventListener("click", () => respondHITL("approve_all"));
// Load current config on startup and after reconnect
async function loadConfig() {
    try {
        const res = await fetch("/api/config");
        if (res.ok) {
            const data = await res.json();
            providerSel.value = data.provider;
            modelInput.value = data.model;
        }
        const keyRes = await fetch(`/api/credentials/${providerSel.value}`);
        if (keyRes.ok) {
            const keyData = await keyRes.json();
            if (keyData.hasKey) {
                apiKeyInput.placeholder = "(已保存)";
            }
        }
    }
    catch { }
}
loadConfig();
connect();
