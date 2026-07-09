# Loop System Flow

このドキュメントは、Realtime Question Coach の Loop Engineering における全体の動き、責務境界、scheduled L1 report-only 運用、on-demand L2 / L3 実行経路をまとめる。

## Current Operating Mode

| Item | Current value |
|------|---------------|
| 実行頻度 | 1日1回 |
| 実行主体 | Orchestrator Agent |
| 最大許可自律度 | L3 |
| scheduled default | L1 report-only |
| 現在の起動 mode | report-only |
| AI Work Ticket source | Google Sheets |
| active Pattern | `daily-triage` |
| 実装 / branch / PR | 対象 ticket の Activation Record がある場合だけ on-demand で実行 |
| merge / deploy / release | 自動実行しない |
| L1 write-back | Human Communication columns と L1 Proposed Updates columns のみ許可 |
| L2 / L3 | 本PJでは許可済み。対象 ticket の Activation Record がある場合だけ有効 |

## Permission Status

本PJでは最大L3までの自律度を許可済みとする。ただし、scheduled daily-triage は L1 report-only を基本とする。

L2 / L3 に進むには、人間が対象 AI Work Ticket ごとに `docs/loop-autonomy-contract.md` の Activation Record を明示する必要がある。実行手順は `docs/loop-execution-contract.md` に従う。自動 merge、deploy、release、production 操作、secret 読み取りは行わない。

## System Overview

```mermaid
flowchart TD
  H["Human-origin input<br/>会話 Issue PR comment 仕様メモ 障害報告"] --> TBI["Ticket Builder / Intake"]
  TBI -->|AI-readable row| SHEET["AI Work Ticket Spreadsheet<br/>Google Sheets"]

  ORCH["Orchestrator Agent<br/>1日1回"] --> LC["loop-constraints.md"]
  ORCH --> LB["loop-budget.md"]
  ORCH --> LRL["loop-run-log.md"]
  ORCH --> STATE["STATE.md"]
  ORCH --> PP["docs/pattern-picker.md"]
  ORCH --> SHEET

  PP --> DEC["Pattern decision"]
  DEC --> DT["daily-triage<br/>active L1 report-only"]
  DEC -.inactive.-> PR["pr-babysitter"]
  DEC -.inactive.-> CI["ci-sweeper"]
  DEC -.inactive.-> DEP["dependency-sweeper"]
  DEC -.inactive.-> PMC["post-merge-cleanup"]
  DEC -.documented only.-> CL["changelog-drafter"]

  DT --> OUT1["loop-run-log.md<br/>proposed updates comments signals"]
  DT --> OUT2["STATE.md<br/>watch list noise high priority"]
  DT --> OUT3["Human-facing summary<br/>判断依頼 差し戻し 次 action"]
```

## Responsibility Boundary

| Component | Responsibility |
|-----------|----------------|
| Human | raw request、判断、承認、merge、production / secret / release に関わる操作の許可 |
| Ticket Builder / Intake | raw request を AI-readable な AI Work Ticket に変換する。人間向けの文章をそのまま AI 用一覧に置かない |
| AI Work Ticket Spreadsheet | AI が読む正本一覧。外部 issue や CodeCommit / PR は source / evidence として扱う |
| Orchestrator Agent | 状態、制約、予算、チケット、PR、CI、dependency、post-merge signal を読み、起動する Pattern を選ぶ |
| Pattern Picker | どの Loop Pattern を起動するかだけを決める。ticket schema、status、差し戻し文面は定義しない |
| daily-triage | AI Work Ticket の棚卸し、構造検査、human gate 判定、Kiro 要否、実装 agent 振り分け候補、status / comment 更新案を作る |
| Kiro | Loop Pattern ではない。仕様を詰める必要がある場合に daily-triage から呼ばれる spec refinement tool |
| Implementation Agent | L2 以降で、人間承認後に branch 上で実装する |
| Verifier Agent | L2 以降で、実装結果が scope、test、risk、constraints、human gate に合っているか確認する |

## Pattern Selection Flow

```mermaid
flowchart TD
  A["Loop start"] --> B["Read loop-constraints.md"]
  B --> C["Read loop-budget.md"]
  C --> D{"Global stop condition?"}
  D -->|yes| STOP["No pattern<br/>record blocked reason"]
  D -->|no| E["Collect signals"]

  E --> F{"CI failure is primary?"}
  F -->|yes| F1{"ci-sweeper active?"}
  F1 -->|yes| CI["Run ci-sweeper"]
  F1 -->|no| DT1["Run daily-triage<br/>record CI signal report-only"]

  F -->|no| G{"PR review conflict approval issue?"}
  G -->|yes| G1{"pr-babysitter active?"}
  G1 -->|yes| PR["Run pr-babysitter"]
  G1 -->|no| DT2["Run daily-triage<br/>record PR signal report-only"]

  G -->|no| I{"Dependency update alert noise?"}
  I -->|yes| I1{"dependency-sweeper active?"}
  I1 -->|yes| DEP["Run dependency-sweeper"]
  I1 -->|no| DT3["Run daily-triage<br/>record dependency signal report-only"]

  I -->|no| J{"Post-merge cleanup or debt?"}
  J -->|yes| J1{"post-merge-cleanup active?"}
  J1 -->|yes| PMC["Run post-merge-cleanup"]
  J1 -->|no| DT4["Run daily-triage<br/>record cleanup signal report-only"]

  J -->|no| K{"Changelog target?"}
  K -->|yes| K1{"changelog runtime ready?"}
  K1 -->|yes| CL["Run changelog-drafter"]
  K1 -->|no| DT5["Run daily-triage<br/>record changelog signal report-only"]

  K -->|no| DT["Run daily-triage"]
```

現時点では active Pattern は `daily-triage` のみである。そのため、他 Pattern の signal が出ても直接起動せず、`daily-triage` の L1 report-only で記録する。

## Daily Triage L1 Flow

```mermaid
flowchart TD
  A["daily-triage start"] --> B["Read required docs<br/>contract schema intake constraints budget"]
  B --> C["Read AI Work Ticket Spreadsheet"]
  C --> D["Inventory tickets"]
  D --> E{"Raw human request mixed in?"}
  E -->|yes| TB["propose ticket_builder_required<br/>draft proposed_ai_comment"]
  E -->|no| F{"Required columns complete?"}
  F -->|no| TB
  F -->|yes| G{"Feature ticket detail enough?"}
  G -->|no| TB
  G -->|yes| H["Classify work type and risk"]

  H --> I{"Deny list or stop condition?"}
  I -->|yes| BLOCK["propose blocked_by_constraints<br/>draft blocked reason"]
  I -->|no| J{"Human gate required?"}
  J -->|yes| HUMAN["propose needs_human_management<br/>draft decision_needed"]
  J -->|no| K{"Spec refinement needed?"}
  K -->|yes| KIRO["propose ready_for_kiro<br/>cc-sdd or Kiro path"]
  K -->|no| L{"Implementation ready?"}
  L -->|yes| IMPL["propose ready_for_implementation<br/>suggest agent and autonomy"]
  L -->|no| PEND["propose pending or no_action_required"]

  TB --> OUT["Write human comment columns<br/>and record loop-run-log.md"]
  BLOCK --> OUT
  HUMAN --> OUT
  KIRO --> OUT
  IMPL --> OUT
  PEND --> OUT
  OUT --> STATE["Update STATE.md only with durable Loop state"]
```

L1 の `daily-triage` は実装しない。branch 作成、PR 作成、merge、canonical status の直接更新は行わない。出力は AI Work Ticket spreadsheet の Human Communication columns / L1 Proposed Updates columns、`loop-run-log.md` の proposed update / proposed comment、`STATE.md` に残すべき永続 state に限定する。

この図に出てくる comment は、external issue や PR に投稿するコメントではない。L1 では、AI Work Ticket spreadsheet の `ai_comment_type`, `ai_comment_summary`, `decision_needed`, `questions_for_human`, `default_assumption`, `reply_format` に人間向けコメントを書き込む。あわせて、`proposed_ai_comment`, `proposed_status`, `proposed_update_reason`, `last_loop_run_id`, `triage_notes` に提案履歴を残す。

## AI Work Ticket Lifecycle

この図は処理手順ではなく、AI Work Ticket の status 遷移候補を表す。`ready_for_triage` に入った ticket を daily-triage が確認し、条件に応じて次の status を提案する。

L1 では、この status 遷移は実際の ticket 更新ではない。`proposed_status` として記録するだけである。

```mermaid
stateDiagram-v2
  [*] --> human_origin_input
  human_origin_input --> intake_clarification: insufficient_for_ticket
  intake_clarification --> ticket_builder
  human_origin_input --> ticket_builder: enough_context
  ticket_builder --> ready_for_triage: AI-readable row created
  ready_for_triage --> ticket_builder_required: structure_missing
  ready_for_triage --> needs_human_management: decision_required
  ready_for_triage --> blocked_by_constraints: deny_or_budget
  ready_for_triage --> ready_for_kiro: spec_refinement_required
  ready_for_triage --> ready_for_implementation: implementation_ready
  ready_for_triage --> pending: wait_or_recheck_later
  ready_for_triage --> no_action_required: no_work_needed
  ready_for_implementation --> implementation_in_progress: L2_human_approved
  implementation_in_progress --> under_verification
  under_verification --> human_gate_pending: gate_required
  under_verification --> done: red_qa_tester_verifier_approved
  human_gate_pending --> under_verification: approved_and_retest_required
```

この lifecycle は canonical status の候補を示す。L1 ではこれらを直接書き換えず、`proposed_status` として提示する。

## L2 And L3 On-Demand Execution Flow

本PJでは最大L3まで許可済みである。ただし L2 / L3 は scheduled run ではなく、対象 ticket の Activation Record がある場合だけ Orchestrator Agent はこの flow を実行できる。

```mermaid
flowchart TD
  A["L1 proposed ready_for_implementation"] --> B{"Human approves L2 or L3?"}
  B -->|no| WAIT["Remain pending or needs_human_management"]
  B -->|yes| C["Re-read constraints and loop-human-gates.md"]
  C --> D{"Kiro spec required?"}
  D -->|yes| K1["Run Kiro requirements design tasks"]
  K1 --> K2{"Human approves spec?"}
  K2 -->|no| WAIT
  K2 -->|yes| E["Create branch"]
  D -->|no| E

  E --> F["Implementation Agent works on branch"]
  F --> G["Run required checks"]
  G --> R["Red Team reviews completion claim"]
  R --> ROK{"Red Team APPROVE?"}
  ROK -->|no| WAIT
  ROK --> QA["QA Agent checks coverage and evidence"]
  QA --> QAOK{"QA passed?"}
  QAOK -->|no| WAIT
  QAOK --> T["Tester Agent executes tests and records results"]
  T --> TOK{"Tester passed?"}
  TOK -->|no| WAIT
  TOK --> H["Verifier Agent reviews scope tests risk gates"]
  H --> V{"Verifier APPROVE?"}
  V -->|no| WAIT
  V -->|yes| I{"Human gate triggered?"}
  I -->|yes| HG["Human reviews before proceeding"]
  HG --> J{"Approved?"}
  J -->|no| WAIT
  J -->|yes| L3PR{"L3 + PR creation allowed?"}
  I -->|no| L3PR
  L3PR -->|no| PKG["Record PR package only"]
  L3PR -->|yes| PR["Invoke codecommit_pr_agent<br/>create draft-equivalent CodeCommit PR"]
  PKG --> WAIT
  PR --> RFR{"Ready for review approval?"}
  RFR -->|no| WAIT
  RFR -->|yes| MERGE["Merge only by explicit human approval"]
  MERGE --> POST["post-merge-cleanup signal"]
```

L2 / L3 では branch 作成や実装 agent 起動を許可できる設計にする。ただし、常時許可ではなく、対象 ticket の Activation Record が必要である。許可後も、人間承認、constraints、`loop-human-gates.md`、verification を通過することが前提である。CodeCommit を使う想定のため、PR 作成は GitHub issue / PR 前提ではなく、`docs/codecommit-pr-contract.md` に定義した CodeCommit の AWS command 経路を想定する。

## Safety Gate Flow

```mermaid
flowchart TD
  A["Before every Loop or action"] --> B["Read loop-constraints.md"]
  B --> C["Check deny list"]
  C --> D{"Forbidden action?"}
  D -->|yes| STOP["Stop<br/>blocked_by_constraints"]
  D -->|no| E["Check human gate"]
  E --> F{"Gate required?"}
  F -->|yes| HUMAN["Ask human<br/>record reason and decision_needed"]
  F -->|no| G["Check budget and kill switch"]
  G --> H{"Budget or pause blocked?"}
  H -->|yes| STOP
  H -->|no| I["Continue within autonomy level"]
```

Human gate は、DB schema、認可、{{MONEY_DOMAIN}}、{{BILLING_DOMAIN}}、{{RESERVATION_DOMAIN}}、PDF 生成結果、{{DAILY_LOCK_DOMAIN}}、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master、infrastructure、config、production、release、deploy、merge に関係する場合に厳格に扱う。{{MONEY_DOMAIN}}や PDF はファイル単位ではなく、該当処理の意味が変わるかで判定する。

## Read And Write Boundaries

| Layer | Reads | Writes in L1 | Writes in L2+ |
|-------|-------|--------------|---------------|
| Orchestrator | constraints、budget、state、run-log、Pattern Picker、spreadsheet、signals | run-log、state | branch / ticket / PR 操作は承認後のみ |
| Ticket Builder / Intake | human-origin input、source、evidence | AI Work Ticket row draft | AI Work Ticket row 作成 / 更新 |
| daily-triage | spreadsheet、contract、schema、constraints、budget、state | Human Communication columns、L1 Proposed Updates columns、run-log、state | 承認済み範囲で ticket status 更新 |
| Pattern-specific skills | PR、CI、dependency、post-merge evidence | analysis and report only | 承認済み範囲で remediation / PR operation |
| Implementation Agent | AI Work Ticket、spec、code、constraints | none | branch 上の code change |
| Verifier Agent | diff、test result、constraints、acceptance criteria | verification report | verifier status / reviewer comment draft / `codecommit_comment_agent` handoff |

## Current Pattern Runtime Status

| Pattern | Document | Skill | State | Runtime status |
|---------|----------|-------|-------|----------------|
| `daily-triage` | yes | yes | `STATE.md` | active L1 report-only |
| `ci-sweeper` | yes | yes | yes | scaffolded inactive |
| `pr-babysitter` | yes | yes | yes | scaffolded inactive |
| `dependency-sweeper` | yes | yes | yes | scaffolded inactive |
| `post-merge-cleanup` | yes | yes | yes | scaffolded inactive |
| `changelog-drafter` | yes | no | no | documented no runtime |

## Autonomy Runtime Status

| Autonomy | Documented | Currently permitted | Notes |
|----------|------------|---------------------|-------|
| L0 | yes | yes | 人間判断のみ。Loop は実行しない |
| L1 | yes | yes | `daily-triage` report-only のみ許可 |
| L2 | yes | activation_required | 対象 ticket ごとの Activation Record がある場合だけ branch 作成、限定実装、verifier 依頼、PR package 作成を許可 |
| L3 | yes | activation_required | 対象 ticket ごとの Activation Record がある場合だけ L2 に加えて限定的な自律修正、`codecommit_pr_agent` による CodeCommit PR 作成、`codecommit_comment_agent` による reviewer comment 投稿を許可 |

## Current Next Step

First Loop manual test は `2026-07-03T17:09:39+09:00-daily-triage-l1-test` として実行済みである。

現在の次 step は、`AIT-TEST-0001` について人間が次を判断することである。

- Kiro spec 作成に進めるか
- 既存DBに FAQ 相当テーブルがあるか
- 削除方式を物理削除、論理削除、既存標準のどれに合わせるか
- 参考にすべき管理画面 CRUD はどれか

この判断があるまでは、実装、branch 作成、PR 作成、merge、canonical ticket status の直接更新は行わない。未 active Pattern signal が出た場合も、引き続き `daily-triage` の L1 report-only で記録する。
