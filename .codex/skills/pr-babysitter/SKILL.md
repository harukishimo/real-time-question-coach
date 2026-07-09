---
name: pr-babysitter
description: >
  Monitor and triage Realtime Question Coach pull requests in report-only mode only when Pattern Picker marks pr-babysitter active and loop-budget/human approval allow it. Otherwise record PR signals through daily-triage. Use when an existing PR has review comments, requested changes, unresolved threads, conflicts, approval waiting, stale status, or merge-readiness questions, and Codex must classify blockers, risk, human gate needs, and safe next action without updating PRs, merging, closing, rerunning CI, or changing code.
---

# PR Babysitter Skill

Realtime Question Coach の `pr-babysitter` Loop Pattern を実行する。既存 PR が primary signal であり、review comment / requested changes / conflict / approval / merge readiness を読める場合に、PR 状態、blocker、risk、human gate、next action を report-only で出す。

現時点では L1 monitor-only / report-only を基本とする。code、test、workflow、config、PR、repository service state、external state は変更しない。

## Runtime Activation Guard

この skill は、Pattern Picker が `pr-babysitter` を active Pattern として選び、`loop-budget.md` の budget と人間承認が揃っている場合だけ直接実行する。通常運用では `pr-babysitter` は scaffolded inactive であり、PR signal は `daily-triage` の report-only signal として記録する。

## Read Order

1. `loop-constraints.md`
2. `loop-human-gates.md`
3. `loop-budget.md`
4. `loop-run-log.md`
5. `STATE.md`
6. `docs/patterns/pr-babysitter.md`
7. `docs/codecommit-pr-contract.md`
8. `loop-state/pr-babysitter.md`
9. PR evidence

必要に応じて `docs/pattern-picker.md`, `LOOP.md`, related AI Work Ticket / commit / CI summary を読む。

## Hard Boundaries

- L1 では code、test、workflow、config を変更しない。
- L1 では PR comment 投稿、review thread resolve、label 変更、assignee 変更、ready for review 化を行わない。
- L1 では branch 作成、push、force push、rebase、merge、close を行わない。
- CI rerun、workflow dispatch、deploy、external service 操作を行わない。
- branch protection、required check、review rule、approval rule を変更しない。
- 人間承認なしに review を dismiss しない。
- L1 では `aws codecommit create-pull-request` などの PR 作成 command を実行しない。L2 でも PR package 作成までとし、PR 作成 command は L3 Activation Record がある場合だけ実行し得る。
- CI failure の原因調査や修正判断が主問題なら `ci-sweeper` signal として扱う。
- dependency update、security alert、lockfile churn が主問題なら `dependency-sweeper` signal として扱う。

## Guard Check

次に該当する場合は実行せず、`loop-run-log.md` に blocked / no-op 理由を残す。

- `loop-pause-all` が有効。
- budget がない。
- Pattern Picker が `pr-babysitter` を active Pattern として選んでいない、または `loop-budget.md` で `pr-babysitter` の実行 budget / human approval がない。
- PR evidence を読めない。
- secret、credential、production data を読む必要がある。
- この run の中で PR 更新、ready for review、merge、close を実行する必要がある。
- CI failure / dependency / spec 未確定が primary signal である。
- deny list に該当する作業しか考えられない。

## Workflow

### 1. PR Inventory

PR ごとに次を確認する。

- provider
- repository
- PR number
- PR URL
- title
- source branch
- target branch
- author
- reviewers
- review status
- unresolved review threads
- requested changes
- approval status
- merge conflict status
- CI status summary
- labels
- last activity
- related AI Work Ticket

### 2. PR Classification

次のいずれかに分類する。

- `review_requested`
- `changes_requested`
- `unresolved_review_threads`
- `merge_conflict`
- `approval_waiting`
- `stale_pr`
- `merge_ready_candidate`
- `blocked_by_ci`
- `blocked_by_dependency`
- `blocked_by_scope_or_spec`
- `blocked_by_human_gate`
- `unknown`

### 3. Risk And Human Gate

次の場合は human gate または blocked にする。

- ready for review、merge、close、review thread resolve、review dismiss が必要。
- reviewer への返信、PR comment、label、assignee、milestone 変更が必要。
- branch protection、required check、approval rule、CODEOWNERS が絡む。
- conflict 解消が DB schema、config、外部連携、KPI / management、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master、daily lock に触れる。
- CI failure が blocker で、原因調査や修正判断が必要。
- dependency update、security alert、lockfile churn が主 blocker である。
- 仕様未確定、scope 不明、acceptance criteria 不足がある。

### 4. Next Action

次のいずれかを選ぶ。

- `monitor_only`
- `needs_human`
- `handoff_to_ci_sweeper`
- `handoff_to_dependency_sweeper`
- `handoff_to_daily_triage`
- `ready_for_review_response_plan`
- `ready_for_conflict_repro_plan`
- `ready_for_merge_readiness_report`
- `blocked_by_constraints`

## L1 Output

`loop-run-log.md` に次の構造で記録する。

```yaml
pr_babysitter_result:
  prs_scanned:
  prs_actionable:
  prs_blocked:
  pr_groups:
    - pr_id:
      title:
      url:
      source_branch:
      target_branch:
      pr_state:
      blockers:
      approvals:
      review_threads:
      ci_status:
      merge_conflict:
      risk_level:
      human_gate_required:
      next_action:
      next_owner:
      evidence:
  handoffs:
    ci_sweeper:
    dependency_sweeper:
    daily_triage:
    human:
  state_updates:
    watch_list:
    blocked:
    merge_ready_candidates:
```

`loop-state/pr-babysitter.md` には active PRs、watch list、review follow-up queue、blocked PRs、merge ready candidates、handoff queue、last run summary だけを残す。PR 本文や review comment 全文は貼らず、URL と短い excerpt に留める。

## Completion Check

- guard check の結果がある。
- PRs scanned / actionable / blocked がある。
- PR ごとに `pr_state` がある。
- blocker、human gate、deny list、blocked 理由が明確である。
- next action と next owner が分かる。
- `loop-run-log.md` と `loop-state/pr-babysitter.md` に次回への引き継ぎがある。

## CodeCommit PR Creation

CodeCommit では、PR 作成手段として `aws codecommit create-pull-request` 相当の command を使う想定とする。ただしこの skill の L1 実行では command を実行しない。

L3 で PR 作成に進む場合は、Orchestrator Agent が `docs/codecommit-pr-contract.md` に従い、次を確認してから人間承認と Activation Record を確認する。

- AI Work Ticket が十分に構造化されている。
- source branch と destination branch が明確である。
- title と description が提示されている。
- 関連 test / verifier 結果がある。
- human gate 条件に該当しない、または human gate を通過している。
- `codecommit_pr_creation_allowed: true` がある。
- draft-equivalent title / description が用意されている。
