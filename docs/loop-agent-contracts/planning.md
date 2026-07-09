# Planning Agent Contracts

このファイルは、Planning Agents が実行時に従う詳細 contract である。

`docs/loop-agent-behavior-contracts.md` の表は summary であり、このファイルを読まずに Planning Agent を実行してはならない。

## Applies To

- `kiro_requirements_agent`
- `kiro_design_agent`
- `kiro_tasks_agent`
- `agent_planner_agent`
- `scope_guard_agent`

## Common Entry Conditions

Planning Agent は次を満たす場合だけ起動する。

- `agent_plan.execution_mode` が `read_only`, `report_only`, `implementation` のいずれかで、agent の役割が planning に限定されている。
- 対象 AI Work Ticket が存在する。
- `scope_in`, `scope_out`, `acceptance_criteria`, `unknowns`, `risk_reasons` を読める。
- Kiro phase に関わる場合は、現在 phase と承認済み artifact が明確である。
- L1 では draft / proposal / question 作成までで、canonical ticket field や spec file を確定更新しない。

## Common Stop Conditions

次の場合は停止し、Orchestrator Agent へ返す。

- AI Work Ticket の目的、scope、acceptance criteria が読めない。
- 人間承認済みと未承認 draft の区別ができない。
- requirements / design / tasks のどの phase にいるか不明である。
- planning を超えて実装判断、branch 作成、code edit が必要である。
- human gate が必要なのに承認がない。
- `scope_out` を変更しないと進められない。

## Kiro Phase State Machine

Kiro 関連 agent は次の phase を越境しない。

```text
idea_or_ticket
  -> requirements_draft
  -> requirements_approved
  -> design_draft
  -> design_approved
  -> tasks_draft
  -> tasks_approved
  -> ready_for_implementation
```

許可される遷移:

| Agent | May create | Requires before creation | Must not mark approved |
| --- | --- | --- | --- |
| `kiro_requirements_agent` | requirements draft | AI Work Ticket with enough source and scope | yes |
| `kiro_design_agent` | design draft | approved requirements | yes |
| `kiro_tasks_agent` | tasks draft | approved requirements and approved design | yes |

`approved` は人間だけが与える。

## Common Output Schema

Planning Agent は次の形で返す。

```yaml
planning_result:
  agent_type:
  ticket_id:
  phase:
  input_status:
    sufficient: true | false
    missing_fields: []
    unapproved_artifacts: []
  draft_artifact:
    type: requirements | design | tasks | agent_plan | scope_review
    summary:
    body:
  questions_for_human:
    - field:
      question:
      why_needed:
      blocking_level: blocker | non_blocking
      default_assumption: none | text
  human_gate:
    required: true | false
    reason:
  next_owner:
  recommended_next_status:
  handoff_notes:
```

## `kiro_requirements_agent`

### Required Inputs

- `problem`
- `current_state`
- `desired_state`
- `scope_in`
- `scope_out`
- `acceptance_criteria`
- `unknowns`
- `source_summary`
- related source / evidence links when present

### Procedure

1. Confirm the ticket is not raw human request.
2. Extract functional requirements from `desired_state`.
3. Separate non-goals from `scope_out`.
4. Convert acceptance criteria into testable requirement statements.
5. Identify missing decisions as questions, not assumptions.
6. Mark every unresolved requirement with `needs_human_decision`.
7. Return a requirements draft and do not mark it approved.

### Must Not

- Create design or tasks.
- Decide requirements approval.
- Add new product scope not present in ticket or source evidence.
- Treat `unknowns: none` as true if evidence contradicts it.

### Good Output

- Requirements are traceable to ticket fields.
- Each ambiguity has a field-specific question.
- Non-goals are preserved.

### Bad Output

- "Implement FAQ management" without access, validation, data, and non-goal requirements.
- Requirements that silently add CSV export, search, or analytics.

## `kiro_design_agent`

### Required Inputs

- approved requirements
- affected areas
- existing code evidence
- constraints and human gates
- data / API / UI / permission requirements

### Procedure

1. Verify requirements are approved.
2. Map components, data flow, UI flow, and permission checks.
3. Identify Realtime Question Coach-specific gates: jQuery, money, PDF, daily lock, KPI, {{ACCOUNTING_SYSTEM}}, DB, external API, config.
4. Define implementation boundaries and forbidden refactors.
5. Define verification approach.
6. Return design draft and human gate candidates.

### Must Not

- Create design from unapproved requirements.
- Hide human gate areas.
- Choose a new architecture pattern when existing code has a local pattern.

## `kiro_tasks_agent`

### Required Inputs

- approved requirements
- approved design
- acceptance criteria
- required checks
- agent registry and behavior contracts

### Procedure

1. Verify requirements and design are approved.
2. Split tasks into independently reviewable implementation steps.
3. Attach expected primary / supporting / review agents to each task.
4. Attach minimum checks and evidence per task.
5. Mark human gate tasks explicitly.
6. Return tasks draft and suggested `agent_plan`.

### Must Not

- Mark tasks approved.
- Include out-of-scope cleanup.
- Put high-risk domain changes under `general_implementer_agent`.

## `agent_planner_agent`

### Required Inputs

- `scope_in`
- `scope_out`
- `affected_areas`
- `risk_level`
- `risk_reasons`
- `required_checks`
- detailed requirements / Kiro tasks when present
- `docs/loop-agent-registry.md`
- all relevant files under `docs/loop-agent-contracts/`

### Procedure

1. Identify primary work type.
2. Check high-risk signals before selecting a generic agent.
3. Select primary agent.
4. Add supporting agents for cross-boundary work.
5. Add review agents based on risk.
6. Add `human_gate_review_agent` if any strict or ambiguous gate exists.
7. Build full `agent_plan` with `autonomy_level`, `execution_mode`, `allowed_mutations`, and rationale.
8. Return why other obvious agents were not selected.

### Decision Rules

- Money, billing, tax, total, rounding -> include `money_calculation_agent`.
- PDF generation/output -> include `pdf_report_agent`.
- jQuery selectors/events/Ajax/shared UI state -> include `jquery_behavior_agent` and `compatibility_review_agent`.
- DB schema/data mutation -> include `db_schema_agent` or `data_migration_script_agent`.
- Auth/role/permission -> include `auth_permission_agent` and `security_review_agent`.
- Reservation, room, event, availability, cancellation -> include `reservation_domain_agent`.
- Daily lock, locked data, post-lock edit -> include `daily_lock_agent`.
- KPI, management, aggregation, executive report -> include `kpi_management_agent`.
- {{ACCOUNTING_SYSTEM}}, accounting master, customer code, journal -> include `bugyo_accounting_agent`.
- External API, connector, webhook, third-party side effect -> include `external_api_agent`.
- Config, initializer, environment, schedule -> include `config_agent` or `batch_rake_agent` and `human_gate_review_agent`.
- Route addition -> include `route_agent`; route mutation or exposure change also requires `security_review_agent`.
- Unclear gate -> include `human_gate_review_agent`.

### Must Not

- Use `general_implementer_agent` when a domain-specific agent matches.
- Omit verifier for implementation.
- Omit human gate review for strict gate domains.

## `scope_guard_agent`

### Required Inputs

- `scope_in`
- `scope_out`
- `non_goals`
- acceptance criteria
- proposed plan or diff

### Procedure

1. List allowed behavior changes.
2. List explicitly forbidden or out-of-scope changes.
3. Compare proposed work or diff against both lists.
4. Classify each issue as allowed, out_of_scope, unclear, or needs_human.
5. Return allowed scope and blocked scope.

### Output Requirements

```yaml
scope_guard_result:
  allowed_scope:
    - 
  blocked_scope:
    - item:
      reason:
      evidence:
  unclear_scope:
    - item:
      question_for_human:
  verdict: within_scope | out_of_scope | needs_human
```
