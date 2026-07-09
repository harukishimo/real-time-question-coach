# General Coding Agent Contracts

このファイルは、一般的な Rails / frontend / docs 系 coding agent の詳細 contract である。

`docs/loop-agent-behavior-contracts.md` の表は summary であり、このファイルを読まずに対象 agent を実装実行してはならない。

## Applies To

- `general_implementer_agent`
- `rails_controller_agent`
- `rails_model_agent`
- `rails_service_agent`
- `rails_helper_agent`
- `grape_api_agent`
- `rails_job_agent`
- `mailer_notification_agent`
- `uploader_storage_agent`
- `view_slim_agent`
- `jquery_behavior_agent`
- `stimulus_js_agent`
- `frontend_asset_agent`
- `form_validation_agent`
- `route_agent`
- `i18n_copy_agent`
- `docs_agent`

## Common Entry Conditions

- L2 / L3 Activation Record exists.
- `approval_scope`, `scope_in`, `scope_out`, `non_goals`, `acceptance_criteria`, `required_checks` are readable.
- `implementation_agent_type` is one of the agents in this file.
- Relevant human gate checks were performed before implementation.
- Selected agent has no stricter contract in a more specific file.

## Common Preflight

Every coding agent must do this before edits:

1. Read `loop-constraints.md` and `loop-human-gates.md`.
2. Read the target AI Work Ticket and approved Kiro tasks when present.
3. Identify exact files likely to change.
4. Check if affected areas include money, billing, PDF, daily lock, KPI, {{ACCOUNTING_SYSTEM}}, DB, auth, external API, config, route, or jQuery.
5. Stop if a specialized domain/data agent is required.
6. Confirm required checks and likely test files.
7. Confirm no unrelated refactor is necessary.

## Common Procedure

1. Inspect existing local pattern before writing.
2. Make the smallest scoped change.
3. Add or update tests when behavior changes.
4. Do not weaken tests.
5. Re-check human gate against the final diff.
6. Produce verifier handoff.

## Common Stop Conditions

- The change requires a domain agent not selected in the agent plan.
- The change requires config, DB, external service, production, secret, or deploy access.
- The scope requires rewriting surrounding architecture.
- jQuery behavior is touched without explicit human gate approval.
- Required checks cannot be identified.

## Verifier Handoff Schema

```yaml
implementation_handoff:
  agent_type:
  ticket_id:
  files_changed:
    - path:
      reason:
      behavior_changed: true | false
  scope_match:
    in_scope:
      - 
    out_of_scope_risk:
      - 
  human_gate_analysis:
    checked_before: true
    checked_after: true
    required: true | false
    reason:
  checks:
    run:
      - command:
        result:
    not_run:
      - command:
        reason:
  residual_risks:
    - 
```

## Agent-Specific Rules

### `general_implementer_agent`

Use only when:

- no specialized agent matches;
- risk is low;
- no strict human gate area is implicated;
- change is small and local.

Must stop when:

- affected area includes money, PDF, DB, auth, external API, jQuery behavior, daily lock, KPI, {{ACCOUNTING_SYSTEM}}, reservation, billing, config, or route.

### `rails_controller_agent`

Preflight:

- Identify route, action, params, before_action, auth, response type, redirect/render behavior.
- Check controller specs or request specs.

Must not:

- Add or alter route unless `route_agent` is part of the plan.
- Change auth boundary without `auth_permission_agent`.
- Change persistence or calculation rules that belong in model/service/domain agents.

Output must include:

- action behavior matrix;
- params added/removed;
- auth/before_action impact;
- request/controller spec evidence.

### `rails_model_agent`

Preflight:

- Identify validations, associations, callbacks, scopes, and persistence side effects.
- Check DB/schema impact.

Must not:

- Add migration or schema change without `db_schema_agent`.
- Change money, lock, reservation, or KPI rules without domain agent.
- Add callbacks that trigger external state without approval.

Output must include:

- model invariant before/after;
- validation matrix;
- affected factories/specs.

### `rails_service_agent`

Preflight:

- Map callers, inputs, outputs, errors, side effects, transaction behavior.
- Check if service touches money, PDF, {{ACCOUNTING_SYSTEM}}, external API, or DB mutation.

Must not:

- Hide domain behavior inside a generic service edit.
- Call external API in tests.

Output must include:

- service flow;
- side-effect map;
- branch/error handling matrix.

### `rails_helper_agent`

Must distinguish:

- presentation-only formatting;
- business-meaning display;
- accounting/legal/PDF/money text.

If display text affects legal/accounting interpretation, escalate to human gate.

### `grape_api_agent`

Preflight:

- Identify endpoint, auth, serializer, response schema, consumers, backward compatibility.

Must not:

- Change public response contract without explicit approval.
- Expose new data without security review.

### `rails_job_agent`

Preflight:

- Identify enqueue path, retry behavior, idempotency, external side effects.

Must not:

- Change schedule or production processing behavior without human gate.

### `mailer_notification_agent`

Preflight:

- Identify recipient, trigger, template, personal data, delivery condition.

Must not:

- Change recipient logic or send timing without explicit approval.

### `uploader_storage_agent`

Preflight:

- Identify allowed file types, size, validation, storage path, retention, security checks.

Must not:

- Broaden accepted files without security review.

### `view_slim_agent`

Preflight:

- Identify related controller/action, form fields, JS bindings, data attributes, remote behavior.

Must not:

- Change `data-*`, `remote`, selector ids/classes, form names, or event targets without checking `jquery_behavior_agent` / `compatibility_review_agent`.
- Treat money/PDF/legal copy as safe without meaning check.

### `jquery_behavior_agent`

This is strict human gate by default.

Preflight:

- Map selectors, event order, Ajax requests, DOM mutations, shared state, affected views.
- Identify existing screens that share selectors/classes.

Must output:

```yaml
js_behavior_map:
  selectors_changed:
    - 
  events_changed:
    - 
  ajax_calls_changed:
    - 
  shared_state_risk:
  affected_screens:
  manual_or_system_checks:
```

### `stimulus_js_agent`

Must check legacy jQuery interaction before edits.

### `frontend_asset_agent`

Must distinguish visual-only CSS from behavior-affecting layout or PDF output changes.

### `form_validation_agent`

Must output validation matrix:

```yaml
validation_matrix:
  field:
  server_rule:
  client_rule:
  error_message:
  negative_cases:
```

Must not weaken validation.

### `route_agent`

Allowed only for explicitly scoped new route additions.

Must stop when:

- existing route changes;
- namespace/mount/auth exposure changes;
- route affects API exposure.

### `i18n_copy_agent`

Allowed for text-only changes.

Must escalate when:

- copy changes legal/accounting meaning;
- copy affects money/PDF/approval/contract interpretation.

### `docs_agent`

Must not change code behavior.

Policy docs changes require human-visible summary and should not silently change operational authority.
