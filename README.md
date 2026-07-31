# CCGHarness

A coding agent harness kernel that wraps an LLM into a reliable, self-implemented coding agent with guardrails, tool dispatch, memory, feedback loops, and deterministic governance — all built from scratch without agent frameworks.

## Install

### Build from source

```bash
git clone https://github.com/changchanggod/CCGHarness.git
cd CCGHarness
npm install
npm run build
```

### From binary (single executable)

Download the `ccg` binary from the [latest GitHub release](https://github.com/changchanggod/CCGHarness/releases) for your platform:
- Windows: `ccg.exe`
- macOS: `ccg`
- Linux: `ccg`

Make it executable (macOS/Linux):
```bash
chmod +x ccg
```

To build a standalone binary from source:
```bash
npm run build:sea
```

## Run

```bash
# Single task
ccg "rename variable foo to bar in src/app.ts"

# With custom config
ccg --config ./my-project/ccg.yaml "fix the type error"

# Interactive session
ccg --interactive

# Verbose output
ccg --verbose "add unit tests for utils.ts"
```

## Key Configuration

On first run, use the setup command to configure API keys and provider settings:

```bash
ccg setup
```

This stores credentials securely via OS-level credential storage (Windows Credential Manager, macOS Keychain, Linux Secret Service). Never hardcode API keys in config files or source code.

**Configuration files:**
- `ccg.yaml` (or `ccg.example.yaml` as template) — agent behavior, LLM provider, tools, feedback
- `guardrails.yaml` (or `guardrails.example.yaml` as template) — guardrail rules for risk scoring

**Supported LLM providers:**
- OpenAI (GPT-4o, GPT-4.1, etc.)
- Anthropic (Claude Sonnet, Claude Opus, etc.)
- DeepSeek (DeepSeek-V3, DeepSeek-R1, etc.)
- Ollama (local models via `http://localhost:11434`)

## Security Boundaries

- **API keys** are stored in OS-level credential managers (Windows Credential Manager, macOS Keychain, Linux Secret Service), never in plaintext config files or source code
- **Guardrails** intercept dangerous actions (file deletion, force push, package publish) before execution via a deterministic 4-layer pipeline (classifier → risk scorer → HITL approval → sandbox)
- **Sandbox** restricts file system access to the workspace directory and blocks unauthorized commands
- **`.env` files** are supported as a fallback key source but documented as a plaintext risk — process environment is visible to all child processes
- **No credentials** are ever logged, committed to git, or exposed in terminal history

## Directory Structure

```
CCGHarness/
├── src/
│   ├── core/              # Agent main loop, type definitions, response parser
│   ├── providers/         # LLM provider abstraction (OpenAI, Anthropic, Ollama, Mock)
│   ├── tools/             # Tool definitions (read_file, write_file, shell, run_tests, run_lint)
│   ├── governance/        # Guardrails subsystem (classifier, risk scorer, HITL FSM, sandbox, orchestrator)
│   ├── feedback/          # Feedback validators (test output, lint output, typecheck output)
│   ├── memory/            # Conversation history, context compression, project context
│   ├── config/            # YAML configuration loader
│   └── cli/               # CLI entry point, commands, credential setup
├── tests/
│   ├── core/              # Loop and parser tests
│   ├── providers/         # Provider and mock tests
│   ├── tools/             # Tool tests
│   ├── governance/        # Guardrail mechanism tests
│   ├── feedback/          # Validator tests
│   ├── memory/            # Memory and compression tests
│   ├── config/            # Config loader tests
│   ├── cli/               # CLI tests
│   └── demo/              # Mechanism demo tests (guardrail, feedback loop, deep dimension)
├── ccg.example.yaml       # Example configuration template
├── guardrails.example.yaml # Example guardrail rules
├── SPEC.md                # Design document
├── PLAN.md                # Implementation plan
├── AGENT_LOG.md           # Agent interaction log
├── SPEC_PROCESS.md        # Process documentation
└── .github/workflows/     # CI configuration (unit-test job)
```

## Known Limitations

- Requires **Node.js 20+** (uses Node.js Single Executable Applications for binary builds)
- Binary distribution supports Windows, macOS, and Linux (x64)
- Binary build requires `postject` (auto-installed as devDependency)
- Supported LLM providers: OpenAI, Anthropic, DeepSeek, Ollama (local)
- Ollama provider requires a running Ollama service at `http://localhost:11434`
- Shell tool tests use platform-specific commands (Windows `cmd /c`); CI on `ubuntu-latest` may need test adaptation
- `.env` file support is available but documented as a plaintext risk