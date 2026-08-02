# AGENTS.md — CCGHarness

## What this is

AI4SE final project (NJU, solo) — Track A: **Coding Agent Harness**. Build a harness kernel from scratch that wraps an LLM into a reliable coding agent. The project has no source code yet; it is in the spec/plan phase.

## Governing documents

The full requirements are the concatenation of:
- `AI4SE_Final_Project_通用要求.md` (general requirements)
- `AI4SE_Final_Project_A_Coding_Agent_Harness(1).md` (Track A specifics)

Read both before doing anything. These are the source of truth for all deliverables.

## Development methodology (hard constraints)

Superpowers workflow, enforced in order:

1. **brainstorming** → produce `SPEC.md`
2. **writing-plans** → produce `PLAN.md`
3. **Cold-start validation** — hand SPEC+PLAN to a *different* agent type, without sharing conversation history. Record findings in `SPEC_PROCESS.md`.
4. **Only then** begin implementation. No implementation code before SPEC+PLAN are done and validated.
5. Implementation: **git worktrees** per feature, **subagent-driven** per task, **TDD** (red-green-refactor) mandatory.
6. **requesting-code-review** after each task, **finishing-a-development-branch** to merge.

## Critical architectural rules

- **The agent main loop must be self-implemented.** Do NOT use LangChain `AgentExecutor`, AutoGen, CrewAI, or any agent framework's built-in runner. Using low-level LLM API calls, HTTP libraries, parsers is fine — assembling them into the loop/guardrails/feedback must be your code.
- **Mechanisms = code, not prompts.** A guardrail is a deterministic `guardrail(action)` function, not a system prompt saying "be careful." A feedback signal is a validator/sensor you coded, not "LLM, check your own work."
- **The "remove LLM and test" standard** — every core mechanism (tool dispatch, guardrails, feedback loop, memory, halt detection) must be verifiable with a mock/stub LLM in deterministic unit tests. If a mechanism only works with a real LLM, it does not count as implemented.
- **Six dimensions** — Decision (loop), Tools, Memory, Governance, Feedback, Configuration — all must have a minimal runnable implementation. Pick ONE dimension to go deep on as the main contribution.

## Deliverables (all required)

| File | Purpose |
|------|---------|
| `SPEC.md` | Design doc (10+ sections, see general requirements §4.2) |
| `PLAN.md` | Granular task list with dependencies, file paths, verification steps |
| `SPEC_PROCESS.md` | Brainstorming nodes, cold-start validation results, spec revisions |
| `AGENT_LOG.md` | Timestamped log of agent interactions, skills used, human interventions |
| `REFLECTION.md` | 1500–2500 word critical reflection |
| `README.md` | Install, run, distribution commands, directory structure, security boundaries |
| CI config | GitHub Actions workflow with a job named `unit-test` |
| Source | Harness kernel + mock-LLM unit tests + mechanism demo (§A.6) |
| Distribution | Dockerfile, binary build script, or package config |

## Credential security

- API keys: never hardcoded, never in git, never in logs/shell history.
- Use OS-level secure storage (Windows Credential Manager, macOS Keychain, Linux Secret Service).
- First-run interactive setup flow to securely input keys.
- `.env` files acceptable but must document the plaintext risk.

## Repository rules

- Public GitHub repo, complete commit + PR history (no single-commit submissions).
- Each worktree = one PR. Mark subagent attribution in commit messages.
- Update `PLAN.md` with commit hashes as tasks complete.
- No real credentials anywhere in the repo — check before every commit.

## Mechanism demo

Must deterministically demonstrate under mock LLM:
1. A guardrail intercepting a dangerous action
2. A feedback loop receiving a failure and adjusting the next action
3. One deep-dimension behavior (your main contribution)