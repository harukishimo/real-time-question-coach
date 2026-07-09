# AI Work Ticket Contract

このドキュメントは、Realtime Question Coach の Loop Engineering で扱う AI Work Ticket の最小契約を定義する。

AI Work Ticket は、AI が読むチケット一覧に登録される実行単位である。人間が書いた依頼、Issue、PR コメント、会話メモなどの raw input は AI Work Ticket ではない。raw input は Ticket Builder / Intake が読み取り、AI が作業できる構造まで変換してから AI Work Ticket として登録する。

AI Work Ticket の正本一覧は、1ページのスプレッドシートで管理する。列定義は `docs/ai-work-ticket-spreadsheet-schema.md` に従う。外部 issue、PR、repository service 上の情報は source または evidence として参照できるが、AI Work Ticket の正本一覧ではない。AI agent は外部 issue / repository issue 一覧をそのまま AI Work Ticket 一覧として扱わない。

## Responsibility Boundary

| Component | Responsibility |
|-----------|----------------|
| Ticket Builder / Intake | Human-origin input を AI-readable な AI Work Ticket に変換する。構造不足の差し戻しを受ける |
| AI Work Ticket Contract | AI Work Ticket の必須 field、status、差し戻し理由、human management 理由の形式を定義する |
| Orchestrator Agent | チケット一覧の件数、status、signal を見て Loop Pattern を起動する。raw human request は実行しない |
| Pattern Picker | どの Loop Pattern を起動するかを決める。AI Work Ticket の schema や status は定義しない |
| daily-triage Pattern | AI Work Ticket の構造検査、status 更新案、Kiro 呼び出し判断、実装 agent 振り分け判断を行う |
| Implementation Agent | `ready_for_implementation` 以降で、許可された autonomy と制約の範囲内だけ実装する |

現時点の運用は L1 report-only である。そのため、external issue / PR への直接書き戻しは前提にしない。daily-triage は AI Work Ticket spreadsheet の Human Communication columns と L1 Proposed Updates columns に、人間が判断するための comment、status 更新案、次 owner 案、理由を書き込む。canonical な `status`, `next_owner`, ticket 本体の書き戻しは L2 以上かつ human approval 後に限る。

## Contract Principles

- AI が読むチケット一覧には AI Work Ticket だけを置く。
- AI Work Ticket 一覧はスプレッドシートを正とする。
- 外部 issue、PR、repository service 上の情報は source / evidence として扱い、AI Work Ticket の保管場所として扱わない。
- raw human request、未整理メモ、会話ログを AI Work Ticket 一覧に混ぜない。
- AI Work Ticket は「何を解決するか」「どこまでやるか」「何をやらないか」「何で完了と判断するか」を持つ。
- 新機能、仕様変更、責務境界がある work item は、Issue 本文相当の粒度で概要、背景・目的、現状、期待状態、対象範囲、対象外、要件、完了条件、テスト観点、実装注意を持つ。
- 構造不足のチケットは実行しない。`ticket_builder_required` として差し戻し理由を残す。
- 人間の判断が必要なチケットは実行しない。`needs_human_management` として理由、判断観点、次 owner を残す。
- deny list に該当する作業は実行しない。`blocked_by_constraints` として根拠 rule を残す。
- 今は実行しないが後で再確認するものは `pending` とし、対応不要と判断したものは `no_action_required` として分ける。
- Pattern 選択と Ticket schema を混ぜない。`selected_pattern` は Pattern Picker / run log の責務であり、必須 ticket field ではない。

## Minimum Required Fields

Ticket Builder / Intake は、AI Work Ticket 作成時に最低限次の field を埋める。

```yaml
ticket_id:
title:
status: ready_for_triage
source:
  type: human_input | issue | pr_comment | conversation | spec | incident | other
  link:
  summary:
understanding:
  overview:
  background_purpose:
  problem:
  current_state:
  desired_state:
  target_users:
  evidence:
    - type:
      ref:
      summary:
  unknowns:
scope:
  in:
  out:
  affected_areas:
  screen_scope:
  functional_scope:
  data_scope:
detailed_requirements:
  screen_requirements:
  functional_requirements:
  data_requirements:
  validation_requirements:
  permission_requirements:
  implementation_notes:
  reference_info:
agent_alignment:
  intent_summary:
  success_boundary:
  non_goals:
  assumptions:
  decisions_already_made:
  expected_agent_behavior:
  handoff_notes:
risk:
  level: low | medium | high
  reasons:
constraints:
  forbidden_actions:
  human_gate_required: true | false | unknown
  human_gate_reason:
  deny_list_checked: true | false
verification:
  acceptance_criteria:
  required_checks:
  test_perspectives:
  test_plan:
cc_sdd:
  required: true | false | unknown
  reason:
loop_policy:
requested_outcome:
```

`unknowns` は空である必要はない。ただし、実装可否、scope、受け入れ基準、risk、human gate の判断に関わる unknown が残っている場合、daily-triage は実装へ進めない。

`overview` と `background_purpose` は、Issue 本文の概要、背景・目的に相当する。背景を `source.summary` に閉じ込めず、なぜ作業が必要かを AI Work Ticket 本体に残す。

`detailed_requirements` は、新機能、仕様変更、責務境界がある ticket では実質必須である。画面、機能、データ、バリデーション、権限、実装注意を分けて残すことで、daily-triage、Kiro spec、実装 agent の認識ズレを防ぐ。

`cc_sdd` は、cc-sdd / Kiro spec workflow に渡すべきかの判断である。`cc_sdd.required` は仕様駆動開発の必要性、`triage.kiro_required` は実際に Kiro workflow へ渡す実行判断として扱う。

`loop_policy` は、その ticket を L1 / L2 以降でどう扱うかを示す。branch 作成、PR 作成、human approval、merge の扱いをここに残す。

`agent_alignment` は、daily-triage または後続の coding agent が認識をずらさずに作業するための block である。Ticket Builder / Intake は、何を実現するかだけでなく、何をしないか、どの判断がすでに済んでいるか、agent がどう振る舞うべきかをここに残す。

## Optional Triage Fields

daily-triage は、構造検査後に必要に応じて次を追記する。

```yaml
triage:
  work_type: bug_fix | feature | spec_refinement | docs | test | ops | cleanup | unknown
  suggested_next_action: return_to_builder | needs_human | refine_spec | ready_to_implement | mark_pending | mark_no_action_required | block_by_constraints | no_op
  kiro_required: true | false
  implementation_agent_type:
  branch_required: true | false
  verifier_required: true | false
  allowed_autonomy: L0 | L1 | L2 | L3
  notes:
```

この block は Pattern Picker の代替ではない。個別 ticket の実行準備状態を表すための補助情報である。

## Statuses

| Status | Meaning | Next owner |
|--------|---------|------------|
| `ready_for_triage` | Ticket Builder が AI-readable として登録した。daily-triage が構造検査できる | daily-triage |
| `triage_in_progress` | daily-triage が構造、risk、constraints、次 action を確認中 | daily-triage |
| `ticket_builder_required` | AI Work Ticket として構造不足。実行せず Ticket Builder / Intake に差し戻す | Ticket Builder / Intake |
| `needs_human_management` | 人間の判断、補足、承認、優先度調整が必要 | Human |
| `blocked_by_constraints` | deny list、kill switch、budget、禁止操作、権限不足により実行不可 | Human or Orchestrator |
| `out_of_scope` | 現在の Loop 管轄外、または Realtime Question Coach の対象外 | Human |
| `pending` | 依存情報、期日、外部状態、人間判断、別作業の完了待ちであり、現時点では実行しないが再確認対象として残す | Human, External, or Orchestrator |
| `no_action_required` | triage の結果、Loop が対応する作業はない。理由と証跡を残して対応不要として扱う | Orchestrator |
| `ready_for_kiro` | 仕様精緻化が必要。Kiro discovery / spec workflow に渡す | Orchestrator / daily-triage |
| `ready_for_implementation` | 仕様、scope、受け入れ基準、constraints が揃い、実装判断に進める | Orchestrator |
| `implementation_in_progress` | L2 以上で実装 agent が作業中 | Implementation Agent |
| `under_verification` | verifier / reviewer / test 確認中 | Verifier / Reviewer |
| `human_gate_pending` | human gate 対象として判断待ち | Human |
| `done` | 必要な処理、検証、証跡、status 更新が完了 | Orchestrator |

## Status Update Requirements

status を変更する場合は、status だけを書き換えない。必ず理由と次 owner を残す。

```yaml
status_update:
  from:
  to:
  updated_by:
  updated_at:
  reason:
  next_owner:
  evidence:
```

L1 report-only では、上記を canonical `status` として書き戻さず、AI Work Ticket spreadsheet の `proposed_status`, `proposed_next_owner`, `proposed_update_reason`, `last_loop_run_id` と、`loop-run-log.md` の `proposed_ticket_updates` に記録する。

## AI Comment Requirements

daily-triage が AI Work Ticket を確認した場合、status 更新案だけではなく、人間が読める AI comment を残す。

AI comment は、構造化 payload をそのまま貼るのではなく、人間が次に何を判断、回答、承認すればよいか分かる文章にする。裏側の構造化情報は `intake_decision`、`ticket_builder_return`、`human_management`、`constraint_block`、`pending_reason`、`no_action_reason` などに残す。

```yaml
ai_comment:
  visibility: ticket_comment
  audience: human
  comment_type: clarification_request | status_update | human_gate_request | blocked_notice | pending_notice | no_action_notice | ready_notice
  title:
  summary:
  decision_needed:
  recommended_action:
  questions:
  default_assumption:
  risk_or_constraint_summary:
  next_owner:
  reply_format:
  structured_payload_ref:
```

L1 report-only では、external issue / PR へ直接 comment を投稿しない。人間が判断できるように、AI Work Ticket spreadsheet の `ai_comment_type`, `ai_comment_summary`, `decision_needed`, `questions_for_human`, `default_assumption`, `reply_format` に comment を書き込む。あわせて `loop-run-log.md` に `proposed_ticket_comments` として残す。

AI comment は次を満たす。

- 人間に判断してほしい内容を先に書く。
- なぜ回答や判断が必要かを書く。
- 推奨 default がある場合は明記する。
- 回答形式を指定する。
- agent 内部用の長い YAML をそのまま本文にしない。
- status 変更、pending、no action、blocked、human gate のいずれでも、人間が見て現在状態を理解できるようにする。

## Pending And No Action Rules

`pending` は、次回以降の Loop で再確認する余地がある状態である。単に判断が面倒なものを `pending` にしない。

```yaml
pending_reason:
  status: pending
  waiting_for:
    - human_decision
    - external_state
    - due_date
    - dependent_ticket
    - connector_or_permission
  why_pending:
  next_check:
  unblock_condition:
  next_owner:
```

`no_action_required` は、対応不要として扱う終端状態である。`done` は実作業や検証が完了した状態、`no_action_required` は作業自体が不要と判断された状態として区別する。

```yaml
no_action_reason:
  status: no_action_required
  reason_category:
    - duplicate
    - already_resolved
    - not_reproducible
    - informational_only
    - superseded
    - out_of_date
    - not_ai_work
  why_no_action_required:
  evidence:
  reopen_condition:
```

`pending` と `no_action_required` のどちらにするか迷う場合は、再確認条件が明確なら `pending`、再確認しても Loop の作業が発生しないなら `no_action_required` とする。

## Ticket Builder Return Format

構造不足の場合、daily-triage は実行せず、次の形式で Ticket Builder / Intake へ差し戻す。

```yaml
ticket_builder_return:
  status: ticket_builder_required
  reason_category:
    - missing_required_fields
    - ambiguous_scope
    - insufficient_evidence
    - acceptance_criteria_missing
    - raw_human_input_detected
    - unsafe_request
  why_not_executable:
  missing_fields:
  required_clarifications:
  required_rewrite:
  suggested_next_status: ready_for_triage
```

差し戻し理由は、人間にも Ticket Builder にも読める文章にする。単に「情報不足」と書かない。

## Human Management Reason Format

人間の管理が必要な場合、daily-triage は次の形式で理由を残す。

```yaml
human_management:
  status: needs_human_management
  category:
    - requirement_decision
    - priority_decision
    - business_risk
    - money_or_billing
    - reservation_or_daily_lock
    - kpi_or_management
    - external_integration
    - bugyo_or_accounting_master
    - database_or_infrastructure
    - auth_or_permission
    - legal_or_pdf_output
    - unclear_ownership
  why_human_needed:
  decision_needed:
  affected_scope:
  evidence:
  options:
  recommended_next_owner:
```

human gate の詳細条件は `loop-human-gates.md` を正とする。

{{MONEY_DOMAIN}}・PDF に関しては、path だけで判定しない。{{MONEY_DOMAIN}}計算、承認、保存、外部出力、PDF 生成物、宛先、法務・{{ACCOUNTING_DOMAIN}}上の意味に影響する場合に human gate とする。単純な文言追加や表示ラベル変更だけなら、この条件だけでは human gate にしない。

daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master、DB / infrastructure は厳格に扱う。path 一致だけでも human gate または deny list 対象にしてよい。

## Constraint Block Format

deny list、kill switch、budget、権限不足に該当する場合、実行せず次を残す。

```yaml
constraint_block:
  status: blocked_by_constraints
  rule_refs:
  denied_actions:
  why_blocked:
  safe_next_step:
  human_gate_required: true
```

外部 API service / connector file、`config/**`、secret、production、破壊的 git 操作、data mutation script は `loop-constraints.md` を正として扱う。

## Ready For Implementation

次をすべて満たす場合だけ、`ready_for_implementation` にできる。

- 必須 field が埋まっている。
- `scope.in` と `scope.out` が明確である。
- `agent_alignment` が埋まっており、intent、success boundary、non-goals、assumptions が確認できる。
- `acceptance_criteria` と `test_plan` がある。
- 新機能、仕様変更、責務境界がある場合は `overview`, `background_purpose`, `detailed_requirements`, `cc_sdd`, `loop_policy` がある。
- blocking unknown がない。
- `risk.level` が評価済みで、理由がある。
- `loop-constraints.md` の deny list に該当しない。
- human gate が必要な場合は、実装前に `human_gate_pending` へ移す。
- 仕様精緻化が必要な場合は、先に `ready_for_kiro` へ移す。

L2 以上で実装に進む場合は、追加で次を満たす。

- branch 作成が許可されている。
- verifier が必要か判断済みである。
- 関連 test または検証方法が明確である。
- 自動 merge しないことが明確である。

## Done Criteria

`done` にするには、次の証跡が必要である。

- requested outcome が満たされた。
- 実行した action と実行しなかった action が記録されている。
- test / verification の結果、または実行できなかった理由がある。
- 実装agent本人の自己判定だけで完了扱いにしていない。
- Red Team review が実施され、`adversarial_review_agent` 相当の verdict が `APPROVE` である。
- QA Agent review が実施され、acceptance criteria、required checks、test plan、negative case、security/storage/logging観点の traceability が `passed` である。
- Tester Agent execution が実施され、実際の試験コマンド、test file、fixture、ブラウザ/viewport、pass/fail/not_run、trace/screenshot有無が記録され、結果が `passed` である。
- Red Team、QA Agent、Tester Agent の finding が残っている場合は、Purple Team coordination により `fixed_and_retested`、`human_gate_pending`、または `blocked` のいずれかに整理されている。
- Verifier が Red Team `APPROVE`、QA `passed`、Tester `passed` の証跡を確認し、最終 verdict として `APPROVE` を返している。
- human gate が必要な場合は、承認または判断結果が残っている。
- deny list 違反がない。
- 次回 Loop が見るべき残事項が `STATE.md` または `loop-run-log.md` に残っている。

次の状態では `done` にしてはいけない。

- Red Team が未実施、または `APPROVE` 以外である。
- QA Agent または Tester Agent が未実施、または `passed` 以外である。
- 試験結果に `not_run` があるが、理由、残リスク、次ownerが記録されていない。
- Playwright や API test が必要な画面/API ticketで、画面クリックだけ、コード目視だけ、または happy path 1本だけを根拠にしている。
- Verifier が Red Team / QA / Tester の証跡を確認していない。

## Invalid Ticket Examples

次の状態は AI Work Ticket として実行しない。

- source の summary だけで、problem / current_state / desired_state がない。
- 背景・目的がなく、なぜ対応するのかが分からない。
- scope.in はあるが scope.out がない。
- 新機能なのに画面要件、機能要件、データ要件、権限要件、テスト観点が分かれていない。
- acceptance criteria がない。
- 「いい感じに直す」「調査して対応」だけで requested outcome がない。
- raw human request がそのまま貼られている。
- secret、production、外部 API connector、data mutation script の変更を要求している。
- {{MONEY_DOMAIN}}、{{RESERVATION_DOMAIN}}、{{DAILY_LOCK_DOMAIN}}、KPI、{{ACCOUNTING_SYSTEM}}、DB、infra に影響するのに human gate 判断が `unknown` のまま。

## Valid Minimal Example

```yaml
ticket_id: AWT-2026-0001
title: {{ESTIMATE_DOMAIN}}画面の補助文言を追加する
status: ready_for_triage
source:
  type: issue
  link: https://example.invalid/issues/1
  summary: {{ESTIMATE_DOMAIN}}画面で注意文言が不足している
understanding:
  overview: {{ESTIMATE_DOMAIN}}画面に補助文言を追加する
  background_purpose: 入力時の迷いを減らし、問い合わせを減らすため
  problem: {{ESTIMATE_DOMAIN}}画面の入力補助説明が不足している
  current_state: 対象画面に補助文言が表示されていない
  desired_state: 指定箇所に補助文言が表示される
  target_users: internal_user
  evidence:
    - type: screenshot
      ref: issue attachment
      summary: 対象箇所の表示確認
  unknowns: []
scope:
  in:
    - 表示文言の追加
  out:
    - {{MONEY_DOMAIN}}計算
    - 承認処理
    - PDF / CSV 出力
    - 外部連携
  affected_areas:
    - estimate_view
  screen_scope:
    - {{ESTIMATE_DOMAIN}}画面
  functional_scope:
    - 表示文言追加
  data_scope: none
detailed_requirements:
  screen_requirements:
    - 指定箇所に補助文言を表示する
  functional_requirements:
    - 表示のみ
  data_requirements: none
  validation_requirements: none
  permission_requirements: none
  implementation_notes:
    - {{MONEY_DOMAIN}}、承認、{{REPORT_DOCUMENT_DOMAIN}}処理へ広げない
  reference_info:
    - issue attachment
agent_alignment:
  intent_summary: {{ESTIMATE_DOMAIN}}画面で入力時の迷いを減らす
  success_boundary: 指定箇所に補助文言が表示される
  non_goals:
    - {{MONEY_DOMAIN}}計算
    - 承認処理
    - PDF / CSV 出力
    - 外部連携
  assumptions:
    - 表示文言のみの変更である
  decisions_already_made:
    - {{MONEY_DOMAIN}}、承認、{{REPORT_DOCUMENT_DOMAIN}}処理には触れない
  expected_agent_behavior:
    - 表示変更に限定し、処理ロジックへ広げない
  handoff_notes:
    - daily-triage は low risk 表示変更として扱える
risk:
  level: low
  reasons:
    - 表示文言のみで{{MONEY_DOMAIN}}処理に触れない
constraints:
  forbidden_actions:
    - {{MONEY_DOMAIN}}計算の変更
    - PDF 出力処理の変更
  human_gate_required: false
  human_gate_reason:
  deny_list_checked: true
verification:
  acceptance_criteria:
    - 指定箇所に文言が表示される
    - {{MONEY_DOMAIN}}、承認、PDF / CSV 出力に差分がない
  required_checks:
    - view rendering check
  test_perspectives:
    - 対象画面で文言が表示される
    - {{MONEY_DOMAIN}}、承認、PDF / CSV 出力に差分がない
  test_plan:
    - 対象画面を表示して文言を確認する
cc_sdd:
  required: false
  reason: 表示文言のみの小変更であり、仕様分解を要する新機能ではない
loop_policy: L1 では low risk 表示変更として扱い、実装に進む場合も{{MONEY_DOMAIN}}、承認、{{REPORT_DOCUMENT_DOMAIN}}処理へ広げない
requested_outcome: {{ESTIMATE_DOMAIN}}画面に補助文言を追加する
```
