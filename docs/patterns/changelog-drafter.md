# Changelog Drafter Loop Pattern

## Purpose

`changelog-drafter` は、release note、変更履歴、changelog draft が primary signal である場合に、対象範囲の変更を棚卸しし、人間が確認できる draft を作るための Loop Pattern である。

この Pattern は release range、merged PR、commit、AI Work Ticket、post-merge signal をもとに、変更を分類し、draftable な変更、human gate が必要な変更、他 Pattern へ渡すべき blocker を分ける。release の publish、tag 作成、deploy、外部告知、最終文面承認は Human の責務である。

現時点では Pattern document は作成済みだが、runtime scaffold は未整備である。直接起動するには、`.codex/skills/changelog-drafter/SKILL.md`、`loop-state/changelog-drafter.md`、repository / release evidence access、budget、human approval の整備が必要である。

## Responsibility Boundary

| Component | Responsibility |
| --- | --- |
| Orchestrator Agent | Pattern Picker に従い、release note / changelog draft signal が primary signal か判断する |
| Pattern Picker | `changelog-drafter` を起動するか、`daily-triage` report-only に留めるかを判断する |
| `changelog-drafter` Pattern | release range、変更分類、draft section、risk、human gate、次 action を判断する |
| `post-merge-cleanup` Pattern | merge 後 follow-up、不要 branch、残作業、技術的負債を扱う |
| `pr-babysitter` Pattern | 未 merge PR、review comment、conflict、approval、merge readiness を扱う |
| `ci-sweeper` Pattern | CI failure の原因分類、再現要否、次 action を判断する |
| `dependency-sweeper` Pattern | dependency update、security alert、lockfile churn、dependency noise を扱う |
| `daily-triage` Pattern | AI Work Ticket の構造検査、Kiro / 実装 / human gate の分岐判断を行う |
| Human | release range、公開可否、外部向け文面、breaking change、deploy / tag / publish を承認する |

## When To Run

`changelog-drafter` は次の条件を満たす場合に起動候補になる。

- release note、変更履歴、changelog draft が primary signal である。
- commit range、tag range、merged PR range、release candidate のいずれかが明確である。
- merged PR、commit、AI Work Ticket、post-merge cleanup item のいずれかを読める。
- release 前に人間が確認する draft を作ることが目的である。
- user-facing change、internal change、migration、dependency、security、breaking change を分類する必要がある。
- 変更の publish や release 実行ではなく、draft 作成と判断材料整理が目的である。

## When Not To Run

次の場合は起動しない。

- release 対象範囲が不明である。
- publish、tag 作成、release 作成、deploy の実操作が目的である。
- release approval、外部告知、{{CUSTOMER_DOMAIN}}向け最終文面の承認が必要である。
- 未 merge PR の review、conflict、approval、merge readiness が主問題である。
- CI failure の原因調査、再現、修正判断が主目的である。
- dependency update、security alert、lockfile churn が主問題である。
- merge 後 cleanup、follow-up、技術的負債の棚卸しが主問題である。
- 新規実装、仕様変更、Kiro spec 作成が必要である。
- budget がない、または `loop-pause-all` が有効である。

これらの場合は、`daily-triage` の report-only、`post-merge-cleanup`、`pr-babysitter`、`ci-sweeper`、`dependency-sweeper`、または human gate へ送る。

## Required Inputs

開始時に次を読む。

1. `loop-constraints.md`
2. `loop-budget.md`
3. `loop-run-log.md`
4. `STATE.md`
5. `docs/patterns/changelog-drafter.md`
6. changelog evidence

runtime scaffold 後は次も読む。

1. `loop-state/changelog-drafter.md`
2. `.codex/skills/changelog-drafter/SKILL.md`

changelog evidence には、可能な範囲で次を含める。

- provider: CodeCommit / repository service / other
- repository
- release target
- range type: commit_range / tag_range / merged_pr_range / date_range / ticket_range
- range start
- range end
- related tags
- merged PR ids / URLs
- commit hashes
- AI Work Ticket ids
- changed areas
- labels
- author / merger
- breaking change signal
- migration / DB change signal
- dependency / security signal
- release note request
- existing changelog or release note draft

## Non-Goals

`changelog-drafter` は次を行わない。

- L1 で code、test、workflow、config、package file、lockfile を変更しない。
- L1 で changelog file、release file、documentation file を直接更新しない。
- L1 で tag 作成、release 作成、publish、deploy を行わない。
- L1 で repository service state、external issue、AI Work Ticket spreadsheet canonical fields を直接更新しない。
- L1 で PR comment、release note、external announcement を投稿しない。
- commit message や PR title だけから根拠のない変更内容を作らない。
- breaking change、migration、security、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master に関わる文面を人間承認なしに確定しない。
- release 判断を代行しない。

## Autonomy Behavior

| Level | Allowed | Not allowed |
| --- | --- | --- |
| L0 | release range summary、変更分類、質問作成 | file 更新、release 操作、ticket 更新 |
| L1 | changelog evidence 読み取り、変更分類、draft section 案、risk / human gate / next action 提案、`loop-run-log.md` / `STATE.md` 更新 | changelog file 更新、release / tag / publish、PR 更新、canonical ticket status 更新 |
| L2 | human approval 後の changelog draft file 作成提案、release note draft、review request 作成提案 | 自律 release、tag 作成、deploy、外部告知、human gate 対象文面の確定 |
| L3 | human gate 通過後の release note finalization 判断材料提示 | 自動 release、自動 publish、自動 deploy |

現時点では `changelog-drafter` は Pattern document のみであり、runtime scaffold は未整備である。直接起動する前に skill、state file、repository / release evidence access、budget、human approval を有効化する。

## Workflow

### 1. Guard Check

次を確認する。

- `loop-pause-all` がない。
- budget がある。
- release range または draft 対象範囲を特定できる。
- changelog evidence を読める。
- secret、credential、production data を読む必要がない。
- tag 作成、release 作成、publish、deploy の実行が不要である。
- primary signal が PR review / CI failure / dependency / post-merge cleanup / spec 未確定ではない。

guard に失敗した場合は `blocked` として記録し、安全な next step を残す。

### 2. Release Range Inventory

対象範囲ごとに次を記録する。

- repository
- release target
- range type
- range start / end
- related tags
- merged PR ids / URLs
- commit hashes
- related AI Work Tickets
- changed areas
- labels
- breaking change signal
- migration / DB change signal
- dependency / security signal
- existing draft

範囲が曖昧な場合は、draft を作らず `needs_human` または `handoff_to_daily_triage` とする。

### 3. Change Classification

変更を次のいずれかに分類する。

| change_type | Use when |
| --- | --- |
| `feature` | user-facing または operator-facing の新機能 |
| `fix` | bug fix、不具合修正、仕様通りに動かす修正 |
| `improvement` | 既存機能の改善、UX / performance / reliability 改善 |
| `docs` | document、help text、運用資料の変更 |
| `test` | test 追加、検証強化、test infra 改善 |
| `dependency` | dependency update、lockfile、package manager 関連 |
| `security` | vulnerability、権限、認証、認可、security hardening |
| `breaking_change` | 互換性を壊す可能性がある変更 |
| `migration` | DB migration、data migration、運用手順が必要な変更 |
| `config_infra` | config、CI、infrastructure、deploy 周辺 |
| `cleanup` | cleanup、refactor、dead code、post-merge follow-up |
| `internal` | 外部 release note には出さない内部変更 |
| `unknown` | 判断材料が不足している |

### 4. Draft Audience And Section

draft の用途を次のいずれかに分類する。

| draft_audience | Use when |
| --- | --- |
| `internal_changelog` | 開発者、運用者向けの変更履歴 |
| `customer_release_note` | {{CUSTOMER_DOMAIN}}、利用者向けの公開文面 |
| `ops_release_note` | 運用、CS、管理者向けの注意点 |
| `migration_note` | DB、データ、手順、互換性に関する注意 |
| `security_note` | security 対応の説明。ただし公開可否は human gate |

L1 では draft section 案を作るだけで、公開文面として確定しない。

### 5. Risk And Human Gate

次に該当する場合は human gate または blocked にする。

- release range が不明、または複数解釈できる。
- breaking change、migration、DB schema、data migration が絡む。
- security、認証、認可、脆弱性、CVE が絡む。
- daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master が絡む。
- {{CUSTOMER_DOMAIN}}向け文面、外部告知、release approval が必要である。
- production / staging / external service の状態変更が必要である。
- release note の表現が product / legal / support 判断に依存する。

### 6. Next Action

次のいずれかを提案する。

| next_action | Use when |
| --- | --- |
| `monitor_only` | 現時点では再確認だけでよい |
| `needs_human` | release range、公開可否、外部文面、breaking change 判断が必要 |
| `handoff_to_post_merge_cleanup` | merge 後 follow-up / cleanup / 技術的負債が主 blocker |
| `handoff_to_pr_babysitter` | PR review / conflict / approval / merge readiness が主 blocker |
| `handoff_to_ci_sweeper` | CI failure が主 blocker |
| `handoff_to_dependency_sweeper` | dependency / lockfile / security alert が主 blocker |
| `handoff_to_daily_triage` | AI Work Ticket / spec / Kiro 判断が必要 |
| `ready_for_internal_changelog_draft` | 内部向け changelog draft を作れる |
| `ready_for_release_note_review` | 人間 review 用 release note draft を作れる |
| `blocked_by_constraints` | deny list または権限不足で停止 |

## L1 Output

L1 では次を `loop-run-log.md` に残す。

```yaml
changelog_drafter_result:
  items_scanned:
  items_draftable:
  items_blocked:
  release_range:
    range_type:
    range_start:
    range_end:
    release_target:
    evidence:
  change_groups:
    - group_id:
      change_type:
      draft_audience:
      count:
      related_prs:
      related_tickets:
      risk_level:
      human_gate_required:
      next_action:
      evidence:
  draft_sections:
    added:
    changed:
    fixed:
    migration:
    security:
    internal:
    unknown:
  handoffs:
    post_merge_cleanup:
    pr_babysitter:
    ci_sweeper:
    dependency_sweeper:
    daily_triage:
    human:
  state_updates:
    watch_list:
    blocked:
```

runtime scaffold 後は `loop-state/changelog-drafter.md` に、次回参照すべき release ranges、draft groups、blocked items、handoff queue だけを残す。

## State Updates

`loop-state/changelog-drafter.md` を作成する場合、残す情報は次に限定する。

- active release ranges
- draft groups
- watch list
- blocked changelog items
- handoff queue
- last run summary

PR 本文全文、commit log 全文、release note 全文を state file に貼らない。URL、ID、短い excerpt に留める。

## Completion Criteria

`changelog-drafter` run は次を満たした場合に完了扱いにする。

- guard check の結果がある。
- release range または draft 対象範囲が記録されている。
- change item ごとに `change_type` がある。
- draft audience と human gate 要否が明確である。
- draft section 案、または draft できない理由がある。
- next action と next owner が分かる。
- `loop-run-log.md` に次回への引き継ぎがある。
