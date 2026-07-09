# Dependency Sweeper State - Realtime Question Coach

このファイルは、`dependency-sweeper` Loop Pattern の実行状態を保持する。

現時点では `dependency-sweeper` は scaffold 済みだが active ではない。直接起動するには、repository service connector、dependency evidence access、budget、human approval の整備が必要である。

## Current Mode

| Item | Value |
| --- | --- |
| Pattern | `dependency-sweeper` |
| Current status | scaffolded_inactive |
| Default startup mode | monitor_only |
| Default autonomy | L1 |
| Allowed current behavior | report-only dependency classification and noise grouping |
| Direct activation requirement | dependency evidence access, budget enablement, human approval |

## Last Run

```yaml
last_run:
  run_id:
  run_at:
  outcome: never_run
  items_scanned: 0
  items_actionable: 0
  items_blocked: 0
```

## Active Dependency Items

現時点ではなし。

```yaml
active_dependency_items: []
```

## Watch List

再確認や次回監視が必要な dependency signal を残す。

```yaml
watch_list: []
```

## Noise Groups

dependency noise としてまとめて扱う patch / minor update、重複 alert、lockfile churn を残す。

```yaml
noise_groups: []
```

## Security Major Runtime Watch

security alert、major update、runtime / framework update など、human gate を前提に追跡する signal を残す。

```yaml
security_major_runtime_watch: []
```

## Blocked Dependency Items

human gate、deny list、CI failure、PR state、scope 不足により停止した dependency item を残す。

```yaml
blocked_dependency_items: []
```

## Handoff Queue

他 Pattern または human に渡す必要がある dependency item を残す。

```yaml
handoff_queue:
  pr_babysitter: []
  ci_sweeper: []
  daily_triage: []
  human: []
```

## State Entry Template

```yaml
dependency_item:
  dependency_id:
  dependency_name:
  repository:
  package_manager:
  package_file:
  lockfile:
  current_version:
  target_version:
  dependency_type:
  direct_or_transitive:
  advisory:
  related_pr:
  ci_status:
  first_seen:
  last_seen:
  repeated_count:
  current_status: active | watching | blocked | handed_off | resolved
  human_gate_required:
  next_action:
  next_owner:
  evidence:
    source_url:
    summary_excerpt:
  notes:
```

## State Rules

- advisory 本文全文、PR 本文全文、scanner log 全文を貼らない。URL と短い excerpt に留める。
- secret、credential、production data を記録しない。
- resolved dependency item は次回以降に必要なものだけ残す。
- security / major / runtime update は human gate 前提の watch として扱う。
- `daily-triage` が report-only で検出した dependency signal は、直接起動前は handoff queue または watch list に残す。
