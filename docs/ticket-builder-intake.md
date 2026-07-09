# Ticket Builder / Intake

このドキュメントは、Human-origin input を AI-readable な AI Work Ticket に変換する Ticket Builder / Intake 層の責務を定義する。

Ticket Builder / Intake は、Loop Pattern ではない。Orchestrator Agent が直接起動する Pattern でもない。人間が書いた依頼、Issue、PR コメント、会話メモ、口頭メモ相当の情報を読み取り、`docs/ai-work-ticket-contract.md` に従って AI Work Ticket を作る前段の処理である。

AI Work Ticket の登録先は、外部 issue / repository issue ではなくスプレッドシートである。列定義は `docs/ai-work-ticket-spreadsheet-schema.md` に従う。外部 issue、PR、repository service 上の情報は input source として扱えるが、AI が読む正本のチケット一覧として扱わない。

## Purpose

- raw human request を AI が読むチケット一覧に混ぜない。
- 人間の曖昧な依頼を、AI が実行可否を判断できる構造へ変換する。
- daily-triage と後続の coding agent が、同じ intent、scope、non-goals、完了条件を読んで作業できる状態にする。
- Issue 本文相当の概要、背景・目的、現状、期待状態、画面要件、権限、完了条件、テスト観点、実装注意を、AI Work Ticket の該当列へ分解する。
- AI Work Ticket 作成前に、scope、risk、constraints、verification の最低限を揃える。
- 構造不足、判断不足、証跡不足がある場合は、AI Work Ticket を作らず Intake 側で差し戻す。
- すでに AI Work Ticket 一覧へ混入した構造不足 ticket は、daily-triage が `ticket_builder_required` として差し戻す。

## Position In Loop Engineering

| Layer | Role |
|-------|------|
| Human-origin input | 人間の依頼、Issue、PR コメント、会話メモ、Slack 相当の文脈、口頭メモ |
| Ticket Builder / Intake | raw input を読み、AI Work Ticket Contract に従って構造化する |
| AI Work Ticket Contract | 必須 field、status、差し戻し形式、human management 理由の正本 |
| AI Work Ticket List | AI が読む実行候補一覧。1ページのスプレッドシートで管理し、raw input は置かない |
| Orchestrator Agent | チケット一覧の signal を見て Pattern Picker に従い Loop Pattern を起動する |
| daily-triage Pattern | AI Work Ticket の構造検査、status 更新案、Kiro / 実装 / human gate の判断を行う |

将来、Ticket Builder / Intake は `.codex/skills/ticket-builder-intake/SKILL.md` または専用 agent として実装できる。ただし現時点では、まずこのドキュメントを運用ルールの正本として扱う。

## Inputs

Ticket Builder / Intake が読む input は、AI Work Ticket ではない。以下は source material である。

- 人間が書いた依頼
- Issue
- PR コメント
- 会話メモ
- Slack 相当のやり取り
- 口頭メモを転記したもの
- 既存 spec / Kiro spec
- bug report
- CI / PR / log / screenshot などの evidence

input が複数 source に分かれている場合、Ticket Builder / Intake は source を統合してから AI Work Ticket を作る。重要な根拠は `source.summary` と `understanding.evidence` に残す。

外部 issue / repository issue を source として読む場合も、Issue 自体を AI Work Ticket とみなさない。AI Work Ticket 化する場合は、スプレッドシートの1行として登録し、Issue URL は `source_link` または evidence として残す。

## Outputs

Ticket Builder / Intake の output は、次のいずれかである。

| Output | When |
|--------|------|
| AI Work Ticket | 必須 field、scope、risk、constraints、verification が揃っている |
| Intake clarification request | 人間への確認が必要で、AI Work Ticket をまだ作れない |
| Intake no-action record | 対応不要、重複、情報共有のみなど、AI Work Ticket を作る必要がない |
| Intake pending record | 期日、外部状態、人間判断、別 ticket の完了待ちで、今は AI Work Ticket 化しない |

`ticket_builder_required` は、原則として daily-triage が AI Work Ticket 一覧で構造不足 ticket を見つけたときに使う status である。Ticket Builder / Intake 自身が raw input を処理している段階では、構造不足なら AI Work Ticket を作らず Intake clarification request として止める。

人間へ伝える場合は、上記 output をそのまま YAML で見せない。チケットの comment には `human_message` または `ai_comment` として、人間が判断しやすい文章を残す。構造化 payload は agent が読む内部情報として保持する。

## Non-Goals

Ticket Builder / Intake は次を行わない。

- Pattern Picker の代わりに Loop Pattern を選ばない。
- daily-triage の代わりに status 更新案を運用しない。
- 実装 agent を起動しない。
- branch、PR、merge、deploy を行わない。
- raw human request をそのまま AI Work Ticket として登録しない。
- secret、credential、production data を読まない。
- deny list に該当する作業を実行可能 ticket にしない。

## Intake Workflow

1. Source を収集する。
2. raw human request と evidence を分ける。
3. overview、background_purpose、problem、current_state、desired_state、target_users を復元する。
4. scope.in と scope.out を明確にする。
5. screen_scope、functional_scope、data_scope、affected_areas を推定する。
6. 画面要件、機能要件、データ要件、バリデーション、権限、実装注意、参考情報を分ける。
7. `loop-constraints.md` と `loop-human-gates.md` を参照し、deny list と human gate を事前確認する。
8. risk.level と reasons を設定する。
9. agent_alignment を作成し、後続 agent の認識ズレを防ぐ。
10. acceptance_criteria、required_checks、test_perspectives、test_plan を定義する。
11. cc-sdd / Kiro workflow が必要か判断し、loop_policy を定義する。
12. unknowns を明示する。
13. AI Work Ticket として作成できるか判断する。
14. 作成できる場合だけ、AI Work Ticket spreadsheet の1行として登録する。

Intake 時点で不明点が残っていても、すべてが blocker とは限らない。実装可否、scope、受け入れ基準、risk、human gate に関わる unknown が残る場合は AI Work Ticket 化しない。

## AI Work Ticket Creation Criteria

AI Work Ticket として登録するには、最低限次を満たす。

- `docs/ai-work-ticket-contract.md` の Minimum Required Fields が埋まっている。
- requested_outcome が明確である。
- overview と background_purpose があり、なぜ作業が必要かが分かる。
- scope.in と scope.out がある。
- agent_alignment があり、後続 agent が intent、success boundary、non-goals、assumptions を読める。
- acceptance_criteria がある。
- test_plan または検証方針がある。
- 新機能、仕様変更、責務境界がある場合は、画面要件、機能要件、データ要件、バリデーション、権限、実装注意、テスト観点が分かれている。
- cc-sdd 対象かどうかと、その理由がある。
- L1 / L2 以降の Loop 処理方針がある。
- risk.level と reasons がある。
- deny list checked の結果がある。
- human_gate_required が `true`, `false`, `unknown` のいずれかで明示されている。
- source は raw input の丸貼りではなく、summary と evidence に整理されている。

`human_gate_required: unknown` のまま AI Work Ticket にしてよいのは、daily-triage が判断可能な材料が十分に揃っている場合だけである。{{MONEY_DOMAIN}}、{{RESERVATION_DOMAIN}}、{{DAILY_LOCK_DOMAIN}}、KPI、外部連携、{{ACCOUNTING_SYSTEM}}、DB、infra に影響する可能性がある場合は、unknown のまま ready ticket にしない。

## Downstream Agent Alignment

Ticket Builder / Intake の目的は、チケット登録そのものではない。daily-triage と後続の coding agent が、同じ理解で判断、実装、検証できる状態を作ることである。

AI Work Ticket 作成時は、必ず次の `agent_alignment` block を埋める。

```yaml
agent_alignment:
  intent_summary:
  success_boundary:
  non_goals:
  assumptions:
  decisions_already_made:
  expected_agent_behavior:
  handoff_notes:
```

各 field の意味は次のとおり。

| Field | Meaning |
|-------|---------|
| `intent_summary` | この ticket がなぜ存在するか。実装内容ではなく目的を書く |
| `success_boundary` | どこまで満たせば成功か。過剰対応を防ぐ境界を書く |
| `non_goals` | 明示的にやらないこと。scope.out と重複してもよい |
| `assumptions` | agent が作業時に前提としてよいこと |
| `decisions_already_made` | 人間または Intake で決定済みの事項。再判断しないこと |
| `expected_agent_behavior` | daily-triage / coding agent に期待する振る舞い |
| `handoff_notes` | daily-triage、Kiro、実装 agent、verifier へ渡す補足 |

`agent_alignment` は、作業手順書ではない。認識ズレを防ぐための共通理解である。実装方法を過剰に固定せず、目的、境界、禁止事項、判断済み事項を明確にする。

## Initial Status Rules

Ticket Builder / Intake が作成する AI Work Ticket の初期 status は、原則として次のいずれかにする。

| Status | Use when |
|--------|----------|
| `ready_for_triage` | daily-triage が構造検査し、次 action を判断できる |
| `pending` | AI Work Ticket として形はあるが、期日、外部状態、人間判断、別 ticket 完了待ちで今は実行しない |
| `needs_human_management` | 作業内容は構造化できたが、人間の判断、承認、優先度調整、責務判断が先に必要 |
| `no_action_required` | audit trail として残す必要はあるが、Loop が対応する作業はない |

`ready_for_implementation` は Ticket Builder / Intake では付けない。実装可能性は daily-triage が Contract、constraints、risk、verification を確認した後に判断する。

## Clarification Request Format

AI Work Ticket を作れない場合、Ticket Builder / Intake は次の形式で人間または情報提供元へ差し戻す。

```yaml
intake_clarification_request:
  source_ref:
  reason_category:
    - missing_problem
    - missing_desired_state
    - ambiguous_scope
    - missing_acceptance_criteria
    - missing_evidence
    - human_decision_required
    - possible_deny_list
    - possible_human_gate
    - raw_request_too_broad
  why_ticket_not_created:
  questions:
    - question_id:
      decision_needed:
      why_needed_for_ai_work_ticket:
      field_to_complete:
      blocking_level: blocks_ticket_creation | blocks_implementation | improves_quality
      options:
        - label:
          meaning:
      recommended_default:
      expected_answer_format:
  required_evidence:
  suggested_rewrite:
  next_owner:
```

質問は「何が足りないか」ではなく、「AI Work Ticket にするために何を決める必要があるか」を書く。出力は自由文の質問リストではなく、`decision_needed`、`field_to_complete`、`blocking_level` を持つ構造化 list とする。

`field_to_complete` には、回答によって埋められる AI Work Ticket の field を書く。例: `understanding.desired_state`, `scope.out`, `verification.acceptance_criteria`, `agent_alignment.non_goals`。

`blocking_level` は次の意味で使う。

| Level | Meaning |
|-------|---------|
| `blocks_ticket_creation` | 回答がないと AI Work Ticket を作れない |
| `blocks_implementation` | ticket は作れるが、実装へ進めない |
| `improves_quality` | なくても進めるが、認識ズレのリスクを下げる |

## Human-Facing AI Comment

Ticket Builder / Intake または daily-triage が人間に確認、判断、承認を求める場合、チケットには AI comment を残す。

AI comment は人間向けの本文である。agent が読む `intake_decision` や `intake_clarification_request` は裏側の構造化 payload として扱う。

```yaml
human_message:
  title:
  summary:
  decision_needed:
  recommended_action:
  questions:
  default_assumption:
  reply_format:
```

チケット comment の本文は、上記を自然な文章にしたものにする。

```text
AI確認: AI Work Ticket 化に必要な確認があります

{{ESTIMATE_DOMAIN}}画面の補助文言追加として整理できますが、完了条件と変更対象外が未確定です。

確認したいこと:
1. どの画面、どの箇所に、どの文言が表示されれば完了ですか？
2. {{MONEY_DOMAIN}}計算、承認処理、PDF / CSV 出力は対象外でよいですか？

推奨前提:
表示文言のみの変更として扱います。

回答形式:
対象画面、表示箇所、表示文言、対象外にする処理を箇条書きで返信してください。
```

AI comment は次の用途で残す。

| Situation | Comment type | Purpose |
|-----------|--------------|---------|
| AI Work Ticket 化に確認が必要 | clarification request | 人間に不足判断を依頼する |
| human gate が必要 | human gate request | 承認、判断、優先度調整を依頼する |
| deny list / constraints で実行不可 | blocked notice | なぜ止めたか、次に何が必要かを伝える |
| pending | pending notice | 何待ちか、次回確認条件を伝える |
| no action required | no-action notice | 対応不要理由と再開条件を伝える |
| ready for triage / implementation | ready notice | 後続 Loop が扱える状態になったことを伝える |

L1 report-only では、external issue / PR へ直接 comment を投稿しない。AI Work Ticket spreadsheet の Human Communication columns には、人間が判断するための `ai_comment_type`, `ai_comment_summary`, `decision_needed`, `questions_for_human`, `default_assumption`, `reply_format` を書き込んでよい。あわせて `loop-run-log.md` に `proposed_ticket_comments` として残す。

## Pending Record Format

まだ AI Work Ticket として実行対象にしないが、後で再確認する場合は次を残す。

```yaml
intake_pending_record:
  source_ref:
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

pending は放置ではない。次回確認条件または解除条件を必ず持たせる。

## No Action Record Format

対応不要と判断する場合は、次を残す。

```yaml
intake_no_action_record:
  source_ref:
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

`no_action_required` は `done` ではない。作業した結果の完了ではなく、作業対象ではないと判断した状態である。

## Constraint And Human Gate Precheck

Ticket Builder / Intake は AI Work Ticket 作成前に `loop-constraints.md` を参照する。

次に該当する可能性がある場合、AI Work Ticket を安易に `ready_for_triage` にしない。

- secret、credential、production data、production deploy
- `config/**` の変更。`config/routes.rb` の新規 route 追加以外
- 外部 API service / connector file
- data mutation script、rake task、one-off script、direct SQL
- destructive git operation
- test の削除、skip、弱体化
- daily lock
- KPI / management
- 外部連携
- {{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master
- DB / schema / seed / master data
- infrastructure / dependency

{{MONEY_DOMAIN}}・PDF は path だけで gate しない。{{MONEY_DOMAIN}}計算、承認、保存、外部出力、PDF 生成物、宛先、法務・{{ACCOUNTING_DOMAIN}}上の意味に影響する場合に human gate とする。単純な文言追加や表示ラベル変更だけなら、それだけでは human gate にしない。

## Kiro Handoff

仕様が固まっていない場合、Ticket Builder / Intake は実装 ticket を作らない。

ただし、仕様を詰めること自体が目的の場合は、AI Work Ticket の requested_outcome を「Kiro で仕様精緻化する」にして作成できる。その場合は次を満たす。

- work_type は `spec_refinement` として扱える。
- 実装 scope と spec refinement scope を混ぜない。
- 実装完了条件ではなく、requirements / design / tasks の作成または更新を outcome にする。
- human review が必要な phase を明示する。
- daily-triage が `ready_for_kiro` にできるだけの source と evidence がある。

## Ticket Builder Quality Checklist

AI Work Ticket を作成する前に、次を確認する。

- raw human request をそのまま貼っていない。
- problem、current_state、desired_state が分かれている。
- requested_outcome が具体的である。
- scope.out が書かれている。
- acceptance_criteria が検証可能である。
- evidence がある。
- unknowns が明示されている。
- human gate の可能性を見落としていない。
- deny list に触れる要求を実行可能扱いしていない。
- AI Work Ticket 一覧に載せる必要がある内容だけを載せている。

## Example: Create AI Work Ticket

```yaml
source_ref: issue-123
input_summary: {{ESTIMATE_DOMAIN}}画面に補助文言を追加したい
intake_decision:
  output: ai_work_ticket
  initial_status: ready_for_triage
  why: 表示文言のみで、{{MONEY_DOMAIN}}計算、承認、PDF / CSV 出力には影響しない
created_ticket:
  id: AWT-2026-0001
  title: {{ESTIMATE_DOMAIN}}画面の補助文言を追加する
  status: ready_for_triage
  contract_ref: docs/ai-work-ticket-contract.md
  agent_alignment:
    intent_summary: {{ESTIMATE_DOMAIN}}画面で入力時の迷いを減らす
    success_boundary: 指定箇所に補助文言が表示される
    non_goals:
      - {{MONEY_DOMAIN}}計算の変更
      - 承認処理の変更
      - PDF / CSV 出力の変更
    assumptions:
      - 表示文言のみの変更である
    decisions_already_made:
      - {{MONEY_DOMAIN}}、承認、{{REPORT_DOCUMENT_DOMAIN}}処理には触れない
    expected_agent_behavior:
      - 表示変更に限定し、処理ロジックへ広げない
    handoff_notes:
      - daily-triage は low risk 表示変更として扱える
```

## Example: Clarification Required

```yaml
source_ref: conversation-2026-07-02
intake_decision:
  output: intake_clarification_request
  why: desired_state と acceptance criteria が不足しており、AI Work Ticket 化できない
intake_clarification_request:
  reason_category:
    - missing_desired_state
    - missing_acceptance_criteria
  questions:
    - question_id: q1
      decision_needed: 完了状態の決定
      why_needed_for_ai_work_ticket: desired_state と acceptance_criteria を確定しないと、daily-triage と coding agent が完了判断できない
      field_to_complete:
        - understanding.desired_state
        - verification.acceptance_criteria
        - agent_alignment.success_boundary
      blocking_level: blocks_ticket_creation
      options:
        - label: 指定画面に文言表示
          meaning: 表示文言だけを追加し、処理ロジックには触れない
        - label: 表示条件も変更
          meaning: 文言の表示条件を含めて変更するため、scope と risk の再評価が必要
      recommended_default: 指定画面に文言表示
      expected_answer_format: 対象画面、表示箇所、表示文言、完了条件を箇条書きで回答する
    - question_id: q2
      decision_needed: 変更対象外の決定
      why_needed_for_ai_work_ticket: non-goals がないと、coding agent が{{MONEY_DOMAIN}}、承認、PDF 出力まで確認範囲を広げる可能性がある
      field_to_complete:
        - scope.out
        - agent_alignment.non_goals
      blocking_level: blocks_implementation
      options:
        - label: 表示のみ
          meaning: {{MONEY_DOMAIN}}、承認、PDF / CSV 出力は対象外
        - label: 表示以外も含む
          meaning: human gate と詳細 scope の確認が必要
      recommended_default: 表示のみ
      expected_answer_format: 対象外にする処理を列挙する
  next_owner: Human
```

## Example: No Action

```yaml
source_ref: issue-456
intake_decision:
  output: intake_no_action_record
  why: 既存 PR で解決済みであり、Loop が処理する作業はない
intake_no_action_record:
  reason_category:
    - already_resolved
  evidence:
    - linked_pr_merged
  reopen_condition: 同じ事象が再発し、再現条件が提示された場合
```
