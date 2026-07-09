# Post Merge Cleanup State - Realtime Question Coach

このファイルは、`post-merge-cleanup` Loop Pattern の実行状態を保持する。

現時点では `post-merge-cleanup` は scaffold 済みだが active ではない。直接起動するには、repository service connector、merged PR / commit evidence access、budget、human approval の整備が必要である。

## Current Mode

| Item | Value |
| --- | --- |
| Pattern | `post-merge-cleanup` |
| Current status | scaffolded_inactive |
| Default startup mode | monitor_only |
| Default autonomy | L1 |
| Allowed current behavior | report-only post-merge cleanup and debt classification |
| Direct activation requirement | merged PR / commit evidence access, budget enablement, human approval |

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

## Active Cleanup Items

現時点ではなし。

```yaml
active_cleanup_items: []
```

## Watch List

再確認や次回監視が必要な post-merge cleanup signal を残す。

```yaml
watch_list: []
```

## Cleanup Groups

同一 root cause の follow-up、残作業、技術的負債をまとめて扱う group を残す。

```yaml
cleanup_groups: []
```

## Debt Register

技術的負債として返済計画化する候補を残す。

```yaml
debt_register: []
```

## Blocked Cleanup Items

human gate、deny list、CI failure、dependency、scope 不足により停止した cleanup item を残す。

```yaml
blocked_cleanup_items: []
```

## Handoff Queue

他 Pattern または human に渡す必要がある cleanup item を残す。

```yaml
handoff_queue:
  pr_babysitter: []
  ci_sweeper: []
  dependency_sweeper: []
  changelog_drafter: []
  daily_triage: []
  human: []
```

## State Entry Template

```yaml
cleanup_item:
  cleanup_id:
  repository:
  merged_pr:
  merge_commit:
  source_branch:
  target_branch:
  merged_at:
  related_ticket:
  changed_areas:
  cleanup_type:
  follow_up:
  technical_debt:
  release_or_changelog_signal:
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

- PR 本文全文、diff 全文、log 全文を貼らない。URL と短い excerpt に留める。
- secret、credential、production data を記録しない。
- resolved cleanup item は次回以降に必要なものだけ残す。
- branch cleanup、ticket close、release、deploy は human gate 前提の watch として扱う。
- `daily-triage` が report-only で検出した post-merge signal は、直接起動前は handoff queue または watch list に残す。
