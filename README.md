# CCGHarness

从零构建的编码 Agent 内核，将 LLM 封装为可靠的自实现编码智能体，内置工具调度、记忆管理、治理管道、反馈闭环和确定性安全机制——全程不依赖 LangChain、AutoGen 等 Agent 框架。

## 项目介绍

CCGHarness 是 AI4SE 课程项目（Track A: Coding Agent Harness），核心目标是将"大模型"转变为"可靠的编码 Agent"。与直接调用 LLM API 不同，CCG 在 LLM 之上叠加了多层确定性机制：

- **Agent 主循环**：自实现的决策循环，不依赖任何框架的 AgentExecutor
- **治理管道**：分类器 → 风险评分 → 人工审批 → 沙箱，四层串联
- **反馈闭环**：lint、test、typecheck 验证器，失败自动反馈给 LLM 调整策略
- **记忆管理**：对话历史压缩、项目上下文感知
- **工具系统**：文件读写、Shell 执行、测试运行、代码检查

所有核心机制均可通过 mock LLM 进行确定性单元测试——这是本项目的关键设计约束。

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 从源码构建

```bash
git clone https://github.com/changchanggod/CCGHarness.git
cd CCGHarness
npm install
npm run build
```

### 使用二进制文件

下载对应平台的 `ccg` 二进制文件，放到 PATH 路径下即可运行。

#### 构建二进制文件

```bash
npm run build:sea
```

构建产物：`ccg.exe`（Windows）或 `ccg`（macOS/Linux）。

#### 二进制文件使用

```bash
# 首次使用：配置 API 密钥
ccg setup

# 单次任务
ccg "将 src/app.ts 中的 getCwd 重命名为 getCurrentWorkingDirectory"

# 指定配置文件
ccg -c ./my-project/ccg.yaml "修复 auth.test.ts 中的测试失败"

# 交互模式（持续对话）
ccg --interactive

# 详细输出（查看 Agent 推理过程）
ccg -v "为 utils.ts 添加单元测试"

# 查看帮助
ccg --help
```

#### 交互模式命令

```
ccg --interactive
```

| 命令 | 说明 |
|------|------|
| `<任意任务>` | 执行任务 |
| `/v` 或 `/verbose` | 切换详细输出 |
| `/h` 或 `/help` | 显示帮助 |
| `/q` 或 `/quit` | 退出 |

## 机制解释

### 整体架构

```
用户任务 → CLI 入口 → 配置加载 → Agent 主循环 → 返回结果
                         │
                         ├── LLM Provider（OpenAI / Anthropic / DeepSeek / Ollama）
                         ├── 治理管道（分类 → 评分 → 审批 → 沙箱）
                         ├── 工具调度（read_file / write_file / shell / run_tests / run_lint）
                         ├── 反馈闭环（lint / test / typecheck）
                         └── 记忆管理（对话历史 / 压缩 / 项目上下文）
```

### Agent 主循环

每一轮迭代：

1. 将对话历史 + 工具定义发送给 LLM
2. 解析 LLM 响应为 Action 列表（tool_call 或 stop）
3. 每个 tool_call 通过治理管道审批
4. 执行通过审批的工具，捕获结果
5. 运行反馈验证器（lint、test）
6. 将结果反馈给 LLM，进入下一轮

循环终止条件：LLM 返回 stop、达到 `max_rounds`、或连续失败达到 `maxConsecutiveFailures`（默认 3）。

### 治理管道（Governance）

所有工具调用经过四层确定性管道：

```
Action → 分类器 → 风险评分器 → HITL 审批 → 沙箱 → 允许/拒绝
```

**1. 分类器（Classifier）**

识别动作类型：`file_read`、`file_write`、`shell`、`build_test`、`network`、`unknown`。

**2. 风险评分器（Risk Scorer）**

根据 guardrail 规则对动作打分（0-100）：

| 分数 | 级别 | 行为 |
|------|------|------|
| 0-39 | safe | 直接放行 |
| 40-79 | warn | 触发人工审批（HITL） |
| 80-100 | block | 直接拒绝 |

**3. 人工审批（HITL）**

当风险级别为 `warn` 且 HITL 开启时，提示用户审批：
```
[HITL] Action requires approval:
  Action: Write file: /etc/config
  Risk: warn
  Matched rules: sensitive-file-write

Allow this action? [y]es / [n]o / [a]pprove all:
```

**4. 沙箱（Sandbox）**

限制文件访问范围和命令执行权限：
- 限定工作目录
- 白名单/黑名单命令
- 网络访问控制

### 反馈闭环（Feedback）

每次工具执行后，自动运行验证器：

| 验证器 | 触发条件 | 行为 |
|--------|----------|------|
| Lint Validator | 文件写入后 | 运行 lint 命令，失败则反馈给 LLM |
| Test Validator | 文件写入后 | 运行 test 命令，失败则反馈给 LLM |
| Typecheck Validator | 文件写入后 | 运行 tsc --noEmit，失败则反馈给 LLM |

形成闭环：LLM 做出修改 → 验证器发现问题 → 反馈给 LLM → LLM 调整策略 → 直到通过。

### 记忆管理（Memory）

- **对话历史**：完整记录 LLM 与工具的交互
- **自动压缩**：当 token 超过阈值（默认 80% 容量），自动压缩最早一半对话
- **项目上下文**：可注入项目结构、编码规范等上下文信息

### 工具系统

| 工具 | 说明 | 参数 |
|------|------|------|
| `read_file` | 读取文件内容 | `path`, `startLine?`, `endLine?` |
| `write_file` | 写入文件（自动创建父目录） | `path`, `content` |
| `shell` | 执行 Shell 命令 | `command`, `cwd?` |
| `run_tests` | 运行测试套件 | `command?`（覆盖配置） |
| `run_lint` | 运行代码检查 | `command?`（覆盖配置） |

## 配置文件

### ccg.yaml

```yaml
llm:
  provider: deepseek          # openai | anthropic | deepseek | ollama
  model: deepseek-chat        # 模型名称
  max_rounds: 20              # 最大迭代轮数
  temperature: 0.1            # LLM 温度参数

guardrails:
  rules_file: guardrails.yaml # 守护规则文件
  hitl_enabled: true          # 是否启用人机协同审批
  hitl_timeout: 120           # 审批超时（秒）
  sandbox:
    workspace: "."
    allowed_commands: []
    blocked_commands: []
    allow_network: false

tools:
  enabled:
    - read_file
    - write_file
    - shell
    - run_tests
    - run_lint

feedback:
  auto_lint: true
  auto_test: true
  test_command: "npm test"
  lint_command: "npm run lint"
```

### guardrails.yaml

```yaml
rules:
  - pattern: "rm -rf /"
    score: 100
    description: "禁止系统级删除"
  - pattern: "git push --force"
    score: 85
    description: "禁止强制推送"
  - pattern: "npm publish"
    score: 70
    description: "禁止意外发布"
  - pattern: "DROP TABLE"
    score: 90
    description: "禁止删除数据库表"
  - pattern: "chmod 777"
    score: 60
    description: "危险权限变更需审批"
```

## Provider 配置

### OpenAI

```yaml
llm:
  provider: openai
  model: gpt-4o
```
通过 `ccg setup` 选择 `openai` 设置 API Key。

### Anthropic

```yaml
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
```
通过 `ccg setup` 选择 `anthropic` 设置 API Key。

### DeepSeek

```yaml
llm:
  provider: deepseek
  model: deepseek-chat        # 或 deepseek-reasoner
```
通过 `ccg setup` 选择 `deepseek` 设置 API Key。

### Ollama（本地模型）

```yaml
llm:
  provider: ollama
  model: llama3
```
无需 API Key，需本地运行 Ollama 服务（`http://localhost:11434`）。

## 凭证安全

- API Key 使用 AES-256-GCM 加密存储于 `~/.ccg/credentials.json`
- 加密密钥由主机名派生（PBKDF2，100,000 次迭代）
- 绝不在配置文件、源码或日志中存储明文密钥
- `.env` 文件作为备选方案，但文档标注明文风险
- 每次提交前检查无凭证泄露

## 项目结构

```
CCGHarness/
├── src/
│   ├── core/              # Agent 主循环、类型定义、响应解析器
│   ├── providers/         # LLM Provider 抽象层（OpenAI, Anthropic, DeepSeek, Ollama, Mock）
│   ├── tools/             # 工具定义（read_file, write_file, shell, run_tests, run_lint）
│   ├── governance/        # 治理子系统（分类器、风险评分、HITL 状态机、沙箱、编排器）
│   ├── feedback/          # 反馈验证器（测试输出、lint 输出、typecheck 输出）
│   ├── memory/            # 对话历史、上下文压缩、项目上下文
│   ├── config/            # YAML 配置加载器
│   └── cli/               # CLI 入口、命令、凭证设置
├── tests/
│   ├── core/              # 循环和解析器测试
│   ├── providers/         # Provider 和 Mock 测试
│   ├── tools/             # 工具测试
│   ├── governance/        # 治理机制测试
│   ├── feedback/          # 验证器测试
│   ├── memory/            # 记忆和压缩测试
│   ├── config/            # 配置加载器测试
│   ├── cli/               # CLI 测试
│   └── demo/              # 机制演示测试（guardrail、feedback loop、deep dimension）
├── ccg.example.yaml       # 示例配置模板
├── guardrails.example.yaml# 示例守护规则
├── SPEC.md                # 设计文档
├── PLAN.md                # 实现计划
├── AGENT_LOG.md           # Agent 交互日志
├── SPEC_PROCESS.md        # 过程文档
└── .github/workflows/     # CI 配置（unit-test 任务）
```

## 运行测试

```bash
npm test                   # 运行全部测试
npx vitest                 # 监听模式
npx vitest run             # 单次运行
```

235 个测试覆盖所有核心模块，均可通过 mock LLM 确定性运行。

## 设计原则

- **机制即代码，而非提示词**：守护规则是确定性的 `guardrail(action)` 函数，不是"请小心"的系统提示
- **去除 LLM 仍可测试**：每个核心机制（工具调度、治理管道、反馈闭环、记忆管理、终止检测）都可通过 mock/stub LLM 进行确定性单元测试
- **六维度全覆盖**：Decision（决策）、Tools（工具）、Memory（记忆）、Governance（治理）、Feedback（反馈）、Configuration（配置）均有最小可运行实现
- **深度维度**：Governance（治理）作为主贡献方向，实现了四层管道 + HITL 状态机 + 审批流程

## 已知限制

- 需要 Node.js 18+
- 二进制文件支持 Windows、macOS、Linux（x64）
- 支持的 LLM Provider：OpenAI、Anthropic、DeepSeek、Ollama
- Ollama 需要本地运行 Ollama 服务
- Shell 工具测试使用平台特定命令，跨平台 CI 可能需要适配
- `.env` 文件支持可用，但标记为明文风险