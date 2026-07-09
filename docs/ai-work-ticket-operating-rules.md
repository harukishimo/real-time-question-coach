# AI Work Ticket Operating Rules

この文書は、Realtime Question Coach の AI Work Ticket を作成、triage、実装、検証する際の運用ルールを定義する。

正本の優先順は次のとおり。

1. `docs/ai-work-ticket-contract.md`
2. `docs/ai-work-ticket-spreadsheet-schema.md`
3. `docs/ticket-builder-intake.md`
4. この文書

## Priority Rules

| Priority | Meaning | Use when |
|----------|---------|----------|
| `P0` | 実装開始前に必須 | 認証、権限、保存禁止、provider境界、環境変数、build/test基盤など、後続ticketの前提になる |
| `P1` | MVP中核 | Login、Session Setup、realtime transcript、AI coach cards、Session Report、export/discardなど、MVPの主要flowを成立させる |
| `P2` | MVP補助 | diagnostics、runbook、verification pack、UX補助、手動確認手順など、MVPの運用・確認を強く助ける |
| `P3` | 後回し | MVP成立に不要な改善、将来provider追加、追加分析、nice-to-have UI |

優先度は「重要そう」ではなく、依存関係とMVP成立への必要性で付ける。P0/P1は受入基準とrequired checksが曖昧なまま起票しない。

## Status Rules

| Status | Meaning | Owner |
|--------|---------|-------|
| `ready_for_triage` | Ticket BuilderがAI-readableとして登録済み。daily-triageが構造検査できる | daily-triage |
| `ticket_builder_required` | AI Work Ticketとして構造不足。実装に進めない | Ticket Builder / Intake |
| `needs_human_management` | 仕様、優先度、影響範囲、人間判断が必要 | Human |
| `pending` | 外部入力、承認、connector復旧など待ち | Human / Orchestrator |
| `ready_for_kiro` | 仕様精緻化が必要。Kiro相当のspec workflowへ渡す | Orchestrator |
| `ready_for_implementation` | scope、acceptance criteria、required checks、human gateが実装可能な粒度 | Implementation Agent |
| `implementation_in_progress` | 実装中 | Implementation Agent |
| `under_verification` | 実装完了後、Red/QA/Tester/Verifier確認中 | Review Agents |
| `human_gate_pending` | human gate対象で承認待ち | Human |
| `done` | required checks、Red Team、QA、Tester、Verifier、done evidenceが揃った | Orchestrator / Verifier |

L1 daily-triage は canonical `status` を直接変更しない。`proposed_status` とAI commentで提案する。L2/L3はActivation Recordがある場合だけcanonical statusを更新できる。

## Ticket Builder Intake Template

Ticket Builder / Intake は、raw input を次の形に整理してから AI Work Ticket を作る。

```yaml
intake:
  source_type: human_request | docs | mock | spreadsheet | code_review | bug_report | verification_gap
  source_link:
  source_summary:
  requester_intent:
  product_area:
  desired_outcome:
  user_value:
  known_constraints:
    - no server persistence of conversation bodies
    - Google OAuth through Supabase Auth
    - STT/LLM providers replaceable through adapters
  unknowns:
    - question:
      blocks_implementation: true | false
  evidence:
    docs:
      - path:
        reason:
    mocks:
      - path:
        reason:
    requirements:
      - id:
        summary:
  proposed_ticket_type: feature | implementation | verification | docs | chore
  split_recommendation:
    should_split: true | false
    reason:
```

raw human requestをそのままticket本文へ貼らない。必ずintent、scope、acceptance criteria、non-goalsへ変換する。

## AI Work Ticket Creation Template

AI Work Ticket は次の粒度で起票する。

```yaml
ticket:
  ticket_id:
  title:
  priority: P0 | P1 | P2 | P3
  status: ready_for_triage
  work_type: feature | implementation | verification | docs | chore
  overview:
  background_purpose:
  scope_in:
    - concrete deliverable
  scope_out:
    - explicit non-target
  non_goals:
    - not included in this ticket
  detailed_requirements:
    screen:
    data:
    validation:
    auth_permission:
    api:
    privacy_security:
    tests:
  acceptance_criteria:
    - observable, testable condition
  required_checks:
    - command or manual check
  red_team_check_items:
    - abuse / failure / regression condition
  done_evidence_expected:
    - test output
    - doc path
    - screenshot/trace only when safe
  human_gate_required: true | false
  human_gate_reason:
  allowed_autonomy: L1 | L2 | L3
  branch_required: true | false
  verifier_required: true
```

acceptance criteriaは「問題なさそう」ではなく、画面、API、state、storage、security、testで観測できる条件にする。

## Definition Of Ready - Feature Ticket

feature ticket は次を満たすまで `ready_for_implementation` にしない。

- ユーザー価値と対象flowが明確である。
- 画面、API、状態、保存方針、権限、エラー状態が分かれている。
- `scope_in` と `scope_out` が具体である。
- acceptance criteriaが操作またはAPI応答で確認できる。
- Red Team確認条件がある。
- privacy/security/loggingへの影響が明記されている。
- human gate要否が判断済みである。
- required checksにunit/API/E2E/Playwright/buildの必要範囲が書かれている。

## Definition Of Ready - Implementation Ticket

implementation ticket は次を満たすまで実装へ進めない。

- 対象ファイルまたは対象module境界が推定できる。
- 実装後のexpected behaviorがテスト可能である。
- provider、auth、DB、storage、env varsの扱いが明記されている。
- secret、production、deploy、real provider executionがscope外である。
- `max_fix_attempts`、Activation Record、有効期限、branch名がある。
- verifier_requiredがtrueである。
- Red/QA/Tester/Verifierの完了条件がある。

## Definition Of Done

ticket は次をすべて満たすまで `done` にしない。

- `scope_in` が実装または文書化されている。
- `scope_out` と `non_goals` に違反していない。
- acceptance criteriaがすべて検証済みである。
- required checksが成功している、または実行不可理由と残リスクが明記されている。
- Red Team確認条件を網羅するテストケースが存在し、通過している。
- Red Teamが `APPROVE` している。
- QA Agentが `passed` している。
- Tester Agentが `passed` し、実行コマンドと結果を記録している。
- Verifierが `APPROVE` している。
- `done_evidence` に、参照できるログ、docs、テスト結果が残っている。
- secret、production、deploy、merge、push、real provider executionを行っていない、または明示承認範囲として記録されている。

## Human Communication Columns

人間へ判断を求める場合は、次の形式で書く。

```yaml
ai_comment_type: human_gate_request | clarification_request | status_report | blocker_report
ai_comment_summary: |
  何が起きているかを1-3文で説明する。
decision_needed: |
  人間が決めるべきことを箇条書きにする。
questions_for_human: |
  - 回答が必要な質問だけを書く。
default_assumption: |
  回答がない場合の扱い。危険な仮定は置かない。
reply_format: |
  approve / reject / clarify など、期待する返信形式。
```

本文、音声、LLM入出力、AIカード本文、Session Report本文、secret値は書かない。

## L1 Proposed Updates Columns

L1 daily-triage は、canonical fieldではなく proposed field に書く。

```yaml
proposed_status:
proposed_next_owner:
proposed_work_type:
proposed_suggested_next_action:
proposed_comment:
triage_notes:
last_loop_run_id:
```

`status`、`scope_in`、`acceptance_criteria`、`risk_level`、`approved_autonomy` などのcanonical fieldは、L2/L3かつ承認範囲内だけ更新する。

## Source And Evidence Rules

ticketには、実装agentが同じ理解に到達できる根拠を貼る。

| Evidence | Required content |
|----------|------------------|
| docs link | file path、該当section、なぜ読む必要があるか |
| mock link | file path、対象画面、期待flow |
| requirements id | 要件IDまたは見出し、対象acceptance criteria |
| test evidence | command、結果、対象観点 |
| unresolved item | 未決事項、実装を止めるか、default assumption |

禁止:

- 実会話本文を貼る。
- secretやenv実値を貼る。
- スクリーンショットやtraceに会話本文を含める。
- evidenceなしで「既存仕様通り」と書く。

## Ticket Splitting Rules

次のいずれかに該当する場合、ticketを分割する。

- 1ticketでUI、API、auth、provider、storage、E2Eをすべて変更する。
- acceptance criteriaが7個を超え、単一成果物として説明できない。
- Red Team観点が複数カテゴリに分かれる。
- human gate対象と非対象作業が混在する。
- mock/provider fallbackとreal provider実行が混在する。
- deploy/production/secret作業が混在する。
- 1回のPlaywright flowで主要完了条件を確認できない。

分割後のticketは、依存順を明記する。

```yaml
split:
  parent_ticket:
  child_tickets:
    - id:
      purpose:
      depends_on:
      done_when:
```
