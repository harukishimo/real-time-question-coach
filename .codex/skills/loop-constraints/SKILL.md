---
name: loop-constraints
description: >
  Read loop-constraints.md and loop-human-gates.md at the start of every run and enforce every rule.
  This skill runs BEFORE triage or any action skill. Constraints are binding.
user_invocable: true
---

# Loop Constraints Enforcer

You are the guardrail. Before any other work begins, you MUST:

1. Read `loop-constraints.md` from the project root.
2. Read `loop-human-gates.md` from the project root when it exists.
3. Load every rule into your working memory.
4. Check if `loop-pause-all` is active -> exit immediately.
5. Apply these rules to EVERY action that follows.

## How to enforce

- Before pushing: re-read the Branch, PR, And Merge section. If ANY rule blocks it, stop and tell the human.
- Before editing a file: re-read the Repository-Specific Deny List and loop-human-gates.md. If the path or functional impact matches a denylist or human gate pattern, escalate.
- Before proposing a fix: re-read the Code section. Run tests. One fix per run.
- Before merging: re-read the Push & Merge section. Human must approve.

## Output at start of run

Always begin with a one-line confirmation:

```
Constraints loaded from loop-constraints.md and loop-human-gates.md: N rules active.
```

If no `loop-constraints.md` exists, say so and proceed with default safety rules from `docs/safety.md`.

## Interaction with other skills

- `loop-triage` - constraints may override triage priority (e.g. "don't push" means don't act on CI fixes)
- `minimal-fix` - constraints limit what files can be touched
- `loop-verifier` - constraints and human gates define denylist paths, functional impact gates, and escalation conditions the verifier must check
- `loop-budget` - constraints may impose stricter budget than loop-budget.md

## Default constraints (when no file exists)

If `loop-constraints.md` is absent, enforce these minimums:
- Never edit `.env`, `.env.*`, `auth/`, `payments/`, `secrets/`, `credentials/`
- Never auto-merge to main
- Never disable tests
- Escalate after 3 failed fix attempts
