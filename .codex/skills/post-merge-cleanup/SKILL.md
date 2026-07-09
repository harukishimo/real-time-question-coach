---
name: post-merge-cleanup
description: >
  Triage Realtime Question Coach post-merge cleanup, follow-up work, stale branch candidates, remaining TODOs, disabled tests, temporary workarounds, and technical debt in report-only mode only when Pattern Picker marks post-merge-cleanup active and loop-budget/human approval allow it. Otherwise record post-merge signals through daily-triage. Use when merged PR or merge commit evidence is the primary signal and Codex must classify cleanup type, risk, human gate needs, handoffs, and safe next action without deleting branches, closing tickets, changing code, releasing, deploying, or mutating repository state.
---

# Post Merge Cleanup Skill

Realtime Question Coach の `post-merge-cleanup` Loop Pattern を実行する。merge 済み PR、merge commit、follow-up、不要 branch 候補、残作業、temporary workaround、TODO、disabled test、技術的負債が primary signal である場合に、cleanup 状態、risk、human gate、handoff、next action を report-only で出す。

現時点では L1 monitor-only / report-only を基本とする。code、test、workflow、config、branch、ticket、PR、repository service state、external state は変更しない。

## Runtime Activation Guard

この skill は、Pattern Picker が `post-merge-cleanup` を active Pattern として選び、`loop-budget.md` の budget と人間承認が揃っている場合だけ直接実行する。通常運用では `post-merge-cleanup` は scaffolded inactive であり、post-merge signal は `daily-triage` の report-only signal として記録する。

## Read Order

1. `loop-constraints.md`
2. `loop-budget.md`
3. `loop-run-log.md`
4. `STATE.md`
5. `docs/patterns/post-merge-cleanup.md`
6. `loop-state/post-merge-cleanup.md`
7. post-merge evidence

必要に応じて `docs/pattern-picker.md`, `LOOP.md`, related AI Work Ticket / PR / CI summary / dependency summary を読む。

## Hard Boundaries

- L1 では code、test、workflow、config、package file、lockfile を変更しない。
- L1 では branch 削除、PR close、issue close、ticket close を行わない。
- L1 では release、deploy、tag 作成、changelog publish を行わない。
- L1 では TODO 削除、disabled test 復旧、refactor、dead code deletion を実行しない。
- L1 では repository service state、external issue、AI Work Ticket spreadsheet canonical fields を直接更新しない。
- merge 後 cleanup を理由に unrelated refactor を行わない。
- PR review、conflict、approval、merge readiness が主問題なら `pr-babysitter` signal として扱う。
- CI failure の原因調査や修正判断が主問題なら `ci-sweeper` signal として扱う。
- dependency update、security alert、lockfile churn が主問題なら `dependency-sweeper` signal として扱う。
- release note / changelog draft が主問題なら `changelog-drafter` signal として扱う。

## Guard Check

次に該当する場合は実行せず、`loop-run-log.md` に blocked / no-op 理由を残す。

- `loop-pause-all` が有効。
- budget がない。
- Pattern Picker が `post-merge-cleanup` を active Pattern として選んでいない、または `loop-budget.md` で `post-merge-cleanup` の実行 budget / human approval がない。
- post-merge evidence を読めない。
- secret、credential、production data を読む必要がある。
- branch 削除、ticket close、PR close、release、deploy の実行が必要である。
- PR review / CI failure / dependency / changelog / spec 未確定が primary signal である。
- deny list に該当する作業しか考えられない。

## Workflow

### 1. Post-Merge Inventory

merge 後 item ごとに次を確認する。

- provider
- repository
- merged PR id / URL
- merge commit
- source branch
- target branch
- merged_at
- related AI Work Ticket
- changed areas
- follow-up comments
- TODO / FIXME references
- temporary workaround
- disabled / skipped tests
- cleanup notes
- release / changelog signal

### 2. Cleanup Classification

次のいずれかに分類する。

- `follow_up_required`
- `branch_cleanup_candidate`
- `leftover_todo`
- `temporary_workaround`
- `disabled_test_or_skip`
- `cleanup_refactor_candidate`
- `dead_code_candidate`
- `technical_debt`
- `release_or_changelog_signal`
- `blocked_by_ci`
- `blocked_by_dependency`
- `blocked_by_scope_or_spec`
- `unknown`

### 3. Risk And Human Gate

次の場合は human gate または blocked にする。

- branch 削除、ticket close、PR close、release、deploy、tag 作成が必要。
- code、test、workflow、config、package file、lockfile の変更が必要。
- disabled test / skipped test の復旧や削除判断が必要。
- DB schema、migration、seed、master data が絡む。
- daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master が絡む。
- production / staging / external service の状態変更が必要。
- 技術的負債返済が大きな refactor、責務境界変更、仕様判断を伴う。
- cleanup 方針が仕様や運用判断に依存している。

### 4. Next Action

次のいずれかを選ぶ。

- `monitor_only`
- `needs_human`
- `handoff_to_pr_babysitter`
- `handoff_to_ci_sweeper`
- `handoff_to_dependency_sweeper`
- `handoff_to_changelog_drafter`
- `handoff_to_daily_triage`
- `ready_for_follow_up_ticket_draft`
- `ready_for_cleanup_report`
- `ready_for_debt_register`
- `blocked_by_constraints`

## L1 Output

`loop-run-log.md` に次の構造で記録する。

```yaml
post_merge_cleanup_result:
  items_scanned:
  items_actionable:
  items_blocked:
  cleanup_groups:
    - group_id:
      group_type:
      count:
      related_prs:
      cleanup_type:
      risk_level:
      human_gate_required:
      next_action:
      evidence:
  cleanup_items:
    - cleanup_id:
      merged_pr:
      merge_commit:
      source_branch:
      target_branch:
      cleanup_type:
      changed_areas:
      follow_up:
      technical_debt:
      release_or_changelog_signal:
      risk_level:
      human_gate_required:
      next_action:
      next_owner:
      evidence:
  handoffs:
    pr_babysitter:
    ci_sweeper:
    dependency_sweeper:
    changelog_drafter:
    daily_triage:
    human:
  state_updates:
    watch_list:
    cleanup_groups:
    debt_register:
    blocked:
```

`loop-state/post-merge-cleanup.md` には active cleanup items、watch list、cleanup groups、debt register、blocked cleanup items、handoff queue、last run summary だけを残す。PR 本文、diff、log 全文は貼らず、URL と短い excerpt に留める。

## Completion Check

- guard check の結果がある。
- items scanned / actionable / blocked がある。
- cleanup item ごとに `cleanup_type` がある。
- technical debt / follow-up / branch cleanup 候補の理由が明確である。
- human gate / deny list / blocked 理由が明確である。
- next action と next owner が分かる。
- `loop-run-log.md` と `loop-state/post-merge-cleanup.md` に次回への引き継ぎがある。
