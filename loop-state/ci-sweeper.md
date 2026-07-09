# CI Sweeper State - Realtime Question Coach

このファイルは、`ci-sweeper` Loop Pattern の実行状態を保持する。

現時点では `ci-sweeper` は scaffold 済みだが active ではない。直接起動するには、repository / CI service connector、CI log access、budget、human approval の整備が必要である。

## Current Mode

| Item | Value |
| --- | --- |
| Pattern | `ci-sweeper` |
| Current status | scaffolded_inactive |
| Default startup mode | monitor_only |
| Default autonomy | L1 |
| Allowed current behavior | report-only classification |
| Direct activation requirement | CI source/access, budget enablement, human approval |

## Last Run

```yaml
last_run:
  run_id:
  run_at:
  outcome: never_run
  failures_scanned: 0
  failures_actionable: 0
  failures_blocked: 0
```

## Active Failures

現時点ではなし。

```yaml
active_failures: []
```

## Watch List

再発確認や次回確認が必要な CI signal を残す。

```yaml
watch_list: []
```

## Known Flaky Or Repeated Failures

既知の flaky、timeout、繰り返し failure を残す。

```yaml
known_flaky: []
```

## Blocked Failures

secret、permission、infra、deploy、deny list、human gate により停止した failure を残す。

```yaml
blocked_failures: []
```

## Handoff Queue

他 Pattern または human に渡す必要がある failure を残す。

```yaml
handoff_queue:
  pr_babysitter: []
  dependency_sweeper: []
  daily_triage: []
  human: []
```

## State Entry Template

```yaml
failure:
  failure_id:
  workflow:
  job:
  branch:
  commit:
  pr:
  first_seen:
  last_seen:
  repeated_count:
  failure_type:
  suspected_cause:
  current_status: active | watching | blocked | handed_off | resolved
  human_gate_required:
  next_action:
  next_owner:
  evidence:
    run_url:
    log_excerpt:
  notes:
```

## State Rules

- CI log 全文を貼らない。URL と短い excerpt に留める。
- secret、credential、production data を記録しない。
- resolved failure は次回以降に必要なものだけ残す。
- `daily-triage` が report-only で検出した CI signal は、直接起動前は handoff queue または watch list に残す。
