# Review, Coordination, And Verification Agent Contracts

このファイルは review / coordination / verification agent の詳細 contract である。

## Applies To

- `adversarial_review_agent`
- `security_review_agent`
- `human_gate_review_agent`
- `performance_review_agent`
- `compatibility_review_agent`
- `behavior_contract_review_agent`
- `purple_coordination_agent`
- `verifier`

## Common Entry Conditions

- Target plan, diff, or agent output is available.
- Scope and acceptance criteria are available.
- Review agent has no implementation responsibility.
- Findings must include evidence.

## Mandatory Completion Review Gate

AI Work Ticket または MVP作業単位を `done` にする前に、次の gate を必ず満たす。

```yaml
completion_review_gate:
  red_team:
    agent_type: adversarial_review_agent
    required: true
    required_verdict: APPROVE
  qa:
    agent_type: qa_agent
    required: true
    required_status: passed
  tester:
    agent_type: tester_agent
    required: true
    required_status: passed
  purple_team:
    agent_type: purple_coordination_agent
    required_when_findings_exist: true
  verifier:
    required: true
    required_verdict: APPROVE
```

`APPROVE_WITH_MINOR_NOTES` は Red Team gate の合格として扱わない。minor notes がある場合でも、scope内で修正して再レビューするか、明示的に残リスクと人間判断へ送る。

## Severity Rubric

| Severity | Meaning | Default next action |
| --- | --- | --- |
| high | unsafe, scope-breaking, unapproved human gate, data/security risk | `ESCALATE_HUMAN` or block |
| medium | likely defect or missing evidence that can be fixed in scope | `REJECT` |
| low | minor maintainability or clarity issue | fix if cheap or note |
| info | observation only | no block |

## Common Review Output

```yaml
review_result:
  agent_type:
  target:
  verdict: APPROVE | REJECT | ESCALATE_HUMAN | L1_FINDING
  findings:
    - severity:
      category:
      detail:
      evidence:
      required_action:
      can_fix_within_scope: true | false
  scope_assessment:
  human_gate_assessment:
  recommended_next_owner:
  handoff:
```

## Agent-Specific Rules

### `adversarial_review_agent`

Focus:

- scope creep;
- missing acceptance criteria;
- weak tests;
- risky implicit behavior;
- unrelated refactor.
- unsupported completion claim;
- missing QA / Tester evidence;
- storage, logging, security, permission, provider boundary assumptions that were not tested.

Must not:

- rewrite implementation.
- assume benevolent interpretation when evidence is missing.

Completion verdict rule:

- Return `APPROVE` only when the implementation evidence, QA result, Tester result, and scope evidence are sufficient.
- Return `REJECT` when missing tests or missing evidence can be fixed within scope.
- Return `ESCALATE_HUMAN` when the missing evidence implies human gate, scope expansion, secret, production, or provider credential work.

### `security_review_agent`

Focus:

- auth;
- permission;
- PII;
- upload;
- unsafe redirect;
- mass assignment;
- external API exposure;
- secrets.

High severity by default for privilege expansion or PII exposure.

### `human_gate_review_agent`

Must read `loop-human-gates.md`.

Procedure:

1. Identify functional impact, not only path.
2. Check strict gate domains.
3. Check text-only exceptions for money/PDF.
4. If uncertain, return `ESCALATE_HUMAN`.

Output:

```yaml
human_gate_review:
  required: true | false
  strict_domain:
  reason:
  exception_applied:
  decision_needed:
```

### `performance_review_agent`

Focus:

- N+1;
- heavy query;
- batch/export cost;
- aggregation correctness;
- missing indexes.

Must not declare safe without measurement or a concrete check plan.

### `compatibility_review_agent`

Focus:

- legacy jQuery;
- selectors;
- DOM state;
- CSS/view interaction;
- browser compatibility;
- vendor assets.

Must distinguish visual-only from behavior-changing UI modifications.

### `behavior_contract_review_agent`

Focus:

- whether agent definitions constrain behavior;
- missing entry conditions;
- missing output schema;
- conflicting responsibilities;
- insufficient stop conditions.

Must not edit files.

### `purple_coordination_agent`

Use when coding and review findings conflict.

Procedure:

1. Collect implementer claim.
2. Collect review findings.
3. Classify each finding as fix_in_scope, needs_human, needs_kiro, or reject_as_invalid.
4. Decide next owner.
5. Do not edit code unless separately authorized as a coding agent.
6. Do not downgrade Red Team / QA / Tester failures into informational notes.

### `verifier`

`verifier` follows `.codex/agents/verifier.toml`.

This file adds:

- verifier must check that selected detailed contract was read or referenced in handoff;
- verifier rejects if high-risk profile used only the summary table;
- L1 verifier returns `L1_FINDING`, not implementation approval.
- verifier rejects if Red Team verdict is missing or not `APPROVE`;
- verifier rejects if QA Agent result is missing or not `passed`;
- verifier rejects if Tester Agent result is missing or not `passed`;
- verifier rejects if trial results omit command, test file, fixture, environment, pass/fail/not_run, or not_run residual risk.
