# PR Babysitter Loop Pattern

## Purpose

`pr-babysitter` は、既存 PR が primary signal である場合に、PR の状態を監視、分類し、安全な次 action を提案する Loop Pattern である。

この Pattern は review comment、requested changes、unresolved thread、conflict、approval 待ち、stale PR、merge readiness を扱う。CI failure の原因調査、再現、修正判断は `ci-sweeper` の責務である。

現時点では scaffold 済みだが active ではない。直接起動するには、CodeCommit / repository service connector、PR access、budget、human approval の整備が必要である。

## Responsibility Boundary

| Component | Responsibility |
| --- | --- |
| Orchestrator Agent | Pattern Picker に従い、既存 PR 状態が primary signal か判断する |
| Pattern Picker | `pr-babysitter` を起動するか、`daily-triage` report-only に留めるかを判断する |
| `pr-babysitter` Pattern | PR の blocker、review 状態、approval、conflict、merge readiness、human gate、次 action を判断する |
| `ci-sweeper` Pattern | CI failure の原因分類、再現要否、risk、次 action を判断する |
| `dependency-sweeper` Pattern | dependency update、security alert、lockfile churn、dependency PR noise を扱う |
| Implementation Agent | L2 以上で、許可された低 risk 修正のみ実装する |
| Human | ready for review、merge、close、review 解決、承認、方針判断を行う |

## When To Run

`pr-babysitter` は次の条件を満たす場合に起動候補になる。

- 既存 PR が primary signal である。
- PR 番号、URL、branch、review 状態のいずれかを特定できる。
- PR に review comment、requested changes、unresolved thread、approval 待ち、conflict、merge readiness の問題がある。
- CI status の確認は必要だが、CI failure の原因調査や修正判断が主目的ではない。
- dependency update PR であっても、主目的が dependency 判断ではなく review / approval / merge readiness の監視である。
- `loop-state/pr-babysitter.md` と `.codex/skills/pr-babysitter/SKILL.md` が存在する。
- PR 情報を読む connector または evidence link がある。

## When Not To Run

次の場合は起動しない。

- PR が存在しない、または PR 情報を読めない。
- CI failure の原因調査、再現、修正判断が主目的である。
- dependency update、security alert、lockfile churn、dependency noise が主問題である。
- merge 後の cleanup、follow-up、不要 branch、技術的負債の棚卸しが主問題である。
- 仕様未確定、AI Work Ticket 構造不足、scope 不明が主問題である。
- ready for review、merge、close、自動 merge の実操作そのものが目的である。
- budget がない、または `loop-pause-all` が有効である。

これらの場合は、`daily-triage` の report-only、`ci-sweeper`、`dependency-sweeper`、`post-merge-cleanup`、または human gate へ送る。

## Required Inputs

開始時に次を読む。

1. `loop-constraints.md`
2. `loop-human-gates.md`
3. `loop-budget.md`
4. `loop-run-log.md`
5. `STATE.md`
6. `docs/patterns/pr-babysitter.md`
7. `docs/codecommit-pr-contract.md`
8. `loop-state/pr-babysitter.md`
9. PR evidence

PR evidence には、可能な範囲で次を含める。

- provider: CodeCommit / GitHub / GitLab / other
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

## Non-Goals

`pr-babysitter` は次を行わない。

- L1 で code、test、workflow、config を変更しない。
- L1 で PR comment 投稿、review thread resolve、label 変更、assignee 変更、ready for review 化を行わない。
- L1 で branch 作成、push、force push、rebase、merge、close を行わない。
- CI rerun、workflow dispatch、deploy、external service 操作を行わない。
- branch protection、required check、review rule、approval rule を変更しない。
- 人間承認なしに review を dismiss しない。
- CI failure の log 深掘りや原因修正を主目的にしない。
- dependency upgrade 方針や lockfile 更新判断を主目的にしない。

## Autonomy Behavior

| Level | Allowed | Not allowed |
| --- | --- | --- |
| L0 | PR summary、blocker 分類、質問作成 | file 更新、PR 更新、実装 |
| L1 | PR 情報読み取り、状態分類、next action 提案、`loop-run-log.md` / `STATE.md` / `loop-state/pr-babysitter.md` 更新 | code 変更、PR comment 投稿、thread resolve、ready 化、merge、close |
| L2 | human approval 後の低 risk review response plan、限定的 local fix 提案、PR 作成 / 更新提案 | merge、close、ready 化、review resolve、branch protection 変更 |
| L3 | human gate 通過後の ready / merge 判断材料提示 | 自動 merge、人間承認なしの ready 化、close |

現時点では `pr-babysitter` は scaffold 済みだが active ではない。直接起動する前に budget、CodeCommit / repository service connector、PR access、human approval を有効化する。

CodeCommit では、PR 作成手段として `aws codecommit create-pull-request` 相当の command を使う想定とする。ただし `pr-babysitter` の主責務は既存 PR の監視、分類、判断材料作成であり、L1 では PR 作成 command を実行しない。L2 は PR package 作成までとし、L3 で PR 作成が必要な場合も、Orchestrator Agent が AI Work Ticket、branch、検証結果、Activation Record、人間承認、`docs/codecommit-pr-contract.md` を確認してから実行する。

## Workflow

### 1. Guard Check

次を確認する。

- `loop-pause-all` がない。
- budget がある。
- PR evidence を読める。
- secret、credential、production data を読む必要がない。
- この run の中で PR 更新、merge、close、ready for review 化を実行する必要がない。
- PR の主因が CI failure / dependency / spec 未確定ではない。

guard に失敗した場合は `blocked` として記録し、安全な next step を残す。

### 2. PR Inventory

PR ごとに次を記録する。

- repository
- PR number
- PR URL
- title
- source branch
- target branch
- author
- reviewers
- review status
- unresolved threads
- requested changes
- approval status
- merge conflict status
- CI status summary
- labels
- last activity
- related ticket / commit

同一 blocker が複数 PR に出ている場合は、blocker 種別ごとにまとめる。

### 3. PR Classification

PR 状態を次のいずれかに分類する。

| pr_state | Use when |
| --- | --- |
| `review_requested` | review 依頼中で、まだ判断待ちである |
| `changes_requested` | reviewer から changes requested が出ている |
| `unresolved_review_threads` | 未解決 review thread が残っている |
| `merge_conflict` | conflict により merge できない |
| `approval_waiting` | 実装上は進められそうだが approval が不足している |
| `stale_pr` | 長期間更新がなく、再確認が必要 |
| `merge_ready_candidate` | checks / approval / scope 上は merge 候補だが、人間承認が必要 |
| `blocked_by_ci` | CI failure が blocker だが、原因調査は `ci-sweeper` に渡す |
| `blocked_by_dependency` | dependency / lockfile / security alert が blocker である |
| `blocked_by_scope_or_spec` | scope、仕様、AI Work Ticket が不足している |
| `blocked_by_human_gate` | merge、close、ready 化、承認など人間判断が必要 |
| `unknown` | 判断材料が不足している |

### 4. Risk And Human Gate

次に該当する場合は human gate または blocked にする。

- ready for review、merge、close、review thread resolve、review dismiss が必要。
- reviewer への返信、PR comment、label、assignee、milestone 変更が必要。
- branch protection、required check、approval rule、CODEOWNERS が絡む。
- conflict 解消が DB schema、config、外部連携、KPI / management、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master、daily lock に触れる。
- CI failure が blocker で、原因調査や修正判断が必要。
- dependency update、security alert、lockfile churn が主 blocker である。
- 仕様未確定、scope 不明、acceptance criteria 不足がある。

### 5. Next Action

次のいずれかを提案する。

| next_action | Use when |
| --- | --- |
| `monitor_only` | まだ待機でよい |
| `needs_human` | approval、merge、close、PR 更新、方針判断が必要 |
| `handoff_to_ci_sweeper` | CI failure が主 blocker |
| `handoff_to_dependency_sweeper` | dependency / lockfile / security alert が主 blocker |
| `handoff_to_daily_triage` | AI Work Ticket / spec / Kiro 判断が必要 |
| `ready_for_review_response_plan` | L2 以上で review response plan を作れる |
| `ready_for_conflict_repro_plan` | L2 以上で conflict 解消方針の調査に進める |
| `ready_for_merge_readiness_report` | merge 候補として人間へ判断材料を出せる |
| `blocked_by_constraints` | deny list または権限不足で停止 |

## L1 Output

L1 では次を `loop-run-log.md` に残す。

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

`loop-state/pr-babysitter.md` には、次回参照すべき watch list、review follow-up、blocked、merge ready candidates、handoff queue だけを残す。

## State Updates

`loop-state/pr-babysitter.md` に残す情報は次に限定する。

- active PRs
- watch list
- review follow-up queue
- blocked PRs
- merge ready candidates
- handoff queue
- last run summary

review comment 全文や PR 本文全文を state file に貼らない。URL と短い excerpt に留める。

## Completion Criteria

`pr-babysitter` run は次を満たした場合に完了扱いにする。

- guard check の結果がある。
- PR の source と件数が記録されている。
- PR ごとに `pr_state` がある。
- blocker、human gate、deny list、blocked の理由が明確である。
- next action と next owner が分かる。
- `loop-run-log.md` と `loop-state/pr-babysitter.md` に次回への引き継ぎがある。
