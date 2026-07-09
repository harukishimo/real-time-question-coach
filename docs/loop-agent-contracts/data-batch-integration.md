# Data, Batch, And Integration Agent Contracts

このファイルは、DB、script、batch、CSV、external API、config、dependency を扱う agent の詳細 contract である。

## Applies To

- `db_schema_agent`
- `data_migration_script_agent`
- `script_processing_agent`
- `seed_master_agent`
- `csv_import_agent`
- `excel_export_agent`
- `batch_rake_agent`
- `external_api_agent`
- `aws_infra_agent`
- `dependency_agent`
- `config_agent`

## Common Entry Conditions

- L2 / L3 Activation Record exists.
- Human gate status is approved for DB, data mutation, external API, config, infrastructure, or master data.
- Target environment is non-production.
- Production execution, production console, and production data are outside Loop autonomous scope. Even if a human asks about production, the agent stops and hands off to human management instead of executing.
- No credentials or production data are required.
- Dry-run or non-mutating verification path is available for data/script/batch work.

## Common Stop Conditions

- Production data or production console is needed.
- Production execution is requested.
- Credentials, tokens, private keys, or secrets are needed.
- A destructive command is required.
- Rollback/abort plan is unknown.
- Affected rows or data scope cannot be estimated.
- External service mutation is required without explicit approval.
- Config change is broader than approved route-only exception.

## Required Data Operation Output

```yaml
data_operation_plan:
  agent_type:
  target:
  environment_assumption:
  data_scope:
  affected_rows_estimate:
  dry_run:
    available: true | false
    command:
    expected_output:
  mutation:
    required: true | false
    approved: true | false
  rollback_or_abort:
  idempotency:
  safety_checks:
    - 
  human_gate:
    required: true | false
    reason:
  handoff_target:
```

## `db_schema_agent`

Required:

- migration intent;
- schema before/after;
- rollback possibility;
- index/foreign key impact;
- model/spec impact;
- data migration need.

Must stop when:

- irreversible migration is proposed without approval;
- production migration execution is requested;
- data backfill is needed but no `data_migration_script_agent` handoff exists.

## `data_migration_script_agent`

Required:

- affected rows estimate;
- dry-run command;
- backup/rollback note;
- idempotency strategy;
- abort conditions;
- validation query/check.

Must not:

- Run mutating production scripts.
- Hide direct SQL or destructive commands.

## `script_processing_agent`

Use for non-data-mutating operational helpers and local automation.

Must hand off to:

- `data_migration_script_agent` for backfill/data repair;
- `db_schema_agent` for schema changes;
- `seed_master_agent` for master/seed changes;
- `external_api_agent` for external API mutation;
- `batch_rake_agent` for scheduled/batch behavior.

## `seed_master_agent`

Check:

- seed source;
- master ownership;
- existing values;
- production master impact;
- repeatability.

Must not:

- Change production master without explicit approval.

## `csv_import_agent`

Required:

- encoding;
- required columns;
- bad row handling;
- validation matrix;
- duplicate behavior;
- transaction/partial failure behavior.

## `excel_export_agent`

Required:

- column mapping;
- privacy/accounting fields;
- sample output verification;
- consumer compatibility.

Must escalate if accounting or personal data fields change.

## `batch_rake_agent`

Required:

- task entrypoint;
- schedule impact;
- retry/idempotency;
- side effects;
- failure behavior.

Must not:

- Change schedule without explicit approval.
- Run destructive batch tasks.

## `external_api_agent`

Strict human gate.

Required:

- API contract;
- request/response shape;
- stub/mock plan;
- retry/error behavior;
- external side effects.

Must not:

- Read credentials.
- Call mutating external API without explicit approval.

## `aws_infra_agent`

Default deny unless explicitly approved.

May only draft command plans unless Activation Record explicitly allows a safe action.

Must not:

- Deploy.
- Change production infra.
- Read credentials.
- Change IAM, pipeline, branch protection, or repository settings.

## `dependency_agent`

Required:

- dependency name/version;
- update type: patch/minor/major/security/runtime;
- lockfile churn assessment;
- test scope;
- rollback plan.

Must hand off dependency noise or grouped updates to `dependency-sweeper`.

## `config_agent`

Config is deny by default.

Allowed:

- explicitly scoped route addition through `route_agent` contract.

Must escalate:

- initializer change;
- environment config;
- external service connector;
- credentials;
- schedule;
- auth exposure;
- production/deploy config.
