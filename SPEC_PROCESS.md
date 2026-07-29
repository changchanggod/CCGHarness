# SPEC_PROCESS.md — CCGHarness

> 记录与 Superpowers 协作生成 spec 与 plan 的过程，包含 brainstorming 关键节点、冷启动验证结果、spec 修订。

---

## 一、Brainstorming 关键节点

### 1.1 技术选型：语言决策

**智能体追问**：在 6 个待选维度之前，先问"你倾向于用哪种语言？"

**我的决策**：TypeScript
**理由**：全栈统一、类型安全、LLM SDK 生态成熟、Node SEA 支持二进制打包。避免 Python 的动态类型在 harness 内核中引入运行时不确定性，也避免 Rust/Go 的学习曲线影响开发速度。

**反思**：智能体把语言选择放在第一位是对的——它决定了后续所有选型（分发方式、测试框架、LLM SDK）。如果在 brainstorm 阶段跳过这个问题，到了 PLAN 阶段会发现整个构建链需要重写。

---

### 1.2 深入维度：治理护栏

**智能体追问**：六个维度都要有最低实现，但必须选一个深入。你倾向哪个？

**我的决策**：Governance / 治理护栏
**理由**：治理维度天然由代码构成（分类器、拦截函数、状态机、沙箱），最适合"移除 LLM 还能单测"的标准。其他维度（如记忆、配置）容易变成"写好配置文件 + 调 LLM"，难以体现工程深度。

**智能体推荐**：也推荐了 Governance 作为首选，原因与我的判断一致——这是六个维度中"代码密度"最高的。

---

### 1.3 架构方案：三选一

**智能体提出三个方案**：
- 方案 A：最小内核 + 重治理层（推荐）
- 方案 B：均衡 Harness + 策略驱动治理
- 方案 C：事件驱动 + 拦截器链

**我的决策**：选择方案 A
**理由**：YAGNI。方案 C 的拦截器链虽然优雅，但在一个单人期末项目中过度工程化。方案 B 容易分散精力。方案 A 最聚焦——治理维度做得最深，其他维度满足"能运行"即可。

---

### 1.4 能力范围：进阶 coding agent

**智能体追问**：标准 / 进阶 / 最小化 MVP？

**我的决策**：进阶 coding agent（支持多步骤任务计划、子任务拆分、跨文件重构）
**理由**：太简单无法体现工程深度，太复杂（如多 agent 编排）超出单人项目范围。进阶 coding agent 是合理的中间点。

---

## 二、关键迭代（3 轮）

### 第 1 轮：Memory 上下文压缩

**智能体设计**：最初 Memory 只包含三层：会话历史、项目约定、文件摘要。

**我提出修正**：需要添加上下文压缩功能。

**处理决策**：采纳。当 token 估算超过 80% 上下文窗口时，将最早 50% 消息压缩为结构化摘要。压缩本身调用 LLM（可 mock），属于可测试的机制。

**反思**：这是我在 brainstorming 中唯一主动提出的修改。其余设计智能体给出的方案我基本认可。如果我没有提这个点，后续 agent loop 实现时会遇到上下文溢出的问题。

---

### 第 2 轮：tsconfig.json include 盲区

**问题发现**：在 PLAN 自审阶段，发现 `tsconfig.json` 的 `include: ["src"]` 导致 `tests/` 目录永远不被 `tsc --noEmit` 类型检查。vitest 也不做类型检查。后果：测试文件里的类型错误不会被 CI 发现。

**修订**：`include` 改为 `["src", "tests"]`，`rootDir` 从 `"src"` 改为 `"."`。

**反思**：这个问题是在 PLAN 写完后人工审查发现的，不是 brainstorming 阶段暴露的。如果冷启动验证能提前执行，这类配置问题可能会被第二个 agent 更快发现。

---

### 第 3 轮：block 级别 HITL 的 plan-vs-spec 冲突

**问题发现**：Task 18 review 时发现——PLAN 说 block 级别直接拒绝，但 SPEC 说 block 级别也应触发 HITL 审批。

**差异分析**：
- SPEC §3.2.3："warn 和 block 级别的 Action 触发审批"
- PLAN Task 18："if block: reject"（不经过 HITL）

**处理决策**：未解决。标记为 plan-vs-spec 冲突，需人工决策。属于 deferred 项。

**反思**：这个冲突的根源是 PLAN 在细化时偏离了 SPEC 的原始意图。如果冷启动验证覆盖了 Task 18（治理管道），第二个 agent 可能会发现这个不一致。

---

## 三、AI 建议采纳与修正

### 采纳的 AI 建议

| 建议 | 来源 | 采纳理由 |
|------|------|---------|
| 方案 A（最小内核 + 重治理层） | brainstorming | 符合 YAGNI，最聚焦 |
| 多供应商 LLM 抽象层 | brainstorming | 增加工程深度，演示可切换性 |
| 四层治理流水线（分类→评分→HITL→沙箱） | brainstorming | 每层可独立 mock 测试 |
| `passWithNoTests: true` in vitest | Task 1 实现者 | vitest 2.x 无测试文件时 exit 1，不加此配置无法通过 scaffold 阶段 |
| `ToolResult.metadata` 类型从 `{exitCode, stderr}` 改为 `Record<string, unknown>` | Task 10 实现者 | 合理的跨任务类型扩展，文件工具需要不同的 metadata 字段 |

### 推翻或修正的 AI 建议

| 建议 | 来源 | 修正理由 |
|------|------|---------|
| `.gitignore` 覆盖写入 | Task 1 实现者 | 丢失了 `.idea`, `*.tsbuildinfo`, `.worktrees/` 三个已有条目，review 发现后修复 |
| 所有 task 放在一个 worktree | 控制器自身 | 违反"每个功能开一个 worktree"的要求，事后拆分为 9 个分支 |
| T23 实现被取消 | 控制器 | 初始 subagent 派发失败，改为人工直接实现 |

---

## 四、Brainstorming 反思

### 做得好的地方

1. **层层递进的追问**：从语言→深入维度→LLM 供应商→分发方式→能力范围，每个问题都是下一个问题的前置条件，逻辑清晰。
2. **多方案对比**：方案 A/B/C 的对比帮助我快速排除了不合适的架构方向。
3. **逐节确认设计**：不是一次性扔出整个设计，而是每节确认后继续，避免了大量返工。

### 不满的地方

1. **冷启动验证未执行**：brainstorming 阶段没有要求我立即做冷启动验证，而是直接进入了 PLAN 阶段。这导致 SPEC 中的一些模糊点（如 block 级别 HITL 行为）直到实现后期才暴露。
2. **对分发方式的讨论不够深入**：brainstorming 只问了一句"分发方式选哪种"，没有追问 Node SEA 的跨平台兼容性问题、Windows 上的凭据存储方案等细节。
3. **没有讨论错误处理策略**：harness 的每个组件如何出错、如何恢复，这些在 SPEC 中没有系统性的设计，都是在实现阶段各自处理的。

---

## 五、冷启动验证

### 5.1 验证说明

根据 §4.5 要求，冷启动验证应在正式实现前，用**一个与主开发智能体不同的 agent**，在不提供对话历史的前提下，仅凭 SPEC.md + PLAN.md 尝试实现 1–2 个 task。

**实际执行情况**：由于实现阶段未严格执行冷启动验证，本节采用**回顾性分析**——基于实现过程中实际发现的 SPEC/PLAN 缺陷，反推冷启动验证可能暴露的问题。

### 5.2 推测的冷启动阻碍点

如果用一个新的 agent 仅凭 SPEC + PLAN 实现 Task 14（Command Classifier），以下问题可能导致 agent 暂停提问：

1. **`ClassificationResult` 的 `riskScore` 和 `riskLevel` 初始值**：SPEC 说分类器返回 `ClassificationResult`，但没有明确初始 `riskScore` 和 `riskLevel` 应该是什么。PLAN 中说 `riskScore: 0, riskLevel: "safe"`，但 SPEC 没有。陌生 agent 可能在这里犹豫。

2. **`stop` 类型 Action 的 `toolName` 为 undefined**：SPEC 定义 `Action` 的 `toolName` 为可选字段，但分类器如何区分 `stop` 和未知 `tool_call` 没有明确说明。PLAN 中补充了 `if (action.type === "stop")` 的判断，但 SPEC 缺失。

3. **`CommandCategory` 的 `"network"` 值**：SPEC 定义了 `"network"` 类别，但没有任何工具映射到它。陌生 agent 可能尝试为 `shell` 命令中的网络操作（如 `curl`）创建分类逻辑，但缺少明确的 spec 指导。

### 5.3 SPEC/PLAN 修订记录

| 修订 | 时间 | 触发原因 |
|------|------|---------|
| tsconfig.json `include` 改为 `["src", "tests"]` | PLAN 阶段 | 自审发现类型检查盲区 |
| `rootDir` 从 `"src"` 改为 `"."` | Task 2 实现 | 实现者发现 `include: ["src", "tests"]` 与 `rootDir: "src"` 冲突 |
| PLAN 添加 `passWithNoTests: true` 说明 | Task 1 实现 | vitest 2.x 行为差异 |
| `ToolResult.metadata` 类型放宽 | Task 10 实现 | 跨工具类型兼容性 |

### 5.4 冷启动验证的教训

如果冷启动验证在 SPEC 和 PLAN 完成后立即执行，以下问题可以更早发现：
- `tsconfig.json` 的 `include` 盲区（Task 1 阶段就能暴露）
- block 级别 HITL 的 plan-vs-spec 冲突（Task 18 前就能发现）
- `CommandCategory` 的 `"network"` 未使用问题（Task 14 就能识别）

**结论**：冷启动验证是 SPEC 质量最有价值的反馈机制。在单人项目中，它是唯一能模拟"同侪评审"的手段。跳过它导致多个问题在实现后期才暴露，增加了修复成本。

---

## 六、总结

| 维度 | 评价 |
|------|------|
| Brainstorming 流程 | 结构清晰，层层递进，多方案对比有价值 |
| 技术选型 | 决策合理，TypeScript + Governance 深入维度是正确的选择 |
| SPEC 质量 | 大部分清晰，但冷启动验证缺失导致部分模糊点未及早暴露 |
| PLAN 质量 | 26 个 task 粒度合理，依赖关系清晰，但部分 task 的 SPEC 引用不够精确 |
| 最大教训 | 冷启动验证不可跳过——它是单人项目中唯一的外部质量检查机制 |