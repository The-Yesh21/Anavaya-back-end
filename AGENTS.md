# AGENTS.md

Project guidance for coding agents lives in [`CLAUDE.md`](CLAUDE.md) — read that first.
Current state and the change log are in [`PROJECT_HANDOFF.md`](PROJECT_HANDOFF.md).

Two rules that are easy to break and expensive to debug:

- **The LLM never decides priority.** It extracts and summarizes only; the Decision Tree
  alone assigns High/Medium/Low, and the constitutional analysis is rule-based.
- **Run every command from the repo root** (`F:\major_project`), never from inside
  `case_priority_system/` — the scripts use the `case_priority_system/` path prefix.
