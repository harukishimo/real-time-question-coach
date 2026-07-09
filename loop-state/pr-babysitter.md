# PR Babysitter State - Realtime Question Coach

このファイルは、`pr-babysitter` Loop Pattern の実行状態を保持する。

現時点では `pr-babysitter` は scaffold 済みだが active ではない。直接起動するには、CodeCommit / repository service connector、PR access、budget、human approval の整備が必要である。

## Current Mode

| Item | Value |
| --- | --- |
| Pattern | `pr-babysitter` |
| Current status | scaffolded_inactive |
| Default startup mode | monitor_only |
| Default autonomy | L1 |
| Allowed current behavior | report-only PR classification |
| Direct activation requirement | PR source/access, budget enablement, human approval |

## Last Run

```yaml
last_run:
  run_id:
  run_at:
  outcome: never_run
  prs_scanned: 0
  prs_actionable: 0
  prs_blocked: 0
```

## Active PRs

現時点ではなし。

```yaml
active_prs: []
```

## Watch List

再確認や次回監視が必要な PR signal を残す。

```yaml
watch_list: []
```

## Review Follow-Up Queue

review comment、requested changes、unresolved thread などの follow-up 候補を残す。

```yaml
review_follow_up_queue: []
```

## Blocked PRs

human gate、deny list、CI failure、dependency、scope 不足により停止した PR を残す。

```yaml
blocked_prs: []
```

## Merge Ready Candidates

merge 候補として人間判断に出せる可能性がある PR を残す。merge は自動実行しない。

```yaml
merge_ready_candidates: []
```

## Handoff Queue

他 Pattern または human に渡す必要がある PR を残す。

```yaml
handoff_queue:
  ci_sweeper: []
  dependency_sweeper: []
  daily_triage: []
  human: []
```

## State Entry Template

```yaml
pr:
  pr_id:
  title:
  url:
  repository:
  source_branch:
  target_branch:
  author:
  reviewers:
  last_seen:
  pr_state:
  blockers:
  approvals:
  review_threads:
  ci_status:
  merge_conflict:
  current_status: active | watching | blocked | handed_off | merge_ready_candidate | resolved
  human_gate_required:
  next_action:
  next_owner:
  evidence:
    pr_url:
    review_excerpt:
    status_summary:
  notes:
```

## State Rules

- PR 本文全文や review comment 全文を貼らない。URL と短い excerpt に留める。
- secret、credential、production data を記録しない。
- resolved PR は次回以降に必要なものだけ残す。
- merge ready candidate は human approval が必要な候補として扱い、自動 merge の根拠にしない。
- `daily-triage` が report-only で検出した PR signal は、直接起動前は handoff queue または watch list に残す。
