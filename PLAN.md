# CCGHarness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a coding agent harness kernel in TypeScript with a deep governance/guardrails subsystem, mock-LLM testability, and native binary distribution.

**Architecture:** Minimal kernel + deep governance. The agent main loop is a thin orchestrator; the governance subsystem is a four-layer pipeline (classifier → risk scorer → HITL FSM → sandbox). All components expose interfaces for mock injection in unit tests.

**Tech Stack:** TypeScript 5.x, Node.js 20+, vitest, js-yaml, commander, openai SDK, @anthropic-ai/sdk

## Global Constraints

- Language: TypeScript, strict mode enabled
- Runtime: Node.js 20+, ESM modules (`"type": "module"`)
- Test framework: vitest, all tests runnable with `npx vitest run`
- TDD mandatory: write failing test first, then implementation
- No real LLM in unit tests: all core mechanism tests use MockLLMProvider
- No real credentials in code, config, or tests
- LLM abstraction layer: `LLMProvider` interface with mock implementation
- Governance mechanisms must be deterministic functions testable without LLM
- CI job must be named `unit-test`
- Binary distribution: Node SEA or pkg, single-file executable

---

## File Structure

```
src/
├── core/
│   ├── types.ts            # All shared interfaces and types
│   ├── parser.ts           # LLM response → Action[] parser
│   └── loop.ts             # Agent main loop orchestrator
├── providers/
│   ├── interface.ts        # LLMProvider interface
│   ├── openai.ts           # OpenAI adapter
│   ├── anthropic.ts        # Anthropic adapter
│   ├── ollama.ts           # Ollama adapter (HTTP)
│   ├── mock.ts             # MockLLMProvider for testing
│   └── factory.ts          # Provider factory
├── tools/
│   ├── interface.ts        # ToolDefinition re-export
│   ├── read-file.ts        # read_file tool
│   ├── write-file.ts       # write_file tool
│   ├── shell.ts            # shell tool
│   ├── run-tests.ts        # run_tests tool
│   └── run-lint.ts         # run_lint tool
├── governance/
│   ├── classifier.ts       # CommandClassifier
│   ├── risk-scorer.ts      # RiskScorer with rule engine
│   ├── approval-fsm.ts     # HITL approval state machine
│   ├── sandbox.ts          # Sandbox executor
│   └── guard.ts            # Guard orchestrator (pipeline)
├── feedback/
│   ├── test-validator.ts   # Test output parser
│   ├── lint-validator.ts   # Lint output parser
│   └── typecheck-validator.ts  # TypeScript error parser
├── memory/
│   ├── conversation.ts     # Conversation history manager
│   ├── compressor.ts       # Context compression
│   └── project-context.ts  # Project rules loader
├── config/
│   ├── loader.ts           # YAML config loader
│   └── credentials.ts      # OS credential manager wrapper
└── cli/
    ├── index.ts            # CLI entry point
    ├── commands.ts         # CLI command handlers
    └── setup.ts            # First-run setup wizard

tests/
├── core/
│   ├── types.test.ts
│   ├── parser.test.ts
│   └── loop.test.ts
├── providers/
│   ├── mock.test.ts
│   ├── openai.test.ts
│   ├── anthropic.test.ts
│   ├── ollama.test.ts
│   └── factory.test.ts
├── tools/
│   ├── read-file.test.ts
│   ├── write-file.test.ts
│   ├── shell.test.ts
│   ├── run-tests.test.ts
│   └── run-lint.test.ts
├── governance/
│   ├── classifier.test.ts
│   ├── risk-scorer.test.ts
│   ├── approval-fsm.test.ts
│   ├── sandbox.test.ts
│   └── guard.test.ts
├── feedback/
│   ├── test-validator.test.ts
│   ├── lint-validator.test.ts
│   └── typecheck-validator.test.ts
├── memory/
│   ├── conversation.test.ts
│   ├── compressor.test.ts
│   └── project-context.test.ts
├── config/
│   └── loader.test.ts
└── demo/
    ├── guardrail-demo.test.ts
    ├── feedback-loop-demo.test.ts
    └── deep-dimension-demo.test.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: buildable project skeleton, `npm install && npm test` succeeds (0 tests)

- [x] **Step 1: Create `package.json`** — name `ccg`, type `module`, dependencies: `openai ^4`, `@anthropic-ai/sdk ^0.30`, `js-yaml ^4.1`, `commander ^12`. devDependencies: `typescript ^5.5`, `vitest ^2`, `@types/node ^20`, `@types/js-yaml ^4`. scripts: `build: tsc`, `test: vitest run`, `test:watch: vitest`, `typecheck: tsc --noEmit`. *(done 2026-07-29; deviations: test script has `--passWithNoTests`, typecheck script retargeted to `tsc --noEmit -p tsconfig.typecheck.json` — user-approved)*
- [x] **Step 2: Create `tsconfig.json`** — target ES2022, module ESNext, moduleResolution bundler, strict true, outDir dist, rootDir src. *(done 2026-07-29; companion `tsconfig.typecheck.json` added for tests/ coverage)*
- [x] **Step 3: Create `vitest.config.ts`** — include `tests/**/*.test.ts`. *(done 2026-07-29)*
- [x] **Step 4: Create `.gitignore`** — node_modules/, dist/, .env, *.log. *(pre-existing file already satisfied; verified 2026-07-29)*
- [x] **Step 5: Run `npm install`** — verify installs without errors. *(done 2026-07-29, exit 0)*
- [x] **Step 6: Run `npm test`** — verify exit code 0 (0 tests). *(done 2026-07-29, exit 0)*
- [ ] **Step 7: Commit** — `git add . && git commit -m "chore: scaffold project with TypeScript and vitest"` *(deferred: user forbade git operations on 2026-07-29)*

---

### Task 2: Core Types

**Files:**
- Create: `src/core/types.ts`, `tests/core/types.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Action`, `ToolResult`, `Issue`, `ValidationResult`, `Message`, `LLMResponse`, `ToolDefinition`, `ClassificationResult`, `CommandCategory`, `RiskLevel`, `GuardrailRule`, `ApprovalState`, `ApprovalDecision`, `ConversationTurn`, `CompressedSummary`, `LoopConfig`, `LoopState`

- [x] **Step 1: Write failing test** — `tests/core/types.test.ts` validates all types can be constructed with correct shapes. *(done 2026-07-29, TDD)*
- [x] **Step 2: Run test to verify it fails** — `npx vitest run tests/core/types.test.ts` → FAIL. *(done 2026-07-29; RED via runtime dynamic-import, 1 failed/23 passed)*
- [x] **Step 3: Create `src/core/types.ts`** — all interfaces and type aliases from SPEC §6. Detailed type definitions at the end of this plan. *(done 2026-07-29; verbatim transcription, reviewer-verified)*
- [x] **Step 4: Run test to verify it passes** — PASS. *(done 2026-07-29, 24/24)*
- [ ] **Step 5: Commit** — `git add src/core/types.ts tests/core/types.test.ts && git commit -m "feat: add core type definitions"` *(deferred: user forbade git operations on 2026-07-29)*

---

### Task 3: LLM Provider Interface and Mock

**Files:**
- Create: `src/providers/interface.ts`, `src/providers/mock.ts`, `tests/providers/mock.test.ts`

**Interfaces:**
- Consumes: `Message`, `LLMResponse`, `ToolDefinition`, `Action` from `src/core/types.ts`
- Produces: `LLMProvider` interface with `chat(messages, tools) → Promise<LLMResponse>`, `MockLLMProvider` class

- [ ] **Step 1: Write failing test** — `tests/providers/mock.test.ts`: test that MockLLMProvider returns responses in order, and throws when no more responses.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/providers/interface.ts`** and `src/providers/mock.ts` — MockLLMProvider takes `LLMResponse[]` in constructor, returns them sequentially via `chat()`.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add LLMProvider interface and MockLLMProvider"`

---

### Task 4: OpenAI Provider

**Files:**
- Create: `src/providers/openai.ts`, `tests/providers/openai.test.ts`

**Interfaces:**
- Consumes: `LLMProvider` from interface.ts
- Produces: `OpenAIProvider` class, `OpenAIConfig { apiKey, model, baseURL? }`

- [ ] **Step 1: Write failing test** — mock `openai` SDK, test that OpenAIProvider correctly parses tool_calls and stop/ text responses.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/providers/openai.ts`** — wraps OpenAI `chat.completions.create`, maps tools to OpenAI function format, parses tool_calls into `Action[]`, returns `LLMResponse` with usage.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add OpenAI provider"`

---

### Task 5: Anthropic Provider

**Files:**
- Create: `src/providers/anthropic.ts`, `tests/providers/anthropic.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`
- Produces: `AnthropicProvider` class, `AnthropicConfig { apiKey, model }`

- [ ] **Step 1: Write failing test** — mock `@anthropic-ai/sdk`, test tool_use and end_turn parsing.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/providers/anthropic.ts`** — wraps Anthropic `messages.create`, separates system messages, maps tools, parses tool_use blocks into `Action[]`.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add Anthropic provider"`

---

### Task 6: Ollama Provider

**Files:**
- Create: `src/providers/ollama.ts`, `tests/providers/ollama.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`
- Produces: `OllamaProvider` class, `OllamaConfig { baseURL, model }`

- [ ] **Step 1: Write failing test** — mock global `fetch`, test /api/chat call with tools, parse tool_calls and stop, test error handling.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/providers/ollama.ts`** — HTTP POST to `{baseURL}/api/chat`, maps messages/tools, parses response.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add Ollama provider"`

---

### Task 7: Provider Factory

**Files:**
- Create: `src/providers/factory.ts`, `tests/providers/factory.test.ts`

**Interfaces:**
- Consumes: all provider classes, `LLMProvider`
- Produces: `createProvider(config: LLMConfig): LLMProvider`, `LLMConfig` discriminated union

- [ ] **Step 1: Write failing test** — test factory creates correct provider for each type, throws on unknown.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/providers/factory.ts`** — switch on `config.provider`, instantiate correct class.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add provider factory"`

---

### Task 8: LLM Response Parser

**Files:**
- Create: `src/core/parser.ts`, `tests/core/parser.test.ts`

**Interfaces:**
- Consumes: `LLMResponse`, `Action`
- Produces: `parseActions(response: LLMResponse): Action[]`

- [ ] **Step 1: Write failing test** — test that parser returns actions array, handles stop, handles empty.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/core/parser.ts`** — simply returns `response.actions` (providers do the parsing).
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add LLM response parser"`

---

### Task 9: Read File Tool

**Files:**
- Create: `src/tools/interface.ts`, `src/tools/read-file.ts`, `tests/tools/read-file.test.ts`

**Interfaces:**
- Consumes: `ToolDefinition`, `ToolResult`
- Produces: `createReadFileTool(): ToolDefinition`

- [ ] **Step 1: Write failing test** — test reading file content, non-existent file error, line range support, metadata.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/tools/read-file.ts`** — `fs.readFileSync` with optional startLine/endLine slicing.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add read_file tool"`

---

### Task 10: Write File Tool

**Files:**
- Create: `src/tools/write-file.ts`, `tests/tools/write-file.test.ts`

**Interfaces:**
- Consumes: `ToolDefinition`, `ToolResult`
- Produces: `createWriteFileTool(): ToolDefinition`

- [ ] **Step 1: Write failing test** — test writing content, creating parent directories, error handling.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/tools/write-file.ts`** — `fs.mkdirSync({ recursive: true })` + `fs.writeFileSync`.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add write_file tool"`

---

### Task 11: Shell Tool

**Files:**
- Create: `src/tools/shell.ts`, `tests/tools/shell.test.ts`

**Interfaces:**
- Consumes: `ToolDefinition`, `ToolResult`
- Produces: `createShellTool(): ToolDefinition`

- [ ] **Step 1: Write failing test** — test successful command execution, failed command with exitCode, metadata.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/tools/shell.ts`** — `execSync` with cwd, 60s timeout, returns stdout/stderr/exitCode.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add shell tool"`

---

### Task 12: Run Tests and Run Lint Tools

**Files:**
- Create: `src/tools/run-tests.ts`, `src/tools/run-lint.ts`, `tests/tools/run-tests.test.ts`, `tests/tools/run-lint.test.ts`

**Interfaces:**
- Consumes: `ToolDefinition`, `ToolResult`
- Produces: `createRunTestsTool(defaultCommand?: string): ToolDefinition`, `createRunLintTool(defaultCommand?: string): ToolDefinition`

- [ ] **Step 1: Write failing tests** — test default and custom commands, metadata.
- [ ] **Step 2: Run tests** → FAIL.
- [ ] **Step 3: Create implementation** — both wrap `execSync` with configurable default commands.
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add run_tests and run_lint tools"`

---

### Task 13: Configuration Loader

**Files:**
- Create: `src/config/loader.ts`, `tests/config/loader.test.ts`, `ccg.example.yaml`

**Interfaces:**
- Consumes: js-yaml, fs
- Produces: `loadConfig(filePath: string): AppConfig`, `AppConfig` type

- [ ] **Step 1: Write failing test** — test loading valid YAML config, non-existent file error, default values.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/config/loader.ts`** — reads YAML, maps snake_case to camelCase, provides defaults for all fields.
- [ ] **Step 4: Create `ccg.example.yaml`** — sample config with all fields.
- [ ] **Step 5: Run test** → PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: add configuration loader"`

---

### Task 14: Command Classifier (Governance Layer 1)

**Files:**
- Create: `src/governance/classifier.ts`, `tests/governance/classifier.test.ts`

**Interfaces:**
- Consumes: `Action`, `ClassificationResult`, `CommandCategory`, `RiskLevel`
- Produces: `classifyCommand(action: Action): ClassificationResult`

- [ ] **Step 1: Write failing test** — test classification of read_file → file_read, write_file → file_write, shell → shell, run_tests → build_test, run_lint → build_test, unknown → unknown, stop → unknown/safe.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/governance/classifier.ts`** — lookup table mapping toolName to CommandCategory, returns safe with 0 riskScore, empty matchedRules.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add command classifier (governance layer 1)"`

---

### Task 15: Risk Scorer (Governance Layer 2)

**Files:**
- Create: `src/governance/risk-scorer.ts`, `tests/governance/risk-scorer.test.ts`, `guardrails.example.yaml`

**Interfaces:**
- Consumes: `Action`, `ClassificationResult`, `GuardrailRule`, `RiskLevel`
- Produces: `scoreRisk(action, classification, rules): ClassificationResult`

- [ ] **Step 1: Add `GuardrailRule` to `src/core/types.ts`** — `{ pattern: string; score: number; description: string }`.
- [ ] **Step 2: Write failing test** — test: rm -rf → block(100), git push --force → warn(60), npm publish → warn(40), accumulated scores, capped at 100, unmatched → safe, invalid regex skipped.
- [ ] **Step 3: Run test** → FAIL.
- [ ] **Step 4: Create `src/governance/risk-scorer.ts`** — extracts command string from Action, iterates rules, tests each regex, accumulates scores, caps at 100, maps to RiskLevel (≤30 safe, ≤70 warn, >70 block).
- [ ] **Step 5: Create `guardrails.example.yaml`** — 6 example rules with pattern, score, description.
- [ ] **Step 6: Run test** → PASS.
- [ ] **Step 7: Commit** — `git commit -m "feat: add risk scorer with rule engine (governance layer 2)"`

---

### Task 16: HITL Approval FSM (Governance Layer 3)

**Files:**
- Create: `src/governance/approval-fsm.ts`, `tests/governance/approval-fsm.test.ts`

**Interfaces:**
- Consumes: `ApprovalState`, `ApprovalDecision`
- Produces: `ApprovalFSM` class with `requestApproval`, `submitDecision`, `approveAll`, `reset`, `getState`, `getPendingRequest`

- [ ] **Step 1: Write failing test** — test: idle→waiting→approved/denied transitions, timeout, double-submit error, approveAll shortcut, reset, pending request details.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/governance/approval-fsm.ts`** — state machine with setTimeout-based timeout, approveAll flag, request/decision tracking.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add HITL approval FSM (governance layer 3)"`

---

### Task 17: Sandbox (Governance Layer 4)

**Files:**
- Create: `src/governance/sandbox.ts`, `tests/governance/sandbox.test.ts`

**Interfaces:**
- Consumes: `Action`
- Produces: `checkSandbox(action, config): SandboxResult`, `SandboxConfig`, `SandboxResult`

- [ ] **Step 1: Write failing test** — test: allowed command, blocked command, allowed list prefix match, write outside workspace, write inside workspace, read_file always allowed, empty allowed list allows all.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/governance/sandbox.ts`** — checks workspace boundary for write_file (path.resolve comparison), checks blocked list substring match, checks allowed list prefix match for shell.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add sandbox executor (governance layer 4)"`

---

### Task 18: Guard Orchestrator (Governance Pipeline)

**Files:**
- Create: `src/governance/guard.ts`, `tests/governance/guard.test.ts`

**Interfaces:**
- Consumes: all governance layers, `Action`, `GuardrailRule`, `SandboxConfig`
- Produces: `GuardOrchestrator` class with `guard(action): Promise<GuardResult>`, `GuardResult { allowed, riskLevel, reason?, matchedRules }`

- [ ] **Step 1: Write failing test** — test: safe command passes, block rejected, warn triggers HITL (approve→pass, deny→block), sandbox violation, HITL disabled skips approval.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/governance/guard.ts`** — orchestrates classify → score → (if block: reject) → (if warn && HITL: ask user) → sandbox check. Accepts `onApprovalRequired` callback.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add guard orchestrator (governance pipeline)"`

---

### Task 19: Feedback Validators

**Files:**
- Create: `src/feedback/test-validator.ts`, `src/feedback/lint-validator.ts`, `src/feedback/typecheck-validator.ts`, `tests/feedback/*.test.ts`

**Interfaces:**
- Consumes: `ValidationResult`, `Issue`, `ToolResult`
- Produces: `validateTestOutput(output): ValidationResult`, `validateLintOutput(output): ValidationResult`, `validateTypeCheckOutput(output): ValidationResult`

- [ ] **Step 1: Write failing tests** — test: passing tests, failing tests with file extraction, empty output, ESLint-style errors, warnings, TypeScript errors.
- [ ] **Step 2: Run tests** → FAIL.
- [ ] **Step 3: Create implementation** — test-validator: regex for FAIL lines and `●` blocks. lint-validator: regex `file:line:col: severity: message`. typecheck-validator: regex `file(line,col): error TS####: message`.
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add feedback validators (test, lint, typecheck)"`

---

### Task 20: Conversation Memory

**Files:**
- Create: `src/memory/conversation.ts`, `tests/memory/conversation.test.ts`

**Interfaces:**
- Consumes: `ConversationTurn`, `Message`
- Produces: `ConversationManager` class

- [ ] **Step 1: Write failing test** — test: add/get turns, token estimation, compression threshold detection, oldest half extraction, replace with summary, toMessages conversion.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/memory/conversation.ts`** — array-backed, `addTurn`, `getEstimatedTokens`, `needsCompression(threshold)`, `getOldestHalf`, `replaceOldestWithSummary`, `toMessages`.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add conversation memory manager"`

---

### Task 21: Context Compressor and Project Context

**Files:**
- Create: `src/memory/compressor.ts`, `src/memory/project-context.ts`, `tests/memory/compressor.test.ts`, `tests/memory/project-context.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`, `ConversationTurn`, `CompressedSummary`
- Produces: `compressConversation(turns, provider): Promise<CompressedSummary>`, `loadProjectContext(rulesPath): string`

- [ ] **Step 1: Write failing tests** — compressor: uses MockLLMProvider to compress turns into structured summary. project-context: loads .agent/rules.md, returns empty string on missing file.
- [ ] **Step 2: Run tests** → FAIL.
- [ ] **Step 3: Create `src/memory/compressor.ts`** — sends system prompt to LLM asking for JSON summary, parses result into CompressedSummary.
- [ ] **Step 4: Create `src/memory/project-context.ts`** — `fs.readFileSync` wrapped in try/catch.
- [ ] **Step 5: Run tests** → PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: add context compressor and project context loader"`

---

### Task 22: Agent Main Loop

**Files:**
- Create: `src/core/loop.ts`, `tests/core/loop.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`, `GuardOrchestrator`, `ToolDefinition[]`, `ConversationManager`, `compressConversation`
- Produces: `AgentLoop` class with `run(task: string): Promise<string>`, `getState(): LoopState`

- [ ] **Step 1: Write failing test** — test: simple task completes with tool call + stop, max rounds reached, consecutive failures stop, unknown tool handled gracefully.
- [ ] **Step 2: Run test** → FAIL.
- [ ] **Step 3: Create `src/core/loop.ts`** — full main loop: build context → call LLM → parse actions → for each action: guard → find tool → execute → record result → check stop conditions.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add agent main loop"`

---

### Task 23: CLI Entry Point

**Files:**
- Create: `src/cli/index.ts`, `src/cli/commands.ts`, `src/cli/setup.ts`

**Interfaces:**
- Consumes: all modules
- Produces: executable CLI with `ccg "task"`, `ccg --interactive`, `ccg --config`, `ccg setup`, `ccg --verbose`

- [ ] **Step 1: Create `src/cli/setup.ts`** — credential management functions: `storeApiKey(provider, key)`, `getApiKey(provider)`, `removeApiKey(provider)`, `checkApiKey(provider)`. Uses `keytar` or falls back to encrypted file via `crypto` module.
- [ ] **Step 2: Create `src/cli/commands.ts`** — `runTask(task, configPath, verbose)` function that wires everything: loads config, loads rules, gets API key, creates provider, creates tools, creates guard, creates loop, runs, handles HITL via readline prompts.
- [ ] **Step 3: Create `src/cli/index.ts`** — commander-based CLI with `run` command (default), `setup` command, `--config` option, `--verbose` flag, `--interactive` flag.
- [ ] **Step 4: Update `package.json` bin** — `"ccg": "dist/cli/index.js"`.
- [ ] **Step 5: Run `npm run build`** — verify compiles without errors.
- [ ] **Step 6: Commit** — `git commit -m "feat: add CLI entry point"`

---

### Task 24: Mechanism Demo Tests

**Files:**
- Create: `tests/demo/guardrail-demo.test.ts`, `tests/demo/feedback-loop-demo.test.ts`, `tests/demo/deep-dimension-demo.test.ts`

**Interfaces:**
- Consumes: all modules
- Produces: 3 deterministic demo tests

- [ ] **Step 1: Create `tests/demo/guardrail-demo.test.ts`** — mock LLM produces `shell("rm -rf /")` action, GuardOrchestrator deterministically blocks it with riskLevel "block" and matchedRules including "Recursive force delete". No real LLM, no network.
- [ ] **Step 2: Create `tests/demo/feedback-loop-demo.test.ts`** — mock LLM sequence: tool_call → tool fails → another tool_call → stop. AgentLoop receives failure feedback, adjusts next action. Test verifies the loop saw the failure and continued.
- [ ] **Step 3: Create `tests/demo/deep-dimension-demo.test.ts`** — governance pipeline demo: mock LLM returns 3 actions (safe read, warn-level git push, block-level rm -rf). GuardOrchestrator correctly classifies each, scores risks, blocks the dangerous one, approves the warn one (mock HITL callback). Verifies all 4 governance layers function correctly.
- [ ] **Step 4: Run demo tests** — `npx vitest run tests/demo/` → all PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add mechanism demo tests"`

---

### Task 25: CI Configuration

**Files:**
- Create: `.github/workflows/unit-test.yml`

**Interfaces:**
- Consumes: nothing
- Produces: GitHub Actions CI with job named `unit-test`

- [ ] **Step 1: Create `.github/workflows/unit-test.yml`** — runs on push, Node.js 20, `npm ci`, `npm test`, `npm run typecheck`.
- [ ] **Step 2: Commit** — `git commit -m "ci: add GitHub Actions unit-test workflow"`

---

### Task 26: Binary Distribution

**Files:**
- Create: `scripts/build-binary.js`, update `package.json`

**Interfaces:**
- Consumes: Node SEA or pkg
- Produces: single-file executable for target platform

- [ ] **Step 1: Add build script** — use Node.js SEA (Single Executable Application) with `node --experimental-sea-config` to produce `ccg` binary.
- [ ] **Step 2: Update package.json** — add `"build:binary": "node scripts/build-binary.js"` script.
- [ ] **Step 3: Update README.md** — install instructions, binary download, key configuration, known limitations.
- [ ] **Step 4: Commit** — `git commit -m "feat: add binary distribution build"`

---

## Type Definitions Reference

```typescript
// src/core/types.ts

export interface Action {
  type: "tool_call" | "stop";
  toolName?: string;
  parameters?: Record<string, unknown>;
  summary?: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: { exitCode: number; stderr: string };
}

export interface Issue {
  severity: "error" | "warning";
  file?: string;
  line?: number;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: Issue[];
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
}

export interface LLMResponse {
  actions: Action[];
  rawUsage: { prompt: number; completion: number };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export type CommandCategory = "file_read" | "file_write" | "shell" | "build_test" | "network" | "unknown";

export type RiskLevel = "safe" | "warn" | "block";

export interface ClassificationResult {
  category: CommandCategory;
  riskScore: number;
  riskLevel: RiskLevel;
  matchedRules: string[];
}

export interface GuardrailRule {
  pattern: string;
  score: number;
  description: string;
}

export type ApprovalState = "idle" | "waiting" | "approved" | "denied" | "timeout";

export type ApprovalDecision = "approve" | "deny" | "approve_all";

export interface ConversationTurn {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  tokenCount: number;
}

export interface CompressedSummary {
  originalTask: string;
  approaches: string[];
  keyFindings: string[];
  failures: string[];
  compressedAt: number;
}

export interface LoopConfig {
  maxRounds: number;
  maxConsecutiveFailures: number;
  llmRetryAttempts: number;
}

export interface LoopState {
  round: number;
  consecutiveFailures: number;
  conversationHistory: ConversationTurn[];
  compressedSummary: CompressedSummary | null;
  finished: boolean;
  finalResult: string;
}
```

## Dependency Graph

```
Task 1: Scaffolding
  └─ Task 2: Core Types
       ├─ Task 3: Provider Interface + Mock
       │    ├─ Task 4: OpenAI Provider
       │    ├─ Task 5: Anthropic Provider
       │    ├─ Task 6: Ollama Provider
       │    └─ Task 7: Provider Factory
       ├─ Task 8: Response Parser
       ├─ Task 9: Read File Tool
       ├─ Task 10: Write File Tool
       ├─ Task 11: Shell Tool
       ├─ Task 12: Run Tests + Run Lint
       ├─ Task 13: Configuration Loader
       ├─ Task 14: Command Classifier
       │    └─ Task 15: Risk Scorer
       │         └─ Task 16: HITL Approval FSM
       │              └─ Task 17: Sandbox
       │                   └─ Task 18: Guard Orchestrator
       ├─ Task 19: Feedback Validators
       ├─ Task 20: Conversation Memory
       │    └─ Task 21: Compressor + Project Context
       └─ Task 22: Agent Main Loop
            └─ Task 23: CLI Entry Point
                 └─ Task 24: Mechanism Demo
                      └─ Task 25: CI
                           └─ Task 26: Binary Distribution
```

**Parallelizable groups:**
- Tasks 4, 5, 6 (all providers) can run in parallel
- Tasks 9, 10, 11, 12 (all tools) can run in parallel
- Tasks 14, 19, 20 (governance start, feedback, memory) can run in parallel
- Tasks 24, 25, 26 (demo, CI, distribution) can run in parallel