# Post Merge Cleanup Loop Pattern

## Purpose

`post-merge-cleanup` は、merge 済み PR の後処理、follow-up、不要 branch、残作業、技術的負債 signal が primary signal である場合に、状態を棚卸し、分類し、安全な次 action を提案する Loop Pattern である。

この Pattern は merge 後の cleanup 候補、follow-up ticket 候補、不要 branch 候補、temporary workaround、TODO、disabled test、未消化 refactor、削除待ち code path、技術的負債の蓄積を扱う。既存 PR の review / conflict / approval は `pr-babysitter`、CI failure は `ci-sweeper`、dependency 起因の残作業は `dependency-sweeper`、release note / changelog draft は `changelog-drafter` の責務である。

現時点では scaffold 済みだが active ではない。直接起動するには、repository service connector、merged PR / commit evidence access、budget、human approval の整備が必要である。

## Responsibility Boundary

| Component | Responsibility |
| --- | --- |
| Orchestrator Agent | Pattern Picker に従い、merge 後 cleanup / 技術的負債 signal が primary signal か判断する |
| Pattern Picker | `post-merge-cleanup` を起動するか、`daily-triage` report-only に留めるかを判断する |
| `post-merge-cleanup` Pattern | merge 後 follow-up、不要 branch 候補、残作業、temporary workaround、技術的負債の分類、risk、human gate、次 action を判断する |
| `pr-babysitter` Pattern | 未 merge PR、review comment、conflict、approval、merge readiness を扱う |
| `ci-sweeper` Pattern | CI failure の原因分類、再現要否、次 action を判断する |
| `dependency-sweeper` Pattern | dependency update、security alert、lockfile churn、dependency noise を扱う |
| `changelog-drafter` Pattern | release note、変更履歴、changelog draft を扱う |
| Implementation Agent | L2 以上で、human approval 後の限定的 cleanup 実装や follow-up ticket 作成提案を扱う |
| Human | branch 削除、ticket close、release 判断、技術的負債返済方針、merge 後の実作業承認を行う |

## When To Run

`post-merge-cleanup` は次の条件を満たす場合に起動候補になる。

- merge 済み PR の後処理が primary signal である。
- merged PR、merge commit、source branch、target branch、関連 AI Work Ticket のいずれかを特定できる。
- follow-up ticket、不要 branch、残作業確認が必要である。
- release 前の cleanup 棚卸しが主目的である。
- 技術的負債が積み上がっており、merge 後の follow-up として棚卸し、分類、返済計画化する必要がある。
- temporary workaround、TODO、disabled test、未消化 refactor、削除待ち code path が merge 後に残っている。
- `loop-state/post-merge-cleanup.md` と `.codex/skills/post-merge-cleanup/SKILL.md` が存在する。
- repository service、merged PR、commit、AI Work Ticket、run log のいずれかを読める。

## When Not To Run

次の場合は起動しない。

- merge 済みであることを確認できない。
- 既存 PR の review、conflict、approval、merge readiness が主問題である。
- CI failure の原因調査、再現、修正判断が主目的である。
- dependency update、security alert、lockfile churn が主問題である。
- release note、変更履歴、changelog draft が主目的である。
- cleanup ではなく新規実装や仕様変更が必要である。
- 技術的負債の原因が仕様未確定である。
- branch 削除、ticket close、PR close、release、deploy の実操作そのものが目的である。
- budget がない、または `loop-pause-all` が有効である。

これらの場合は、`daily-triage` の report-only、`pr-babysitter`、`ci-sweeper`、`dependency-sweeper`、`changelog-drafter`、または human gate へ送る。

## Required Inputs

開始時に次を読む。

1. `loop-constraints.md`
2. `loop-budget.md`
3. `loop-run-log.md`
4. `STATE.md`
5. `docs/patterns/post-merge-cleanup.md`
6. `loop-state/post-merge-cleanup.md`
7. post-merge evidence

post-merge evidence には、可能な範囲で次を含める。

- provider: CodeCommit / repository service / other
- repository
- merged PR id / URL
- merge commit
- source branch
- target branch
- merged_at
- author / merger
- related AI Work Ticket
- changed areas
- remaining review comments
- follow-up comments
- TODO / FIXME references
- temporary workaround references
- disabled / skipped test references
- release / changelog signal
- cleanup notes

## Non-Goals

`post-merge-cleanup` は次を行わない。

- L1 で code、test、workflow、config、package file、lockfile を変更しない。
- L1 で branch 削除、PR close、issue close、ticket close を行わない。
- L1 で release、deploy、tag 作成、changelog publish を行わない。
- L1 で TODO 削除、disabled test 復旧、refactor、dead code deletion を実行しない。
- L1 で repository service state、external issue、AI Work Ticket spreadsheet canonical fields を直接更新しない。
- merge 後 cleanup を理由に unrelated refactor を行わない。
- test を green にする目的で削除、skip、disable、弱体化しない。

## Autonomy Behavior

| Level | Allowed | Not allowed |
| --- | --- | --- |
| L0 | post-merge summary、分類、質問作成 | file 更新、branch 削除、ticket close、実装 |
| L1 | merged evidence 読み取り、cleanup / debt 分類、risk / human gate / next action 提案、`loop-run-log.md` / `STATE.md` / `loop-state/post-merge-cleanup.md` 更新 | code 変更、branch 削除、ticket close、release、deploy、PR 更新 |
| L2 | human approval 後の cleanup report、follow-up ticket draft、技術的負債返済計画、限定的 cleanup 実装提案 | 自律 branch 削除、自律 ticket close、merge、deploy、release |
| L3 | human gate 通過後の cleanup 完了判断材料提示 | 自動 branch 削除、自動 close、自動 release |

現時点では `post-merge-cleanup` は scaffold 済みだが active ではない。直接起動する前に budget、repository / post-merge evidence access、human approval を有効化する。

## Workflow

### 1. Guard Check

次を確認する。

- `loop-pause-all` がない。
- budget がある。
- post-merge evidence を読める。
- secret、credential、production data を読む必要がない。
- branch 削除、ticket close、PR close、release、deploy の実行が不要である。
- cleanup signal の主因が PR review / CI failure / dependency / changelog / spec 未確定ではない。

guard に失敗した場合は `blocked` として記録し、安全な next step を残す。

### 2. Post-Merge Inventory

merge 後 item ごとに次を記録する。

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

同一 root cause の残作業が複数ある場合は、cleanup group としてまとめる。

### 3. Cleanup Classification

merge 後 signal を次のいずれかに分類する。

| cleanup_type | Use when |
| --- | --- |
| `follow_up_required` | follow-up ticket または追加判断が必要である |
| `branch_cleanup_candidate` | source branch が不要候補だが、人間承認が必要である |
| `leftover_todo` | TODO / FIXME / comment が残っている |
| `temporary_workaround` | temporary workaround、暫定処理、迂回実装が残っている |
| `disabled_test_or_skip` | disabled test、skip、弱体化された検証が残っている |
| `cleanup_refactor_candidate` | cleanup / refactor 候補だが、実装は別途判断が必要である |
| `dead_code_candidate` | 削除待ち code path、未使用 artifact が疑われる |
| `technical_debt` | 技術的負債として返済計画化が必要である |
| `release_or_changelog_signal` | changelog / release note に渡すべき signal である |
| `blocked_by_ci` | merge 後の CI failure が blocker である |
| `blocked_by_dependency` | dependency signal が blocker である |
| `blocked_by_scope_or_spec` | 仕様、scope、acceptance criteria が不足している |
| `unknown` | 判断材料が不足している |

### 4. Risk And Human Gate

次に該当する場合は human gate または blocked にする。

- branch 削除、ticket close、PR close、release、deploy、tag 作成が必要。
- code、test、workflow、config、package file、lockfile の変更が必要。
- disabled test / skipped test の復旧や削除判断が必要。
- DB schema、migration、seed、master data が絡む。
- daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master が絡む。
- production / staging / external service の状態変更が必要。
- 技術的負債返済が大きな refactor、責務境界変更、仕様判断を伴う。
- cleanup 方針が仕様や運用判断に依存している。

### 5. Next Action

次のいずれかを提案する。

| next_action | Use when |
| --- | --- |
| `monitor_only` | 現時点では再確認だけでよい |
| `needs_human` | branch 削除、close、release、方針判断が必要 |
| `handoff_to_pr_babysitter` | PR review / conflict / approval / merge readiness が主 blocker |
| `handoff_to_ci_sweeper` | CI failure が主 blocker |
| `handoff_to_dependency_sweeper` | dependency / lockfile / security alert が主 blocker |
| `handoff_to_changelog_drafter` | release note / changelog が主対象 |
| `handoff_to_daily_triage` | AI Work Ticket / spec / Kiro 判断が必要 |
| `ready_for_follow_up_ticket_draft` | L2 以上で follow-up ticket draft を作れる |
| `ready_for_cleanup_report` | cleanup report と判断材料を作れる |
| `ready_for_debt_register` | 技術的負債として記録、分類、返済計画化できる |
| `blocked_by_constraints` | deny list または権限不足で停止 |

## L1 Output

L1 では次を `loop-run-log.md` に残す。

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

`loop-state/post-merge-cleanup.md` には、次回参照すべき active cleanup items、watch list、cleanup groups、debt register、blocked、handoff queue だけを残す。

## State Updates

`loop-state/post-merge-cleanup.md` に残す情報は次に限定する。

- active cleanup items
- watch list
- cleanup groups
- debt register
- blocked cleanup items
- handoff queue
- last run summary

PR 本文全文、diff 全文、log 全文を state file に貼らない。URL と短い excerpt に留める。

## Completion Criteria

`post-merge-cleanup` run は次を満たした場合に完了扱いにする。

- guard check の結果がある。
- post-merge evidence の source と件数が記録されている。
- cleanup item ごとに `cleanup_type` がある。
- technical debt / follow-up / branch cleanup 候補の理由が明確である。
- human gate / deny list / blocked の理由が明確である。
- next action と next owner が分かる。
- `loop-run-log.md` と `loop-state/post-merge-cleanup.md` に次回への引き継ぎがある。
