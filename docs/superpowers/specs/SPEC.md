# SPEC.md — CCGHarness

## 1. 问题陈述

### 1.1 要解决的问题

LLM 能完成大部分"思考"，但一颗裸 LLM 无法成为可靠的 coding agent。它缺少工程化的外围：安全护栏、客观反馈、上下文管理、工具编排。现有 agent 框架（LangChain AgentExecutor、AutoGen、CrewAI）封装了这些能力，但开发者对其内部机制缺乏控制力——当 agent 出错时，往往只能调 prompt，无法在代码层面修复。

### 1.2 目标用户

需要在自己的工具链中嵌入可控、可审计的 coding agent 的开发者。他们希望 agent 的能力边界由代码定义，而非由 prompt 暗示。

### 1.3 为什么值得做

本项目的核心命题：**当 LLM 能完成大部分编码工作时，工程师的价值落在 harness 这层工程上**。建造一个 harness 内核，就是从零理解"可靠系统到底需要哪些工程"。

---

## 2. 用户故事

| # | 用户故事 | 验收标准 |
|---|---------|---------|
| US1 | 作为开发者，我想给 agent 一个 coding 任务（如"修复类型错误"），让它自动读文件、改代码、运行测试，直到通过 | agent 能完成"修改文件→运行测试→根据失败修正"的闭环 |
| US2 | 作为开发者，我想让 agent 在执行危险命令（如 `rm -rf`、`git push --force`）前暂停并请求我确认 | 危险命令被拦截，CLI 显示风险信息并等待用户输入 |
| US3 | 作为开发者，我想用 mock LLM 测试 harness 的治理逻辑，确保拦截规则在任何情况下都生效 | 从 mock LLM 注入危险命令，治理层确定性拦截，单测 100% 覆盖 |
| US4 | 作为开发者，我想为不同项目配置不同的护栏规则（如前端项目允许 `npm publish`，后端项目禁止） | 加载不同 `guardrails.yaml` 后，治理行为正确切换 |
| US5 | 作为开发者，我想在全新机器上通过二进制文件运行 CCG，并安全地配置我的 API key | 二进制可执行，首次运行引导输入 key 并存入 OS 凭据管理器 |
| US6 | 作为开发者，我想切换 LLM 供应商（OpenAI → Anthropic → Ollama）而不改任何业务代码 | 修改配置文件中 `provider` 字段即可切换，行为一致 |

---

## 3. 功能规约

### 3.1 Agent 主循环

- **输入**：用户任务描述（字符串）
- **行为**：
  1. 构建上下文（系统提示 + 项目约定 + 会话历史 + 压缩摘要）
  2. 调用 LLM，传入可用工具列表
  3. 解析 LLM 响应为 `Action[]`（工具调用或停止信号）
  4. 对每个 Action 依次：治理拦截 → 沙箱执行 → 收集反馈 → 记录记忆
  5. 判断是否继续（停止信号 / 达到最大轮数 / 连续失败）
- **输出**：最终结果（成功/失败 + 摘要）
- **边界条件**：空任务直接返回；LLM 返回无法解析的响应时记录错误并重试一次
- **错误处理**：LLM 调用失败重试最多 3 次；工具执行失败将错误回灌给 LLM 继续

### 3.2 治理护栏（深入 ★★★）

#### 3.2.1 命令分类器

- **输入**：`Action`（工具名 + 参数）
- **行为**：基于正则和模式匹配，将 Action 归类为 `file_read | file_write | shell | build_test | network | unknown`
- **输出**：`ClassificationResult`（类别 + 风险标记）
- **边界条件**：无法识别时归为 `unknown`，默认提高风险等级

#### 3.2.2 风险评分器

- **输入**：`ClassificationResult` + `Action`
- **行为**：加载 `guardrails.yaml` 规则，逐条匹配。每条规则有 `pattern`（正则）和 `score`（累加分）。总分为各规则匹配分数之和，上限 100
- **输出**：`RiskLevel`（`safe` 0-30 / `warn` 31-70 / `block` 71-100）
- **规则示例**：
  ```yaml
  rules:
    - pattern: "rm\\s+-rf"
      score: 100
      description: "递归强制删除"
    - pattern: "git\\s+push\\s+.*--force"
      score: 60
      description: "强制推送"
    - pattern: "npm\\s+publish"
      score: 40
      description: "发布包"
  ```
- **边界条件**：空规则文件时所有命令为 `safe`；pattern 编译失败时跳过该规则并记录警告

#### 3.2.3 HITL 审批状态机

- **状态转换**：`idle → waiting → approved | denied | timeout`
- **行为**：`warn` 和 `block` 级别的 Action 触发审批。CLI 显示操作详情 + 风险等级 + 匹配的规则，等待用户输入
- **用户输入**：`y`（批准本次）/ `N`（拒绝，默认）/ `a`（批准本次会话全部后续操作）/ `s`（显示详情）
- **超时**：可配置超时时间（默认 120 秒），超时视为 `denied`
- **边界条件**：`approve_all` 后本次会话跳过 HITL；拒绝后记录拒绝原因并终止当前任务

#### 3.2.4 沙箱执行器

- **输入**：`Action` + 沙箱配置
- **行为**：检查工作目录是否在白名单（默认项目根目录），检查命令是否在黑名单，检查是否允许网络访问
- **配置项**：
  ```yaml
  sandbox:
    workspace: "."                    # 允许访问的根目录
    allowed_commands: ["npm", "git", "tsc", "jest", "eslint"]
    blocked_commands: ["rm -rf /", "shutdown", "format"]
    allow_network: false
  ```
- **边界条件**：超出工作目录的路径访问被拒绝；不在白名单的命令被拒绝

### 3.3 工具层

| 工具 | 功能 | 参数 |
|------|------|------|
| `read_file` | 读取文件内容 | `path: string`, `startLine?: number`, `endLine?: number` |
| `write_file` | 写入/创建文件 | `path: string`, `content: string` |
| `shell` | 执行 shell 命令 | `command: string`, `cwd?: string` |
| `run_tests` | 运行测试命令 | `command?: string`（默认从配置读取） |
| `run_lint` | 运行 lint | `command?: string`（默认从配置读取） |

每个工具实现 `ToolDefinition` 接口：`{ name, description, parameters: JSONSchema, execute }`。

### 3.4 反馈信号

| 校验器 | 信号来源 | 解析方式 |
|--------|---------|---------|
| `TestValidator` | 测试命令 stdout/stderr | 解析 Jest/vitest/mocha 输出格式，提取 pass/fail 和失败详情 |
| `LintValidator` | lint 命令 stdout | 解析 ESLint 格式（`file:line:col: error message`） |
| `TypeCheckValidator` | `tsc --noEmit` stdout | 解析 TypeScript 错误格式 |

每个校验器返回 `ValidationResult { passed: boolean, issues: Issue[] }`。校验结果作为下一轮 LLM 调用的上下文。

### 3.5 上下文记忆

| 层 | 内容 | 实现 |
|----|------|------|
| 会话历史 | 最近 N 轮完整对话 | 内存数组，token 估算超过窗口 80% 时触发压缩 |
| 上下文压缩 | 早期消息压缩为结构化摘要 | 调用 LLM 将最早 50% 消息压缩为 `{ originalTask, approaches, keyFindings, failures }` |
| 项目约定 | 从 `.agent/rules.md` 加载 | 每次会话启动时读取，作为系统提示的一部分 |
| 文件摘要 | 最近操作的文件路径和摘要 | 内存 KV 存储，记录最近 20 个文件操作 |

### 3.6 配置

配置文件 `ccg.yaml`（或 `ccg.toml`）：

```yaml
llm:
  provider: openai          # openai | anthropic | ollama
  model: gpt-4o
  max_rounds: 20
  temperature: 0.1

guardrails:
  rules_file: guardrails.yaml
  hitl_enabled: true
  hitl_timeout: 120
  sandbox:
    workspace: "."
    allowed_commands: []
    blocked_commands: []
    allow_network: false

tools:
  enabled: [read_file, write_file, shell, run_tests, run_lint]

feedback:
  auto_lint: true
  auto_test: true
  test_command: "npm test"
  lint_command: "npm run typecheck"
```

---

## 4. 非功能性需求

### 4.1 性能

- 单轮循环（不含 LLM 调用）延迟 < 50ms
- 上下文压缩操作 < 5s
- 启动时间（二进制）< 2s

### 4.2 安全（含凭据威胁模型）

**威胁模型：**
- 攻击者获得仓库访问权限 → 不应能读取 API key（key 不在代码/配置文件中）
- 攻击者获得运行时进程访问权限 → 内存中可能存在 key（进程环境变量），但不会持久化到磁盘
- 日志泄露 → 任何日志/终端输出不包含 key 明文

**对策：**
- API key 使用 AES-256-GCM 加密存储于 `~/.ccg/credentials.json`
- 加密密钥为首次运行时随机生成的 32 字节密钥文件（`~/.ccg/.key`，0600 权限）
- 旧版主机名派生密钥自动迁移至随机密钥方案
- 首次运行交互式引导输入（隐藏回显），写入加密存储
- 运行时从加密存储读取，仅用于构建 API 请求，不写入任何文件
- 支持 `ccg setup` 查看/更新/清除凭据（查看时只显示存在状态，不回显明文）
- `.env` 文件作为备选来源，文档中明确说明其明文风险

### 4.3 可用性

- 单二进制文件，无需安装运行时
- 首次运行自动引导配置
- CLI 输出清晰，危险操作有明确提示和默认安全选项

### 4.4 可观测性

- 每轮循环输出当前步骤和结果摘要
- 支持 `--verbose` 输出完整 LLM 请求/响应
- 支持 `--dry-run` 仅模拟不执行

---

## 5. 系统架构

### 5.1 组件图

```
┌─────────────────────────────────────────────────┐
│                   CLI Entry                      │
│            (交互式 REPL / 单次任务)               │
├─────────────────────────────────────────────────┤
│              Configuration Layer                 │
│     (YAML 规则文件 + 环境变量 + 凭据管理)         │
├─────────────────────────────────────────────────┤
│              Agent Main Loop                     │
│   context → LLM call → parse → dispatch → loop   │
├──────────┬──────────┬──────────┬────────────────┤
│  Tools   │ Feedback │ Memory   │  Governance    │
│  (最简)  │  (最简)  │  (最简)  │  (深入 ★★★)   │
│          │          │          │                │
│ - 文件读写│ - 测试结果│ - 会话历史│ - 命令分类器   │
│ - Shell  │ - Lint   │ - 压缩摘要│ - 危险等级评分  │
│ - 构建/测试│ - 类型检查│ - 项目约定│ - HITL 状态机   │
│          │          │ - 文件摘要│ - 沙箱执行器   │
│          │          │          │ - 策略引擎      │
├──────────┴──────────┴──────────┴────────────────┤
│           LLM Provider Abstraction              │
│        (OpenAI / Anthropic / Ollama)            │
└─────────────────────────────────────────────────┘
```

### 5.2 数据流

```
user task → buildContext → LLM.chat(messages, tools) → parseActions → 
  for each action:
    governance.guard(action) → [block? → HITL or abort]
    governance.sandbox(action) → tool.execute(action) →
    feedback.validate(result) → memory.record(action, result, issues) →
  shouldContinue? → loop or return result
```

### 5.3 外部依赖

| 依赖 | 用途 | 备选 |
|------|------|------|
| OpenAI API / SDK | LLM 调用（默认） | Anthropic SDK, Ollama HTTP |
| `js-yaml` | YAML 配置解析 | 自实现（减少依赖） |
| `commander` | CLI 参数解析 | 自实现 |
| `keytar` 或 OS native | 凭据安全存储 | 加密文件 |

---

## 6. 数据模型

### 6.1 核心类型

```typescript
interface Action {
  type: "tool_call" | "stop";
  toolName?: string;
  parameters?: Record<string, unknown>;
  summary?: string;
}

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: { exitCode: number; stderr: string };
}

interface Issue {
  severity: "error" | "warning";
  file?: string;
  line?: number;
  message: string;
}

interface ValidationResult {
  passed: boolean;
  issues: Issue[];
}
```

### 6.2 治理类型

```typescript
type CommandCategory = "file_read" | "file_write" | "shell"
                     | "build_test" | "network" | "unknown";

type RiskLevel = "safe" | "warn" | "block";

interface ClassificationResult {
  category: CommandCategory;
  riskScore: number;
  riskLevel: RiskLevel;
  matchedRules: string[];
}

type ApprovalState = "idle" | "waiting" | "approved" | "denied" | "timeout";
type ApprovalDecision = "approve" | "deny" | "approve_all";
```

### 6.3 记忆类型

```typescript
interface ConversationTurn {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  tokenCount: number;
}

interface CompressedSummary {
  originalTask: string;
  approaches: string[];
  keyFindings: string[];
  failures: string[];
  compressedAt: number;
}
```

### 6.4 关系

`Action` → `ClassificationResult` → 可能触发 `ApprovalFSM` → 沙箱检查 → `ToolResult` → `ValidationResult` → 回灌 LLM 上下文。

---

## 7. 凭据与分发设计

### 7.1 凭据存储

- **主方案**：AES-256-GCM 加密文件（`~/.ccg/credentials.json`），加密密钥为随机生成的 32 字节密钥文件（`~/.ccg/.key`，0600 权限）
- **备选方案**：`.env` 文件（仅开发环境，文档说明明文风险）
- **录入流程**：`ccg setup` → 选择 provider → 隐藏输入 key → 存入加密文件
- **更新/清除**：`ccg setup` 交互式选择 set/remove key
- **查看**：`ccg setup` 启动时显示各 provider 配置状态（不回显 key）

### 7.2 分发

- **形态**：原生二进制（Node.js SEA 或 `pkg` 打包）
- **目标平台**：Windows x64, macOS arm64/x64, Linux x64
- **构建**：CI 中每个平台产出一个二进制文件
- **获取**：GitHub Releases 下载对应平台二进制
- **运行**：`./ccg "task description"` 或 `./ccg --interactive`
- **首次运行**：自动检测未配置凭据，引导进入 setup 流程
- **已知限制**：需要操作系统支持凭据管理器；Ollama 模式需要本地运行 Ollama 服务

---

## 8. 技术选型与理由

| 决策 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 全栈统一、类型安全、LLM SDK 生态成熟、Node SEA 支持二进制打包 |
| 运行时 | Node.js 20+ | LTS 稳定、SEA 原生支持、跨平台 |
| LLM SDK | `openai` + `@anthropic-ai/sdk` | 各自官方 SDK，API 稳定 |
| CLI | `commander` 或自实现 | 轻量，减少依赖 |
| 配置格式 | YAML | 可读性好，`js-yaml` 成熟 |
| 测试框架 | Jest 或 vitest | TypeScript 原生支持，mock 能力强 |
| 分发 | Node SEA 二进制 | 单文件、无运行时依赖、跨平台 |
| 凭据存储 | `keytar` 或 OS 原生命令 | 跨平台抽象，调用 OS 原生凭据管理 |

---

## 9. 领域与机制设计（Track A 额外要求）

### 9.1 领域分析

**领域：Coding（软件开发）**

| 维度 | Coding 领域的具体形态 |
|------|----------------------|
| **反馈信号** | 测试结果（pass/fail）、lint 输出、类型检查错误——客观、确定、可解析 |
| **危险动作** | 删除文件/目录（`rm -rf`）、强制推送（`git push --force`）、发布包（`npm publish`）、格式化磁盘、修改系统配置 |
| **所需工具** | 文件读写、shell 执行、测试运行、lint 运行 |
| **记忆需求** | 项目代码约定、历史决策、已尝试方案、文件结构 |

### 9.2 重点维度：治理护栏

选择 Governance 作为深入维度，理由：

1. **天然由代码构成**：分类器、评分器、状态机、沙箱都是确定性函数，最适合"移除 LLM 还能单测"标准
2. **工程深度足**：四层流水线 + 规则引擎 + 状态机 + 沙箱，组件丰富，边界清晰
3. **安全价值高**：这是 coding agent 最关键的工程问题——如何让 agent 强大但不危险

### 9.3 机制编码实现

- **CommandClassifier**：纯函数，输入 `Action`，输出 `ClassificationResult`。基于正则 + 模式匹配，可独立单测
- **RiskScorer**：纯函数，输入 `ClassificationResult` + `Action` + 规则列表，输出 `RiskLevel`。规则从 YAML 加载，编译为正则列表
- **ApprovalFSM**：状态机类，`transition(input) → newState`，纯逻辑，可独立单测
- **Sandbox**：纯函数，输入 `Action` + 沙箱配置，输出 `{ allowed: boolean, reason?: string }`

所有机制均可在 mock LLM 环境下通过确定性单元测试验证。

---

## 10. 验收标准

| 功能 | 验收标准 |
|------|---------|
| Agent 主循环 | mock LLM 下能完成"调用→解析→执行→反馈→继续/停止"完整循环 |
| 治理分类器 | 给定 10 个典型命令，分类准确率 100%（确定性规则） |
| 风险评分 | 给定 `guardrails.yaml`，`rm -rf` 返回 `block`，`cat file` 返回 `safe` |
| HITL 状态机 | mock 用户输入后状态转换正确，超时正确拒绝 |
| 沙箱 | 超出工作目录的路径被拒绝，黑名单命令被拒绝 |
| 工具执行 | `read_file` 返回正确内容，`write_file` 写入正确，`shell` 执行正确 |
| 反馈信号 | 解析测试失败输出，正确提取失败用例和文件位置 |
| 上下文压缩 | 超窗口后触发压缩，压缩后 token 数不超过窗口限制 |
| 凭据安全 | key 不在源码/日志/终端历史中，存储于 OS 凭据管理器 |
| 分发 | 二进制文件可独立运行，首次运行引导配置 |
| 机制演示 | mock LLM 下演示：① 护栏拦截 ② 反馈闭环 ③ 治理维度的确定性行为 |

---

## 11. 风险与未决问题

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Node SEA 打包在 Windows 上的兼容性问题 | 分发受阻 | 提前验证，备选 `pkg` 或 `nexe` |
| `keytar` 跨平台兼容性 | 凭据存储失败 | 备选：加密文件方案，或直接调用 OS 原生命令 |
| YAML 规则文件复杂后性能下降 | 治理延迟增加 | 规则编译为 RegExp 列表，O(n) 匹配，n 通常 < 50 |
| LLM 返回格式不稳定 | 解析失败 | 宽松解析 + 重试机制，记录失败以供分析 |
| 上下文压缩丢失关键信息 | agent 重复犯错 | 压缩摘要保留"已尝试方案"和"失败记录"两个关键字段 |

---

## 12. 目录结构

```
CCGHarness/
├── src/
│   ├── core/              # 主循环、类型定义
│   │   ├── types.ts
│   │   ├── loop.ts
│   │   └── parser.ts
│   ├── providers/         # LLM 供应商适配器
│   │   ├── interface.ts
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   ├── ollama.ts
│   │   └── mock.ts
│   ├── tools/             # 工具定义与执行
│   │   ├── interface.ts
│   │   ├── read-file.ts
│   │   ├── write-file.ts
│   │   ├── shell.ts
│   │   ├── run-tests.ts
│   │   └── run-lint.ts
│   ├── governance/        # 治理子系统（深入）
│   │   ├── classifier.ts
│   │   ├── risk-scorer.ts
│   │   ├── approval-fsm.ts
│   │   ├── sandbox.ts
│   │   └── guard.ts        # 编排入口
│   ├── feedback/          # 反馈信号
│   │   ├── test-validator.ts
│   │   ├── lint-validator.ts
│   │   └── typecheck-validator.ts
│   ├── memory/            # 上下文管理
│   │   ├── conversation.ts
│   │   ├── compressor.ts
│   │   └── project-context.ts
│   ├── config/            # 配置加载
│   │   ├── loader.ts
│   │   └── credentials.ts
│   └── cli/               # CLI 入口
│       ├── index.ts
│       ├── commands.ts
│       └── setup.ts
├── tests/
│   ├── core/
│   ├── governance/
│   ├── feedback/
│   ├── memory/
│   └── demo/              # 机制演示
│       ├── guardrail-demo.test.ts
│       ├── feedback-loop-demo.test.ts
│       └── deep-dimension-demo.test.ts
├── ccg.yaml               # 默认配置
├── guardrails.yaml         # 默认护栏规则
├── package.json
├── tsconfig.json
├── README.md
├── SPEC.md
├── PLAN.md
└── .github/workflows/
    └── unit-test.yml
```