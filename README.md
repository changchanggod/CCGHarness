# CCGHarness

A coding agent harness kernel that wraps an LLM into a reliable, self-implemented coding agent with guardrails, tool dispatch, memory, feedback loops, and deterministic governance — all built from scratch without agent frameworks.

## Install

### From npm (global install)

```bash
npm install -g
```

### From binary (single executable)

Download the `ccg` binary from the latest GitHub release for your platform:
- Windows: `ccg.exe`
- macOS: `ccg`
- Linux: `ccg`

Make it executable (macOS/Linux):
```bash
chmod +x ccg
```

### Build from source

```bash
npm install
npm run build
```

To build a standalone binary:
```bash
npm run build:sea
```

## Run

```bash
# Single task
ccg "rename variable foo to bar in src/app.ts"

# Interactive session
ccg --interactive

# Run a task from a file
ccg --task-file my-task.txt
```

## Key Configuration

On first run, use the setup command to configure API keys and provider settings:

```bash
ccg setup
```

This stores credentials securely via OS-level credential storage (Windows Credential Manager, macOS Keychain, Linux Secret Service).

Configuration files:
- `ccg.yaml` — agent configuration
- `guardrails.yaml` — guardrail rules

## Known Limitations

- Requires **Node.js 20+** (uses Node.js Single Executable Applications)
- Binary distribution supports Windows, macOS, and Linux
- Binary build requires `postject` (auto-installed as devDependency)
- Not all LLM providers are supported; currently supports OpenAI and Anthropic APIs
- `.env` file support is available but documented as a plaintext risk