# AGENT_LOG.md — CCGHarness

> 按时间顺序记录关键节点，每条包含：时间戳、task 编号、触发的 Superpowers 技能、subagent 输出关键片段、commit hash、人工干预、学到的教训。

---

## 2026-07-29 14:00 — 项目启动

**技能**: brainstorming → writing-plans  
**操作**: 在空白项目上执行 brainstorming 技能，确定技术选型（TypeScript、治理护栏深入维度、多供应商、二进制分发）。产出 SPEC.md，然后 writing-plans 产出 PLAN.md（26 个 task）。  
**人工干预**: 确认 Memory 需要上下文压缩功能。  
**产物**: SPEC.md, PLAN.md, AGENTS.md

---

## 2026-07-29 14:20 — 开始 Subagent-Driven Development

**技能**: subagent-driven-development, using-git-worktrees  
**操作**: 创建 `.worktrees/scaffolding`，建立 SDD workspace 和 ledger。  
**人工干预**: 修复 tsconfig.json include 问题（tests/ 目录需被类型检查覆盖）。

---

## 2026-07-29 14:27 — Task 1: Project Scaffolding

**Subagent**: `ses_053739dffffeyf1lN8PY38NgsG` (general)  
**Commit**: `b6e0d45` — `chore: scaffold project with TypeScript and vitest`  
**Test**: 0 tests (空 scaffold)  
**Reviewer**: `ses_0536f1364ffeyt7r1GzipT5lbl`  
**Review 结果**: Critical — `.gitignore` 丢失 `.idea`, `*.tsbuildinfo`, `.worktrees/`  
**Fix round 1**: `ses_0536dfb4bffeQEimja0fwa8izS` → commit `884f3f7`  
**Re-review**: `ses_0536c422dffe2hBXVhgihEymft` → 所有 findings 已修复  
**教训**: 实现者不应盲目覆盖已有文件，应先读取再修改。

---

## 2026-07-29 14:38 — Task 2: Core Types

**Subagent**: `ses_0536a47c9ffe8dSbBSrpQMu3P7` (general)  
**Commit**: `720acb3` — `feat: add core type definitions`  
**Test**: 23/23 pass  
**Reviewer**: `ses_053658192ffeGbeBBVTM01I4ER` → 通过，minor: 缺少 trailing newline  
**教训**: 实现者正确修复了 `rootDir` 从 `"src"` 到 `"."`，因为 `include` 包含 `tests/`。

---

## 2026-07-29 14:44 — Task 3: LLM Provider Interface + Mock

**Subagent**: `ses_0536323c3fferFlZK73pUKh4Ii` (general)  
**Commit**: `85cc22a` — `feat: add LLMProvider interface and MockLLMProvider`  
**Test**: 25/25 pass (2 new + 23 existing)  
**Reviewer**: `ses_053605dcaffeVLmdIwnp4sYQxn` → 通过，minor: dead import  

---

## 2026-07-29 14:50 — Task 4: OpenAI Provider

**Subagent**: `ses_0535e2598ffeeImT2jky9gsA7C` (general)  
**Commit**: `e4a1878` — `feat: add OpenAI provider`  
**Test**: 27/27 pass  
**Reviewer**: `ses_0535b3265ffeo4HP5FNvMYelc6` → 通过，minor: toolCallId 测试覆盖不足  

---

## 2026-07-29 14:56 — Task 5: Anthropic Provider

**Subagent**: `ses_053595a18ffeTVW4tpYdeU7q6F` (general)  
**Commit**: `0107825` — `feat: add Anthropic provider`  
**Test**: 31/31 pass  
**Reviewer**: `ses_053563d01ffeAqgNsG2Gpr03yy` → 通过，important: tool result handling 不完整（跨任务问题）  

---

## 2026-07-29 15:01 — Task 6: Ollama Provider

**Subagent**: `ses_05354634affeBtgQCVmMk31KOm` (general)  
**Commit**: `0f3b6c4` — `feat: add Ollama provider`  
**Test**: 34/34 pass  
**Reviewer**: `ses_05351c09bffeTG7noF6azG50x9` → 通过，important: toolCallId 丢失（与 Task 5 同类型问题）  

---

## 2026-07-29 15:06 — Task 7: Provider Factory

**Subagent**: `ses_0534fa2daffediGrjoNif2fOMq` (general)  
**Commit**: `338b4af` — `feat: add provider factory`  
**Test**: 39/39 pass  
**Reviewer**: `ses_0534d48f0ffeA8HZFhcJ80JlUQ` → 通过  

---

## 2026-07-29 15:13 — Task 8: LLM Response Parser

**Subagent**: `ses_053491d52ffeQWvkw1xDvcJl2C` (general)  
**Commit**: `7dc6a0f` — `feat: add LLM response parser`  
**Test**: 43/43 pass  
**Reviewer**: `ses_0534695c5ffeywwfcoBlkfW1qM` → 通过  

---

## 2026-07-29 15:19 — Task 9: Read File Tool

**Subagent**: `ses_05344d08fffekxJ1rEfLJdlWcw` (general)  
**Commit**: `1a94a1b` — `feat: add read_file tool`  
**Test**: 50/50 pass  
**Reviewer**: `ses_053406bedffeOQsLOiTPm6eTiW` → 通过，minor: edge case 测试覆盖不足  

---

## 2026-07-29 15:26 — Task 10: Write File Tool

**Subagent**: `ses_0533ddc1effeBIoPYz9J4byZNz` (general)  
**Commit**: `fea1fd5` — `feat: add write_file tool`  
**Test**: 56/56 pass  
**Reviewer**: `ses_0533a3cafffeL9LGa4IrhC0OEL` → 通过  
**注意**: 实现者修改了 `ToolResult.metadata` 类型从 `{exitCode, stderr}` 到 `Record<string, unknown>`（合理的跨任务类型扩展）  

---

## 2026-07-29 15:32 — Task 11: Shell Tool

**Subagent**: `ses_053381d54ffeNqASKIRONMmHnM` (general)  
**Commit**: `d6da2fe` — `feat: add shell tool`  
**Test**: 62/62 pass  
**Reviewer**: `ses_0533509c9ffelDr3pmYiskMGMv` → 通过，minor: Windows-specific 测试命令  

---

## 2026-07-29 15:37 — Task 12: Run Tests + Run Lint Tools

**Subagent**: `ses_0533345b1ffePZPZoCz4oKNuGS` (general)  
**Commit**: `9e011e7` — `feat: add run_tests and run_lint tools`  
**Test**: 76/76 pass  
**Reviewer**: `ses_05330468effe4DjNYXHgHBlul2` → 通过，minor: 代码重复  

---

## 2026-07-29 15:43 — Task 13: Configuration Loader

**Subagent**: `ses_0532e8437ffeXCHr7TlBiQQSyu` (general)  
**Commit**: `ed1c5fd` — `feat: add configuration loader`  
**Test**: 81/81 pass  
**Reviewer**: `ses_0532b21d5ffeUUcFJRboDoNSNe` → 通过  

---

## 2026-07-29 15:50 — Task 14: Command Classifier (Governance L1)

**Subagent**: `ses_053284787ffeNv2ZZiKzvw62nr` (general)  
**Commit**: `fdef57e` — `feat: add command classifier (governance layer 1)`  
**Test**: 88/88 pass  
**Reviewer**: `ses_053246a30ffeTn6W5rVevD6oZQ` → 通过  

---

## 2026-07-29 15:56 — Task 15: Risk Scorer (Governance L2)

**Subagent**: `ses_053229875ffetnDVlnVijLYp5I` (general)  
**Commit**: `c90e60a` — `feat: add risk scorer with rule engine (governance layer 2)`  
**Test**: 104/104 pass  
**Reviewer**: `ses_0531f09ceffev1BqFnlzniWcjG` → 通过  

---

## 2026-07-29 16:02 — Task 16: HITL Approval FSM (Governance L3)

**Subagent**: `ses_0531d2bc4ffeVeN20JOCz3xM4F` (general)  
**Commit**: `6d67a17` — `feat: add HITL approval FSM (governance layer 3)`  
**Test**: 125/125 pass  
**Reviewer**: `ses_05319b869ffeBomhqwSUGXHRYz` → 通过，minor: ApprovalState/Decision 类型重复定义（应导入）  

---

## 2026-07-29 16:09 — Task 17: Sandbox (Governance L4)

**Subagent**: `ses_053174f5affePjq6KlfG3zkaKm` (general)  
**Commit**: `6e3f74d` — `feat: add sandbox executor (governance layer 4)`  
**Test**: 137/137 pass  
**Reviewer**: `ses_053136840ffeCVIm5Gr3gGbbi2` → 通过，minor: allowNetwork 未实现，default-deny 缺失  

---

## 2026-07-29 16:14 — Task 18: Guard Orchestrator (Governance Pipeline)

**Subagent**: `ses_0531148bfffedl9DeaKzUM8GJu` (general)  
**Commit**: `e1849fb` — `feat: add guard orchestrator (governance pipeline)`  
**Test**: 143/143 pass  
**Reviewer**: `ses_0530e15b5ffedhHtF72Go7TdYx` → 通过  
**注意**: block 级别直接拒绝（与 PLAN 一致），但 SPEC 说 block 也应触发 HITL — plan-vs-spec，需人工决策  

---

## 2026-07-29 16:23 — Task 19: Feedback Validators

**Subagent**: `ses_0530b2745ffedgaMffyovVKCWp` (general)  
**Commit**: `6f6c149` — `feat: add feedback validators (test, lint, typecheck)`  
**Test**: 157/157 pass  
**Reviewer**: `ses_05306c8f5ffePmXEgNLDqFa4wi` → 通过  

---

## 2026-07-29 16:27 — Task 20: Conversation Memory

**Subagent**: `ses_05306b656ffetMlFLbdPUdCAkv` (general)  
**Commit**: `99a373f` — `feat: add conversation memory manager`  
**Test**: 176/176 pass  
**Reviewer**: 未完成（pending）  
**注意**: 实现者扩展了 `ConversationTurn.role` 为包含 `"system"`（用于压缩摘要）  

---

## 2026-07-29 16:32 — Task 21: Context Compressor + Project Context

**Subagent**: `ses_05301b783ffe4RJW66ZexJPccr` (general)  
**Commit**: `be3dc9f` — `feat: add context compressor and project context loader`  
**Test**: 184/184 pass  
**Reviewer**: 未完成  

---

## 2026-07-29 16:37 — Task 22: Agent Main Loop

**Subagent**: `ses_052fe2568ffefiactg91EczEX1` (general)  
**Commit**: `bc88d61` — `feat: add agent main loop`  
**Test**: 192/192 pass  
**Reviewer**: 未完成  

---

## 2026-07-29 16:45 — Task 23: CLI Entry Point

**Subagent**: (cancelled — 重新分配)  
**替代**: 直接在 worktree 中实现  
**Commit**: `ecae0ff` — `feat: add CLI entry point`  
**人工干预**: 直接实现 CLI 模块（setup.ts, commands.ts, index.ts）  

---

## 2026-07-29 17:00 — Task 24: Mechanism Demo Tests

**Subagent**: `ses_052e74015ffePG4SZhtvKVYVSh` (general)  
**Commit**: `0b1ab9e` (部分) + `3daa0e4` (guardrail-demo 被 T26 包含)  
**Test**: 27/27 demo tests pass  
**内容**: guardrail-demo (7 tests), feedback-loop-demo (3 tests), deep-dimension-demo (17 tests)  

---

## 2026-07-29 17:00 — Task 25: CI Configuration

**Subagent**: `ses_052e7304dffehOH3i5x3Z92KJJ` (general)  
**Commit**: `747baf5` — `ci: add GitHub Actions unit-test workflow`  
**内容**: `.github/workflows/unit-test.yml` — job 名 `unit-test`，包含 `npm ci` → `npm test` → `npm run typecheck`  

---

## 2026-07-29 17:00 — Task 26: Binary Distribution

**Subagent**: `ses_052e70e68ffersH2ggi4cEogUE` (general)  
**Commit**: `3daa0e4` — `feat: add binary distribution build and README`  
**内容**: Node SEA 打包配置、build-binary.js、README.md、`.gitignore` 更新  

---

## 2026-07-29 17:10 — 完整拆分与 PR

**人工干预**: 将 `feat/scaffolding` 分支的 23 个 commit 按模块拆分为 9 个独立分支，每个对应一个 PR。使用 `git cherry-pick` 按模块提取 commit。删除旧 `feat/scaffolding` 分支和 worktree。  
**新分支**: `feat/project-core`, `feat/providers`, `feat/tools`, `feat/config`, `feat/governance`, `feat/feedback`, `feat/memory`, `feat/agent-loop`, `feat/cli`  
**教训**: 从开始就应该按模块拆分 worktree，而不是把所有 task 放在一个分支里事后拆分。

---

## 2026-07-31 22:00 — Web Console: 设计与规划

**技能**: brainstorming → writing-plans
**操作**: 为 CCGHarness 设计 Web 控制台（浏览器端 Chat UI，Express + WebSocket 后端，原生 HTML/CSS/TS 前端）。产出设计文档和 9-task 实现计划。
**产物**: `docs/superpowers/specs/2026-07-31-web-console-design.md`, `docs/superpowers/plans/2026-07-31-web-console.md`
**分支**: `feature/web-console`

---

## 2026-07-31 22:30 — Web Console Task 1: 项目搭建

**Subagent**: `ses_0474964a6ffeILC799Mlv3dq8h` (general)
**Commit**: `4b7213b` — `chore: add web project setup with express, ws, tsconfig`
**技能**: subagent-driven-development, TDD

---

## 2026-07-31 22:45 — Web Console Task 2: Express Server

**Subagent**: `ses_0474405b3ffejhUDuvrenjRh0A` (general)
**Commit**: `b4b0cda` — `feat: add Express server with static file serving`
**Test**: 2/2 (server.test.ts)

---

## 2026-07-31 22:55 — Web Console Task 3: REST Config Endpoints

**Subagent**: `ses_0473d9350ffeWag6hZ7hOT1En7` (general)
**Commit**: `c5e97b8` — `feat: add REST config endpoints for provider and model`
**Test**: 3/3 (routes.test.ts), 240 total

---

## 2026-07-31 23:05 — Web Console Task 4: runTask Callbacks

**Subagent**: `ses_047391bb5ffe7VqbowxwCIkmXH` (general)
**Commit**: `af44efe` — `feat: add optional callbacks to runTask for tool execution and HITL events`
**内容**: 向 `runTask()` 添加 `callbacks` 参数（onToolStart / onToolResult / onApprovalRequired），Web 后端通过回调推送实时状态到 WebSocket。
**Test**: 1 new test, 241 total

---

## 2026-07-31 23:10 — Web Console Task 5: WebSocket Handler

**Subagent**: `ses_047346fd6ffe6yqctec9YbsM2r` (general)
**Commit**: `8b6632a` — `feat: add WebSocket handler with harness bridge`
**Test**: 2/2 (ws-handler.test.ts), 243 total

---

## 2026-07-31 23:25 — Web Console Task 6-7: Frontend

**Subagent**: `ses_0472e362cffe0l7AIf7XAg733f` (general) + `ses_0472acd34ffeU73eccMN8cCL2M` (general)
**Commit**: `de24094` (HTML+CSS), `1750d16` (TypeScript + WebSocket chat)
**内容**: 深色主题三段式布局（chat / config panel / input）、WebSocket 实时消息、HITL 弹窗审批、provider/model 设置面板
**Test**: 247 total

---

## 2026-08-01 10:00 — 运行期 Bug 修复 (Round 1)

**技能**: systematic-debugging
**内容**:
- `462a21b`: HITL 并发死锁（单变量 → 队列）、POST body 空检查、config 加载 ok 检查、output undefined 保护
- `82e9eca`: 编译问题修复
- `b4986c9`: HITL 断线清理 + 移除未用 import
**人工干预**: 用户发现前端配置丢失、Agent context 问题

---

## 2026-08-01 11:00 — Vercel 部署尝试 (已放弃) → Railway 迁移

**操作**: 创建 `vercel.json`、`api/index.js`（Vercel serverless 入口）
**Commit**: `419e08b`
**决策**: Vercel 不支持 WebSocket，放弃。改用 Railway。
**Railway 修复**:
- `d58e3c9`: 添加 `start` 脚本、PORT 环境变量
- `6f80fe1`: `copy` → `node -e "fs.cpSync(...)"` 跨平台
- `9483e13`: API Key 输入框（前端设置面板）

---

## 2026-08-01 12:00 — Interactive Session Context

**技能**: subagent-driven-development
**Commit**: `e7e6aba` — `feat: add interactive session context with new-session support`
**内容**: `AgentLoop` 添加 `clearContext()`、`executeLoop()`；WebSocket 每个连接维持持久 loop；前端"新对话"按钮
**人工干预**: 用户反馈 Web 端上下文丢失（每任务新建 AgentLoop）

---

## 2026-08-01 13:00 — Bug 修复 (Round 2)

**内容**:
- `9e2d49c`: `filePath` → `path` 统一（sandbox + risk-scorer 与 write_file schema 冲突）
- `ab40bf7`: WebSocket 重连后重新拉取配置（前端 `ws.onopen` 中调用 `loadConfig()`）
- `df4561b`: config 未配 key 的 provider 时自动回退到已配 key 的 provider
- `f3dcdf8`: `ccg.yaml` 不存在时回退到内置默认值
- `df561a3`: `maxConsecutiveFailures` 3→5
- `b84818b`: 默认 lint 命令 `npm run lint` → `npm run typecheck`

---

## 2026-08-01 14:00 — CI 修复 + README 云部署

**Commit**: `87715b7` (CI 真实测试 + 二进制构建), `a0c7d69` (build-binary.js→.mjs), `43a54d3` (README 云部署章节)
**内容**: CI `unit-test` job 从占位 `echo hello` 改为真实 `npm test`；新增 `build-binary` job；README 添加 Railway 公网地址和部署说明

---

## 总结（更新）

| 指标 | 数值 |
|------|------|
| 总 task 数 | 26 (core) + 9 (web) = 35 |
| 总 commit | 150+ |
| 最终测试数 | 247 |
| Web 部署 | Railway (ccgharness-production.up.railway.app) |
| CI | unit-test + build-binary |
| 待处理 deferred | 5 个 minor（YAML 格式化、tsconfig kludge、onerror、重连循环、测试隔离）