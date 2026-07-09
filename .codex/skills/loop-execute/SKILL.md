---
name: loop-execute
description: >
  Execute Realtime Question Coach L2/L3 activated AI Work Tickets. Use when an AI Work Ticket has a valid Activation Record and Codex must create or use an approved branch, implement only the approved scope, run required checks, update allowed spreadsheet execution fields, hand off to the verifier agent, prepare PR packages, or invoke CodeCommit PR/comment agents under L3 authorization. Never use for L1 daily-triage, unapproved tickets, merge, deploy, production, secrets, or scope expansion.
---

# Loop Execute Skill

Execute an AI Work Ticket only when L2 or L3 has been explicitly activated for that ticket.

`daily-triage` is a Loop Pattern, not an implementation agent. This skill is the L2/L3 execution path used after Orchestrator Agent validates an Activation Record.

## Read Order

Read these before any action:

1. `LOOP.md`
2. `loop-constraints.md`
3. `loop-human-gates.md`
4. `loop-budget.md`
5. `loop-run-log.md`
6. `STATE.md`
7. `docs/loop-autonomy-contract.md`
8. `docs/loop-execution-contract.md`
9. `docs/loop-agent-registry.md`
10. `docs/loop-agent-behavior-contracts.md`
11. Matching detailed contract under `docs/loop-agent-contracts/`
12. `docs/codecommit-pr-contract.md`
13. `docs/ai-work-ticket-contract.md`
14. `docs/ai-work-ticket-spreadsheet-schema.md`
15. Target AI Work Ticket row
16. Related `.kiro/specs/` requirements / design / tasks when present
17. `.codex/agents/verifier.toml`

## Hard Boundaries

- Do not run without a valid Activation Record for the target ticket.
- Do not run if the selected implementation agent profile only has the summary row in `docs/loop-agent-behavior-contracts.md`.
- Do not run if the matching detailed contract under `docs/loop-agent-contracts/` cannot be read.
- Do not implement outside `approval_scope`, `scope_in`, and accepted Kiro tasks.
- Do not change `scope_out`, `non_goals`, source fields, risk fields, or acceptance criteria.
- Do not proceed if `loop-human-gates.md` cannot be checked before implementation and before verifier handoff.
- Do not read or edit secrets, credentials, production data, production console, deploy or release configuration.
- Do not edit deny-list paths or external API service / connector files.
- Do not perform destructive git operations: no `git reset --hard`, `git checkout --`, force push, or shared-history rewrite.
- Do not merge, deploy, release, close tickets, close PRs, or mark ready for review without explicit human approval.
- Do not weaken tests to make them pass.

## Activation Check

Confirm:

- `approved_level` is `L2` or `L3`.
- `ticket_id`, `approval_scope`, `base_branch`, `branch_name`, `max_fix_attempts`, `expires_at` are present.
- `agent_plan` is present and its agent types match `docs/loop-agent-registry.md` and `docs/loop-agent-behavior-contracts.md`.
- `agent_plan` includes `autonomy_level`, `execution_mode`, `primary_agent_type`, `supporting_agent_types`, `review_agent_types`, `coordination_agent_types`, `allowed_mutations`, and `why_this_agent_plan`.
- When `execution_mode` is `implementation`, `implementation_agent_type` matches `agent_plan.primary_agent_type`.
- When `execution_mode` is `verification` or `repo_action`, review/repository action agents are only in `agent_plan`, not `implementation_agent_type`.
- The approval has not expired.
- `human_gate_required = false` or `human_gate_status = approved`.
- `allowed_actions` covers the intended action.
- L3-only actions, such as CodeCommit PR creation or reviewer comment posting, are explicitly allowed.

If any item is missing, stop and write a human-facing reason to the spreadsheet and `loop-run-log.md`.

## Workflow

1. Validate Activation Record, constraints, budget, and stop conditions.
2. Inspect `git status` and identify unrelated changes.
3. Stop if unrelated dirty changes would be overwritten or mixed into the ticket.
4. Create or use the approved branch.
5. Re-check `loop-human-gates.md` immediately before implementation.
6. Implement only the approved scope.
7. Run required checks from the AI Work Ticket and any relevant Kiro task.
8. Re-check `loop-human-gates.md` against the final diff.
9. Update allowed spreadsheet execution fields.
10. Hand off to verifier using `.codex/agents/verifier.toml`.
11. If verifier returns `REJECT`, fix only within `max_fix_attempts`.
12. If verifier returns `ESCALATE_HUMAN`, stop and set human gate fields.
13. If verifier returns `APPROVE`, prepare PR package.
14. In L3 only, invoke codecommit_pr_agent or codecommit_comment_agent for AWS CodeCommit commands when explicitly allowed by Activation Record and `docs/codecommit-pr-contract.md`.

## L2 Behavior

L2 may:

- create or use the approved branch;
- edit code, tests, and docs inside scope;
- run tests and checks;
- update canonical execution fields in the AI Work Ticket spreadsheet;
- ask verifier to review;
- prepare PR title and description.

L2 must not execute CodeCommit PR creation or reviewer comment commands. It may only prepare the command payload for human approval.

## L3 Behavior

L3 may do everything L2 can do and additionally:

- perform verifier/test remediation within `max_fix_attempts`;
- invoke codecommit_pr_agent to create a CodeCommit PR via AWS command when `codecommit_pr_creation_allowed: true`;
- invoke codecommit_comment_agent to post reviewer comments to the CodeCommit PR via AWS command when `codecommit_reviewer_comment_allowed: true`;
- update PR draft text or review notes when explicitly allowed.

L3 still must not merge, deploy, release, approve its own PR, close tickets, or mark ready for review without explicit human approval.

Before invoking codecommit_pr_agent, record a repo action agent plan:

```yaml
agent_plan:
  autonomy_level: L3
  execution_mode: repo_action
  primary_agent_type: codecommit_pr_agent
  supporting_agent_types:
    - pr_package_agent
  review_agent_types:
    - verifier
  coordination_agent_types: []
  allowed_mutations:
    - codecommit_pr
  why_this_agent_plan:
```

Before invoking codecommit_comment_agent, record a repo action agent plan:

```yaml
agent_plan:
  autonomy_level: L3
  execution_mode: repo_action
  primary_agent_type: codecommit_comment_agent
  supporting_agent_types: []
  review_agent_types:
    - verifier
  coordination_agent_types: []
  allowed_mutations:
    - codecommit_reviewer_comment
  why_this_agent_plan:
```

Do not reuse an implementation agent plan for CodeCommit repo actions.

## CodeCommit Command Guard

Before any AWS CodeCommit command, confirm the command is non-production-safe and Activation Record allows it.

Allowed in L3 only:

- `aws codecommit create-pull-request` or equivalent PR creation command.
- `aws codecommit post-comment-for-pull-request` or equivalent reviewer comment command.
- `aws codecommit post-comment-reply` when replying to an existing review thread is explicitly allowed.

Never run AWS commands that change deploy, pipeline, build, production, secrets, permissions, repository settings, branch protections, merge state, approval rules, or PR status beyond comment / PR creation explicitly allowed here.

Follow `docs/codecommit-pr-contract.md` for repository name, region, AWS profile handling, branch naming, PR title, PR description, draft-equivalent policy, and required human approval.

Log every AWS command payload and result summary in `loop-run-log.md`. Do not paste secrets or credential material.

## Spreadsheet Updates

Use L2/L3 permissions from `docs/loop-autonomy-contract.md`.

Allowed execution updates include:

- `status`
- `next_owner`
- `work_type`
- `suggested_next_action`
- `kiro_required`
- `implementation_agent_type`
- `allowed_autonomy`
- `branch_required`
- `verifier_required`
- `verification_result`
- `verification_evidence`
- `done_criteria_met`
- `done_evidence`
- `ai_comment_*`
- `decision_needed`
- `triage_notes`
- `last_loop_run_id`
- `approved_autonomy`
- `approved_by`
- `approved_at`
- `approval_source`
- `approval_scope`
- `approval_expires_at`
- `max_fix_attempts`
- `human_gate_status`
- `branch_name`
- `base_branch`
- `destination_branch`
- `commit_sha`
- `codecommit_repository_name`
- `codecommit_region`
- `aws_profile_name`
- `codecommit_pr_creation_allowed`
- `codecommit_reviewer_comment_allowed`
- `pr_id`
- `pr_url`
- `implementation_started_at`
- `implementation_completed_at`
- `verifier_verdict`
- `verifier_notes`
- `merge_approval_status`

Do not update ticket body fields such as `source_*`, `overview`, `background_purpose`, `scope_*`, `risk_*`, or `acceptance_criteria`.

Approval columns such as `approved_by`, `approved_at`, `approval_scope`, and `approved_autonomy` may only reflect an existing human approval. Do not invent or expand approval.

## Verifier Handoff

Pass verifier:

- ticket id and title;
- Activation Record;
- approval scope;
- changed files;
- relevant diff summary;
- commands run and outputs;
- known unable-to-run checks;
- human gate analysis;
- deny list analysis;
- pre-implementation and post-implementation `loop-human-gates.md` result;
- CodeCommit PR package if prepared.

Verifier returns `APPROVE`, `REJECT`, or `ESCALATE_HUMAN`.

## Run Log

Append an `execution_run` entry following `docs/loop-execution-contract.md`.

Always include:

- Activation Record summary;
- branch;
- files changed;
- tests/checks;
- verifier result;
- spreadsheet updates;
- CodeCommit PR creation result when run;
- reviewer comments posted when run;
- human gate status;
- abort reason, if stopped.

## Completion Check

Before stopping:

- branch state is clear and reported;
- no unrelated change was touched;
- tests/checks are recorded;
- verifier result is recorded;
- spreadsheet updates are recorded;
- PR package or PR URL is recorded when applicable;
- human gate or next owner is clear.
