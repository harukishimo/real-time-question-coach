# Repository Action Agent Contracts

このファイルは repository action agent の詳細 contract である。

## Applies To

- `codecommit_pr_agent`
- `codecommit_comment_agent`
- `changelog_agent`
- `pr_package_agent`

## Common Entry Conditions

- Repository action is explicitly in `agent_plan.execution_mode = repo_action`, or it is L1/L2 draft-only.
- Implementer and verifier have completed their required handoff when action depends on implementation.
- No merge, approve, close, ready-for-review, deploy, release, or production operation is allowed.

## `codecommit_pr_agent`

The detailed runtime source is `.codex/agents/codecommit_pr_agent.toml`.

Additional output must include:

```yaml
codecommit_pr_result:
  ticket_id:
  repository_name:
  region:
  source_branch:
  destination_branch:
  title:
  draft_equivalent: true
  command_executed: true | false
  pr_id:
  pr_url:
  evidence:
```

## `codecommit_comment_agent`

The detailed runtime source is `.codex/agents/codecommit_comment_agent.toml`.

Comment must be evidence-based and must not approve, resolve, close, merge, or mark ready.

## `pr_package_agent`

### Entry Conditions

- verifier evidence exists or L2 draft package is requested.
- changed files and checks are known.
- human gate status is known.

### Procedure

1. Build PR title from ticket id and outcome.
2. Build description with scope, changes, checks, risks, and human gate status.
3. Include draft-equivalent warning for CodeCommit.
4. Include `Do not merge without explicit human approval.`
5. Include reviewer notes and known limitations.
6. Do not run PR command.

### PR Package Schema

```yaml
pr_package:
  title:
  description:
  ticket_id:
  branch_name:
  base_branch:
  changed_files:
    - 
  scope_summary:
  checks:
    run:
      - 
    not_run:
      - check:
        reason:
  verifier_verdict:
  human_gate_status:
  known_risks:
  reviewer_notes:
  draft_equivalent:
    title_prefix: "[DRAFT]"
    description_status: "Status: Draft"
    merge_warning: "Do not merge without explicit human approval."
```

### Must Not

- Execute AWS command.
- Decide merge readiness.
- Hide missing checks.
- Omit human gate result.

## `changelog_agent`

### Entry Conditions

- release range, commits, PR package, or ticket summaries are available.
- release-facing wording is draft unless human-approved.

### Procedure

1. Classify changes: user-facing, internal, bug fix, migration, dependency, security, breaking.
2. Preserve uncertainty.
3. Mark human review required for release-facing, security, breaking, migration, DB, KPI/management, external API, {{ACCOUNTING_SYSTEM}}/accounting, money, or PDF items.
4. Produce changelog draft only.

### Output Schema

```yaml
changelog_draft:
  range:
  entries:
    - type:
      summary:
      tickets:
      human_review_required: true | false
      risk_note:
  omitted:
    - item:
      reason:
  release_notes:
  human_questions:
```

### Must Not

- Create tag.
- Publish release.
- Deploy.
- Convert draft to official release note without human approval.
