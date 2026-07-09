# Loop Pattern Picker

このドキュメントは、Orchestrator Agent が現在の状態を見て、どの Loop Pattern を起動するかを決めるための判断基準を定義する。

Pattern Picker は **AI Work Ticket の schema、status、差し戻し文面を定義しない**。それらは `daily-triage` Pattern または Ticket Builder / Intake 側の責務である。Pattern Picker の責務は、Orchestrator Agent が「今どの Pattern を回すべきか」を決めることに限定する。

AI Work Ticket 一覧は、外部 issue / repository issue ではなく1ページのスプレッドシートを正とする。列定義は `docs/ai-work-ticket-spreadsheet-schema.md` に従う。外部 issue、PR、repository service 上の情報は source / evidence として参照できるが、Pattern Picker はそれらの一覧を AI Work Ticket 一覧として扱わない。

## Responsibility Boundary

| Component | Responsibility |
|-----------|----------------|
| Orchestrator Agent | 状態、制約、予算、チケット一覧、PR、CI などの signal を読み、Pattern Picker に従って起動する Pattern を決める |
| Pattern Picker | 各 Loop Pattern の起動条件、除外条件、優先順位、必要な前提を定義する |
| Loop Pattern | Orchestrator Agent が起動する処理の型。例: `daily-triage`, `pr-babysitter`, `ci-sweeper` |
| daily-triage | AI Work Ticket の棚卸し、構造不足の検出、status 更新、仕様精緻化や実装振り分けの判断を行う Pattern |
| Ticket Builder / Intake | Human-origin input を AI-readable な AI Work Ticket に変換する |
| Kiro | `daily-triage` から呼び出される仕様精緻化 tool。Loop Pattern ではない |

## Non-Goals

Pattern Picker は次を行わない。

- AI Work Ticket の必須 field を定義しない
- AI Work Ticket の status 一覧を定義しない
- `ticket_builder_required` や `needs_human_management` の文面を生成しない
- 実装 agent を直接起動しない
- Kiro spec を直接作成しない
- PR を更新、merge、close しない

これらは、選択された Pattern の中で扱う。

## Alignment Check

この文書は `docs/patterns/daily-triage.md` 作成後に照合済みである。

- Pattern Picker は Pattern 選択だけを扱う。
- AI Work Ticket の構造検査、status 更新案、AI comment 案、cc-sdd / Kiro 判断は `daily-triage` 側で扱う。
- `daily-triage` の L1 report-only output は `loop-run-log.md` に記録する。
- 現時点で active scaffold 済み Pattern は `daily-triage` のみである。
- `pr-babysitter`, `ci-sweeper`, `dependency-sweeper` は scaffold 済みだが inactive であり、必要な repository / dependency / CI access、budget、human approval が揃うまで直接起動しない。
- 未 active Pattern signal は、直接起動せず `daily-triage` の report-only で記録する。

## Decision Output

Orchestrator Agent は Pattern Picker の結果を、実行ログまたは state に次の形式で残す。

```yaml
pattern_decision:
  selected_pattern:
  startup_mode: report_only | monitor_only | assisted_fix | no_op
  autonomy_level: L0 | L1 | L2 | L3
  primary_signal:
  why_this_pattern:
  why_not_other_patterns:
  required_prerequisites:
  missing_prerequisites:
  human_gate_required:
  next_entrypoint:
```

`selected_pattern` は Loop Pattern の名前である。`selected_action` のような Pattern 内の詳細処理は、起動された Pattern 側で決める。

## Required Inputs

Orchestrator Agent は Pattern を選ぶ前に、最低限次を確認する。

1. `loop-constraints.md`
2. `loop-budget.md`
3. `loop-run-log.md`
4. `STATE.md`
5. AI が読むチケット一覧 spreadsheet の存在と件数
6. PR 状態の有無
7. CI failure の有無
8. dependency update / security alert / lockfile change の有無
9. dependency noise の量。例: Dependabot / Renovate PR の滞留、patch / minor update の大量発生、lockfile churn、重複 alert
10. merge 後 follow-up / cleanup / 技術的負債 signal の有無
11. release note / changelog 対象の有無
12. 各 Pattern の scaffold / skill / state file / connector の有無

Pattern Picker は、AI Work Ticket の中身を細かく検査するための文書ではない。スプレッドシート上の AI Work Ticket 一覧に何らかの未整理 item がある場合、まず `daily-triage` を選ぶ。

## Global Stop Conditions

以下に該当する場合、Orchestrator Agent は Pattern を起動しない。

- `loop-pause-all` が有効
- 当日の budget を超過している
- `loop-constraints.md` の禁止操作に該当する作業しか存在しない
- secret、credential、production deploy、破壊的 git 操作が必要
- Pattern を起動するための最低限の state file や skill がない

この場合の decision:

```yaml
pattern_decision:
  selected_pattern: null
  startup_mode: no_op
  autonomy_level: L0
  primary_signal: global_stop
  human_gate_required: true
```

## Pattern Priority

複数の Pattern が該当する場合は、次の優先順位で選ぶ。

1. `ci-sweeper`
2. `pr-babysitter`
3. `dependency-sweeper`
4. `post-merge-cleanup`
5. `changelog-drafter`
6. `daily-triage`

CI failure が primary signal の場合は、失敗が PR 上に表示されていても `ci-sweeper` を優先する。`pr-babysitter` は PR の状態監視、review comment、conflict、approval、merge readiness を扱い、CI failure の原因調査や修正判断は `ci-sweeper` に委譲する。

ただし現時点のactive Patternは `daily-triage` のみである。`pr-babysitter`, `ci-sweeper`, `dependency-sweeper`, `post-merge-cleanup` は scaffold 済みだが、必要な repository / dependency / CI / post-merge evidence access、budget、human approval が揃うまで直接起動しない。未 active の Pattern が優先順位上は該当しても、起動せず `daily-triage` で report-only に整理する。本PJの最大自律度はL3だが、Pattern選択の通常入口は引き続きL1 daily-triageとする。

## Pattern Selection Matrix

| Signal | selected_pattern | startup_mode | Default autonomy | Required prerequisites |
|--------|------------------|--------------|------------------|------------------------|
| AI Work Ticket 一覧に未処理 item がある | `daily-triage` | `report_only` | L1 | `STATE.md`, `loop-triage` skill |
| 新機能、仕様変更、責務境界がある item がある | `daily-triage` | `report_only` | L1 | `STATE.md`, `loop-triage` skill, Kiro skills |
| AI Work Ticket の構造不足が疑われる item がある | `daily-triage` | `report_only` | L1 | `STATE.md`, `loop-triage` skill |
| 既存 PR に review comment、conflict、approval 待ち、merge readiness の問題がある | `pr-babysitter` | `monitor_only` | L1 | `loop-state/pr-babysitter.md`, `.codex/skills/pr-babysitter/SKILL.md`, CodeCommit / repository service connector |
| CI failure があり、対象 workflow / branch / failure log が明確 | `ci-sweeper` | `monitor_only` | L1 | `loop-state/ci-sweeper.md`, `.codex/skills/ci-sweeper/SKILL.md`, repository / CI service connector |
| dependency update、security alert、lockfile change、dependency noise の増加がある | `dependency-sweeper` | `monitor_only` | L1 | `loop-state/dependency-sweeper.md`, `.codex/skills/dependency-sweeper/SKILL.md`, repository / dependency evidence access |
| merge 済み PR の cleanup、follow-up、不要 branch、残作業確認、技術的負債の蓄積が主対象 | `post-merge-cleanup` | `monitor_only` | L1 | `loop-state/post-merge-cleanup.md`, `.codex/skills/post-merge-cleanup/SKILL.md`, repository / post-merge evidence access |
| release note、変更履歴、changelog draft が主対象 | `changelog-drafter` | `monitor_only` | L1 | changelog state file, changelog scan skill |
| 特に actionable な signal がない | `daily-triage` | `report_only` | L1 | `STATE.md`, `loop-triage` skill |

## Pattern Details

### `daily-triage`

詳細な実行責務、status 更新案、cc-sdd / Kiro 判断、L1 report-only output は `docs/patterns/daily-triage.md` を正とする。

起動する条件:

- AI Work Ticket 一覧に未処理 item がある
- 新機能、仕様変更、責務境界がある item がある
- AI Work Ticket の構造不足や human 管理の要否を確認する必要がある
- 他の専用 Pattern を起動するほど signal が明確ではない
- 初回 Loop または1日1回の棚卸しを行う

起動しない条件:

- `loop-pause-all` が有効
- budget 超過
- `STATE.md` または `loop-triage` skill がない

Orchestrator が判断すること:

- `daily-triage` を起動するかどうか
- `report_only` で始めるかどうか
- human gate が必要な signal があるかどうか

`daily-triage` 側で判断すること:

- AI Work Ticket の構造が十分か
- Ticket Builder に差し戻すか
- 人間の管理が必要か
- Kiro で仕様を詰めるか
- 実装 agent に振り分けられるか

### `pr-babysitter`

詳細な実行責務、PR 状態分類、human gate、state 更新形式は `docs/patterns/pr-babysitter.md` を正とする。

起動する条件:

- 既存 PR が主対象である
- PR に review comment、conflict、approval 待ち、merge readiness の問題がある
- CI status の確認は必要だが、CI failure の原因調査や修正が主目的ではない
- PR を継続監視する価値がある

起動しない条件:

- PR が存在しない
- PR 情報を読む connector がない
- 自動 merge が必要
- PR の問題ではなく、仕様や実装方針の未確定が主問題
- CI failure の原因調査、再現、修正判断が主目的である。その場合は `ci-sweeper` を選ぶ

初期運用:

- scaffold 済みだが、CodeCommit / repository service connector、PR access、budget、human approval が揃うまで直接起動しない
- 該当 signal がある場合は `daily-triage` で report-only に記録する

### `ci-sweeper`

詳細な実行責務、failure 分類、human gate、state 更新形式は `docs/patterns/ci-sweeper.md` を正とする。

起動する条件:

- CI failure が主 signal である
- workflow、branch、failure log が特定できる
- PR 上の failure であっても、原因調査や再現が主目的である
- 失敗が一時的ではなく、対応候補として扱う価値がある

起動しない条件:

- CI failure の詳細が読めない
- 失敗原因が infra / secret / permission に見える
- deny list に触れる必要がある

初期運用:

- scaffold 済みだが、repository / CI service connector、CI log access、budget、human approval が揃うまで直接起動しない
- 該当 signal がある場合は `daily-triage` で report-only に記録する

### `dependency-sweeper`

詳細な実行責務、dependency 分類、dependency noise、human gate、state 更新形式は `docs/patterns/dependency-sweeper.md` を正とする。

起動する条件:

- dependency update、security alert、lockfile change が主 signal である
- dependency noise が多く、daily-triage の Recent Noise や Watch List を圧迫している
- Dependabot / Renovate PR、重複 alert、patch / minor update の滞留、lockfile churn のいずれかが増えている
- patch / minor / major の区分が見える
- rollback 方針または test plan が存在する

起動しない条件:

- 単発の軽微な dependency update であり、棚卸しだけで十分
- major update で影響範囲が大きい
- Rails / Node / Ruby runtime の互換性判断が必要
- security 対応として human gate が必要

初期運用:

- scaffold 済みだが、repository service connector、dependency evidence access、budget、human approval が揃うまで直接起動しない
- 該当 signal がある場合は `daily-triage` で report-only に記録する

### `post-merge-cleanup`

詳細な実行責務、cleanup 分類、技術的負債、human gate、state 更新形式は `docs/patterns/post-merge-cleanup.md` を正とする。

起動する条件:

- merge 済み PR の後処理が主 signal である
- follow-up ticket、不要 branch、残作業確認が必要
- release 前の cleanup が主目的である
- 技術的負債が積み上がっており、merge 後の follow-up として棚卸し、分類、返済計画化する必要がある
- temporary workaround、TODO、disabled test、未消化 refactor、削除待ち code path が merge 後に残っている

起動しない条件:

- merge 直後の状態が不明
- cleanup ではなく新規実装が必要
- release 判断が必要
- 技術的負債の原因が仕様未確定である。その場合は `daily-triage` から Kiro に渡すかを判断する

初期運用:

- scaffold 済みだが、repository service connector、merged PR / commit evidence access、budget、human approval が揃うまで直接起動しない
- 該当 signal がある場合は `daily-triage` で report-only に記録する

### `changelog-drafter`

詳細な実行責務、release range、変更分類、draft audience、human gate、L1 output は `docs/patterns/changelog-drafter.md` を正とする。

起動する条件:

- release note、変更履歴、changelog draft が主 signal である
- commit / PR / tag の範囲が明確
- publish ではなく、人間 review 用 draft 作成が目的である

起動しない条件:

- release 対象範囲が不明
- publish や release approval が必要
- tag 作成、release 作成、deploy の実操作が必要
- CI failure、dependency、post-merge cleanup、PR review が primary signal である

初期運用:

- Pattern document は作成済みだが、runtime scaffold は未整備のため、直接起動しない
- 直接起動には `.codex/skills/changelog-drafter/SKILL.md`, `loop-state/changelog-drafter.md`, repository / release evidence access, budget, human approval が必要
- 該当 signal がある場合は `daily-triage` で report-only に記録する

## Current Recommendation

Realtime Question Coach の実運用 ticket に対する Loop 実行はまだ行っていない。次の起点は、環境構築作成用の AI Work Ticket を作成し、`daily-triage` を L1 report-only で通すことである。本PJの最大自律度はL3まで許可済みだが、L2 / L3 実行は対象 ticket の Activation Record がある場合だけ on-demand で行う。

```yaml
current_loop_decision:
  last_run_id: none_for_realtime_question_coach_tickets
  first_loop_status: not_started
  selected_pattern: daily-triage
  startup_mode: report_only
  autonomy_level: L1
  max_approved_autonomy: L3
  primary_signal: environment_setup_ticket_creation_pending
  next_human_decision:
    - 環境構築作成用の最初の AI Work Ticket を作成する
    - L3 実行対象にする ticket では Activation Record を明記する
  why_this_pattern: "現在 active scaffold が daily-triage であり、AI Work Ticket 一覧、制約、状態、未整備 Pattern の棚卸しと L1 提案記録を入口にするため。"
  why_not_other_patterns: "pr-babysitter, ci-sweeper, dependency-sweeper, post-merge-cleanup は scaffold 済みだが、必要な repository / dependency / CI / post-merge evidence access、budget、human approval が未整備のため直接起動しない。changelog-drafter は Pattern document のみ作成済みで、runtime skill / state / connector が未整備。"
  required_prerequisites:
    - STATE.md
    - loop-constraints.md
    - loop-budget.md
    - loop-run-log.md
    - .codex/skills/loop-triage/SKILL.md
    - AI Work Ticket spreadsheet source URL
    - Google Sheets connector Editor access
  ai_work_ticket_spreadsheet_source: "https://docs.google.com/spreadsheets/d/1y7UEjCTejSJXgLWmvA0SEKOHurl8C5QvtfxMf87ruqc/edit"
  required_connector_permission: editor
  writeback_mode: human_comment_enabled
  l1_allowed_write_columns:
    - ai_comment_type
    - ai_comment_summary
    - decision_needed
    - questions_for_human
    - default_assumption
    - reply_format
    - proposed_*
    - last_loop_run_id
    - triage_notes
  access_status: metadata_and_header_read_confirmed
  missing_prerequisites: []
  human_gate_required: false
  next_entrypoint: "create RQC environment setup tickets"
```

次の段階では、L3までの自律度は許可済みである。ただし、対象 AI Work Ticket の Activation Record が揃うまでは実装、branch 作成、PR、merge、canonical status 更新に進まない。scheduled daily-triage は `STATE.md` と `loop-run-log.md` の更新、および未整備 Pattern の棚卸しを L1 report-only の成果物とする。
