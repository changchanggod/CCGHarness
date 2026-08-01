# CCG Web Console — Design Spec

**Date**: 2026-07-31
**Status**: Approved

## 1. 概述

为 CCGHarness 编码 Agent 内核构建极简 Web 前端。用户通过浏览器与 Agent 交互，替代当前 CLI 的操作方式。前端提供聊天框和配置面板，后端通过 Express + WebSocket 连接现有 harness 核心。

## 2. 目标

- 提供用户友好的 Web UI，替代 CLI 交互
- 支持实时展示 Agent 每轮的工具调用和结果
- 支持页面切换 LLM provider 和模型
- 保持现有 harness 核心代码零改动或最小改动
- CLI 功能完全保留，`ccg` 命令照常运行

## 3. 技术栈

- **后端**：Express（HTTP 服务）+ `ws`（WebSocket），TypeScript
- **前端**：原生 HTML + CSS + TypeScript 编译为 JS，无框架
- **通信**：REST 负责配置读写，WebSocket 负责任务执行
- **全栈 TypeScript**，沿用项目现有 tsconfig

## 4. 页面布局

```
┌──────────────────────────────────────────────┐
│  CCG Web Console                    [设置]  │
├──────────────────────┬───────────────────────┤
│                      │  配置面板              │
│   聊天区域            │  Provider: [下拉框]   │
│                      │  Model:    [输入框]   │
│   ┌────────────────┐ │                       │
│   │ 用户: 帮我...  │ │  ── 任务列表 ──       │
│   │               │ │  [任务1] [任务2] ...  │
│   │ Agent: 🔧 正在 │ │                       │
│   │ 执行 read_file│ │                       │
│   │ ...           │ │                       │
│   │ Agent: 任务完成│ │                       │
│   └────────────────┘ │                       │
├──────────────────────┴───────────────────────┤
│  [输入框________________________] [发送]     │
└──────────────────────────────────────────────┘
```

## 5. 后端架构

### 5.1 新增目录：`src/web/`

| 文件 | 职责 |
|------|------|
| `server.ts` | Express 服务启动，挂载 WebSocket，静态文件托管 |
| `routes.ts` | REST 端点：`GET /api/config`、`POST /api/config` |
| `ws-handler.ts` | WebSocket 连接管理，接收任务，调用 harness，推送每轮状态 |

### 5.2 REST API

```
GET  /api/config       → 返回当前 ccg.yaml 内容（llm.provider, llm.model）
POST /api/config       → 更新 ccg.yaml 的 llm.provider 和 llm.model
```

### 5.3 WebSocket 消息协议

**客户端 → 服务端：**
```typescript
{ type: "task", payload: { task: string } }
{ type: "hitl_response", payload: { decision: "approve" | "deny" | "approve_all" } }
```

**服务端 → 客户端：**
```typescript
{ type: "round", payload: { round: number } }
{ type: "tool_start", payload: { toolName: string, params: Record<string, unknown> } }
{ type: "tool_result", payload: { toolName: string, success: boolean, output: string } }
{ type: "hitl_request", payload: { action: string, risk: string } }
{ type: "done", payload: { result: string, rounds: number } }
{ type: "error", payload: { message: string } }
```

### 5.4 与 Harness 核心的衔接

- **复用 `runTask()`**：现有 `runTask(task, configPath, verbose, injectProvider, sharedRl)` 已经支持依赖注入
- **HITL 审批**：原有 `createHITLHandler` 通过 `sharedRl`（readline.Interface）接收用户输入。Web 场景改为通过 WebSocket：`ws-handler.ts` 在构建 GuardOrchestrator 时注入自定义的 `onApprovalRequired` 回调，该回调通过 WebSocket 推送审批请求到前端，等待前端返回决策后 resolve
- **Agent Loop 每轮状态**：`ws-handler.ts` 在调用 `runTask()` 时注入自定义 provider，在 provider 的 `chat()` 方法返回后、loop 执行工具前后，通过 WebSocket 推送状态消息

### 5.5 需要改动的现有文件

| 文件 | 改动 | 影响 |
|------|------|------|
| `src/cli/commands.ts` | `runTask` 新增可选参数 `onToolStart`、`onToolResult` 回调，用于推送工具执行状态 | 向后兼容，新增参数可选 |
| `package.json` | 新增依赖 `express`、`ws`；新增脚本 `"start:web"` | 无破坏性影响 |

### 5.6 不需要改动的文件

- `src/core/` — loop、types、parser 全部不变
- `src/providers/` — 全部不变
- `src/governance/` — 全部不变
- `src/tools/` — 全部不变
- `src/memory/` — 全部不变
- `src/config/` — 全部不变
- `src/cli/index.ts`、`src/cli/setup.ts`、`src/cli/setup-wizard.ts` — CLI 完全保留

## 6. 前端架构

### 6.1 新增目录：`public/`

| 文件 | 职责 |
|------|------|
| `index.html` | 单页 HTML，三段式布局 |
| `app.ts` | 主逻辑：WebSocket 连接管理、消息渲染、表单处理 |
| `style.css` | 极简样式（不超过 200 行） |

### 6.2 前端组件逻辑

- **聊天区域**：渲染用户消息和 Agent 状态消息（工具调用、结果、最终响应），自动滚动到底部
- **配置面板**：默认收起，点击"设置"展开。Provider 下拉框（openai/anthropic/deepseek/ollama），Model 输入框，保存按钮调用 `POST /api/config`
- **输入框**：Enter 发送，Shift+Enter 换行
- **HITL 审批弹窗**：当收到 `hitl_request` 消息时，弹出模态框显示操作描述和风险等级，三个按钮：批准 / 拒绝 / 全部批准

### 6.3 前端 TypeScript 编译

前端 `app.ts` 使用 `tsconfig.web.json` 单独编译，输出到 `public/app.js`。编译命令：`tsc -p tsconfig.web.json`。

## 7. 构建和运行

```bash
# 安装依赖
npm install

# 编译 TypeScript（含前端）
npm run build

# 启动 Web 服务（默认 http://localhost:3000）
npm run start:web
```

## 8. 错误处理

- 后端启动失败：打印错误信息到控制台，退出进程
- WebSocket 连接断开：前端显示"连接断开"提示，自动重连
- 任务执行失败：WebSocket 推送 `{ type: "error" }` 消息，前端显示红色错误提示
- 配置保存失败：前端显示错误提示，不关闭配置面板

## 9. 边界和限制

- 单用户单会话，不支持多用户并发
- 不保存历史记录（刷新页面后聊天记录丢失）
- 不提供文件浏览功能
- 不提供 guardrail 规则编辑
- 不提供 credential 管理（仍使用 `ccg setup` CLI 配置）
- 前端无构建工具链，仅用 tsc 编译 `app.ts`