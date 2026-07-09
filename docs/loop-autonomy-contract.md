# Loop Autonomy Contract

このドキュメントは、Realtime Question Coach Loop Engineering における L0 / L1 / L2 / L3 の権限境界と、L2 / L3 を有効化するための条件を定義する。

`daily-triage` は agent ではなく Loop Pattern である。実行主体は Orchestrator Agent であり、Orchestrator Agent が Pattern Picker に従って `daily-triage` を起動する。

## Current Permission

本PJでは、最大L3までのエージェント自律度を許可済みとする。

scheduled daily-triage は引き続き L1 report-only を基本とする。L2 / L3 はこのドキュメントで実行契約を定義し、対象 AI Work Ticket ごとに Activation Record がある場合だけ on-demand で有効になる。

## Authority Model

| Component | Authority |
|-----------|-----------|
| Human | L2 / L3 の有効化、human gate 承認、PR 作成承認、merge 承認 |
| Orchestrator Agent | Activation Record、constraints、budget、ticket 状態を確認し、許可された範囲だけ実行を開始する |
| Loop Pattern | 処理の型を定義する。`daily-triage` は Pattern であり agent ではない |
| Loop Agent Registry | L1-L3 で起動できる planning、coding、review、verification、repo action agent profile を定義する |
| Loop Agent Behavior Contracts | 各 agent profile の read / action / prohibition / output を定義する |
| Implementation Agent | L2 / L3 で、許可された branch と scope 内だけ実装する。具体的な agent profile は `docs/loop-agent-registry.md` に従う |
| Verifier Agent | L1 では report-only checker として観点を整理し、L2 / L3 では実装結果を scope、test、risk、deny list、human gate 観点で判定する |
| AI Work Ticket Spreadsheet | ticket 状態と人間判断の正本。external issue / PR は source / evidence として扱う |

## Activation Record

L2 / L3 を開始するには、対象 ticket ごとに次の Activation Record が必要である。Activation Record は spreadsheet の専用列だけに限定しない。最新の人間指示、既存の approval / handoff / triage 列、または `loop-run-log.md` に残っていればよい。

```yaml
autonomy_activation:
  ticket_id:
  approved_level: L2 | L3
  approved_by:
  approved_at:
  approval_source:
  approval_scope:
  agent_plan:
    autonomy_level: L2 | L3
    execution_mode: implementation | verification | repo_action
    primary_agent_type:
    supporting_agent_types: []
    review_agent_types:
      - verifier
    coordination_agent_types: []
    allowed_mutations:
      - branch
      - code
      - tests
      - docs
      - spreadsheet_execution_fields
    why_this_agent_plan:
  allowed_actions:
    - create_branch
    - edit_code
    - run_tests
    - update_spreadsheet_canonical_fields
    - request_verifier
    - prepare_pr
    - create_codecommit_pr
    - post_codecommit_reviewer_comment
  explicitly_forbidden_actions:
    - merge
    - deploy
    - read_secrets
    - edit_production_config
  base_branch:
  branch_name:
  max_fix_attempts:
  expires_at:
  human_gate_required: true | false
  human_gate_status: not_required | approved | pending
  codecommit_pr_creation_allowed: true | false
  codecommit_reviewer_comment_allowed: true | false
  codecommit:
    repository_name:
    region:
    destination_branch:
    aws_profile_name:
    draft_equivalent: true
  notes:
```

Activation Record は、人間の最新指示、AI Work Ticket spreadsheet、または `loop-run-log.md` に残す。古い承認と新しい承認が矛盾する場合は、新しい人間指示を優先する。

`agent_plan` は、これから実行する現在の execution step を表す。L3 で実装から CodeCommit PR 作成または reviewer comment 投稿へ進む場合、Orchestrator Agent は実装用の `execution_mode: implementation` plan を流用せず、`execution_mode: repo_action` の agent plan を別途記録してから `codecommit_pr_agent` または `codecommit_comment_agent` を起動する。

## Activation Preconditions

L2 / L3 を開始する前に、すべて満たす必要がある。

- AI Work Ticket が `docs/ai-work-ticket-contract.md` と `docs/ai-work-ticket-spreadsheet-schema.md` の必須条件を満たしている。
- `scope_in`, `scope_out`, `non_goals`, `acceptance_criteria`, `required_checks` が明確である。
- `human_gate_required` と `human_gate_reason` が判断済みである。
- deny list に該当しない。
- `loop-human-gates.md` を確認済みであり、human gate 対象の場合は実装前承認がある。
- `cc_sdd_required = true` または `kiro_required = true` の場合、requirements / design / tasks と人間承認が揃っている。
- `branch_required = true` と `verifier_required = true` が明記されている。
- `allowed_autonomy` が Activation Record の `approved_level` 以上である。
- Activation Record の `agent_plan` に `autonomy_level`, `execution_mode`, `primary_agent_type`, `supporting_agent_types`, `review_agent_types`, `coordination_agent_types`, `allowed_mutations`, `why_this_agent_plan` がある。
- `agent_plan.execution_mode = implementation` の場合、`implementation_agent_type` は `agent_plan.primary_agent_type` と一致している。
- `agent_plan.execution_mode = verification` または `repo_action` の場合、`implementation_agent_type` は元の実装 primary agent を保持するか空欄にし、verification / repository action の primary は `agent_plan.primary_agent_type` にだけ書く。
- `allowed_actions` と `agent_plan.allowed_mutations` が、これから実行する action と mutation を明示的に含んでいる。
- 実装、verification、repo action を連続して行う場合でも、各 step の `agent_plan.execution_mode` と `primary_agent_type` が現在の step と一致している。
- `loop-budget.md` の budget と run limit を超えない。
- `git status` で既存変更を確認し、無関係な変更を触らない方針が立っている。

## Autonomy Levels

| Level | Allowed | Not allowed |
|-------|---------|-------------|
| L0 | 読み取り、要約、質問作成 | file 更新、spreadsheet 更新、branch 作成、実装 |
| L1 | `daily-triage` report-only、read-only / report-only agent 起動、Human Communication columns と L1 Proposed Updates columns 更新、`STATE.md` / `loop-run-log.md` 更新 | canonical status 更新、ticket 本体更新、branch 作成、実装、PR 作成、external state mutation |
| L2 | Activation Record の範囲内で branch 作成、限定実装、test 実行、verifier 依頼、canonical status / execution columns 更新、PR 作成準備 | merge、deploy、release、human gate 対象の未承認実装、PR 作成 command、reviewer comment command |
| L3 | L2 に加えて、Activation Record の `max_fix_attempts` 範囲で verifier / test 失敗への自律修正、`codecommit_pr_agent` による CodeCommit PR 作成、`codecommit_comment_agent` による CodeCommit reviewer comment 投稿、PR description draft 更新案、ready 判断材料の作成 | 自動 merge、人間承認なしの ready 化、production 操作、secret 読み取り、承認範囲外の追加実装 |

## L2 Detailed Permission

L2 は「承認済み ticket の限定実装」を扱う。

L2 で許可すること:

- Activation Record に基づく branch 作成。
- AI Work Ticket の scope 内の code / test / docs 変更。
- 必須 test と局所的な追加確認。
- verifier agent へのレビュー依頼。
- Spreadsheet の canonical `status`, `next_owner`, triage / execution / verification columns の更新。
- PR title / description / source branch / destination branch の作成準備。

L2 で禁止すること:

- merge。
- deploy / release。
- production / staging / external service の状態変更。
- secret / credential の読み取り。
- deny list 領域の編集。
- human gate 対象作業の未承認実装。
- scope 外のリファクタリング。
- CodeCommit PR 作成 command の実行。
- CodeCommit reviewer comment command の実行。

## L3 Detailed Permission

L3 は「承認済み ticket の実装から verifier 収束まで」を扱う。

L3 で追加許可すること:

- `max_fix_attempts` 範囲内の自律修正。
- verifier `REJECT` の理由が scope 内で、human gate に該当しない場合の再実装。
- test failure が実装差分に起因し、修正範囲が明確な場合の再実行。
- `codecommit_pr_creation_allowed: true` の場合、`codecommit_pr_agent` による AWS command の CodeCommit PR 作成。
- `codecommit_reviewer_comment_allowed: true` の場合、`codecommit_comment_agent` による AWS command の CodeCommit reviewer comment 投稿。
- PR description draft の更新案作成。
- human gate へ渡す判断材料の整理。

L3 でも禁止すること:

- 自動 merge。
- 人間承認なしの ready for review 化。
- 人間承認なしの approval、merge、close、resolve。
- release / deploy。
- production data / console 操作。
- risk medium 以上、または verifier `ESCALATE_HUMAN` の自律継続。

## Spreadsheet Write Permissions

| Level | Writable columns |
|-------|------------------|
| L1 | `ai_comment_type`, `ai_comment_summary`, `decision_needed`, `questions_for_human`, `default_assumption`, `reply_format`, `proposed_*`, `last_loop_run_id`, `triage_notes` |
| L2 | L1 columns に加えて `status`, `next_owner`, `work_type`, `suggested_next_action`, `kiro_required`, `implementation_agent_type`, `allowed_autonomy`, `branch_required`, `verifier_required`, `verification_result`, `verification_evidence`, L2 / L3 execution columns のうち branch、implementation、verifier 証跡列 |
| L3 | L2 columns に加えて CodeCommit PR / reviewer comment 証跡列、`done_criteria_met`, `done_evidence` の更新案。`done` への canonical status 更新は merge / close 方針が明確な場合に限る |

L2 / L3 で更新できる execution columns:

- `approved_autonomy`
- `approved_by`
- `approved_at`
- `approval_source`
- `approval_scope`
- `approval_expires_at`
- `max_fix_attempts`
- `human_gate_status`
- `branch_name`
- `base_branch`
- `destination_branch`
- `commit_sha`
- `codecommit_repository_name`
- `codecommit_region`
- `aws_profile_name`
- `codecommit_pr_creation_allowed`
- `codecommit_reviewer_comment_allowed`
- `pr_id`
- `pr_url`
- `implementation_started_at`
- `implementation_completed_at`
- `verifier_verdict`
- `verifier_notes`
- `merge_approval_status`

ただし approval columns は人間承認の記録であり、AI が勝手に作成、拡張、上書きしない。AI が書けるのは、人間承認が既に存在し、その内容を転記または実行証跡として更新する場合に限る。

L2 / L3 でも `source_*`, `overview`, `background_purpose`, `scope_*`, `risk_*`, `acceptance_criteria` などの ticket 本体は原則として更新しない。Ticket 本体に構造不足がある場合は Ticket Builder / Intake に戻す。

## Status Transition Permission

| From | To | Minimum level | Condition |
|------|----|---------------|-----------|
| `ready_for_implementation` | `implementation_in_progress` | L2 | Activation Record がある |
| `implementation_in_progress` | `under_verification` | L2 | 実装と required checks が完了している |
| `under_verification` | `human_gate_pending` | L2 | verifier または constraints が human gate を要求した |
| `under_verification` | `pending` | L2 | 外部待ち、追加承認待ち、PR 作成承認待ち |
| `under_verification` | `ready_for_implementation` | L2 | verifier `REJECT` で再実装が必要 |
| `under_verification` | `done` | L3 | requested outcome が PR 作成不要の作業で、完了条件と証跡が揃っている |

merge を伴う作業では、`done` は人間の merge / close 判断後に使う。

## Human Gate Rules

次に該当する場合は L2 / L3 でも停止し、`human_gate_pending` または `needs_human_management` にする。

- `loop-constraints.md` の human gate 条件に該当する。
- DB schema、認可、{{MONEY_DOMAIN}}、{{BILLING_DOMAIN}}、{{RESERVATION_DOMAIN}}、PDF 生成結果、{{DAILY_LOCK_DOMAIN}}、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master、infrastructure、config、production、release、deploy、merge に影響する。
- verifier が `ESCALATE_HUMAN` を返した。
- required checks が失敗し、原因が不明または scope 外に広がる。
- Activation Record の `max_fix_attempts` を超えた。
- L2 で PR 作成 command または reviewer comment command が必要になった。
- L3 で `codecommit_pr_creation_allowed` または `codecommit_reviewer_comment_allowed` がないまま AWS command が必要になった。
- CodeCommit repository name、region、destination branch、AWS profile / credential 扱い、draft-equivalent 方針が不明。

## Revocation And Expiration

次に該当する場合、L2 / L3 の許可は失効する。

- `expires_at` を過ぎた。
- 人間が停止、取り消し、方針変更を指示した。
- `loop-pause-all` が有効になった。
- deny list に触れる必要が出た。
- human gate 対象になったが承認がない。
- scope 外変更が必要になった。

## Example Activation

```yaml
autonomy_activation:
  ticket_id: AIT-0001
  approved_level: L2
  approved_by: human
  approved_at: 2026-07-03T14:50:00+09:00
  approval_source: current_thread
  approval_scope: "FAQ 管理画面の CRUD 実装。FAQ カテゴリ、CSV、多言語、一般ユーザー向け全面刷新は対象外。"
  agent_plan:
    autonomy_level: L2
    execution_mode: implementation
    primary_agent_type: rails_controller_agent
    supporting_agent_types:
      - rails_model_agent
      - view_slim_agent
      - controller_test_agent
      - model_test_agent
    review_agent_types:
      - adversarial_review_agent
      - security_review_agent
      - verifier
    coordination_agent_types: []
    allowed_mutations:
      - branch
      - code
      - tests
      - docs
      - spreadsheet_execution_fields
    why_this_agent_plan: "FAQ 管理画面 CRUD は controller, model, view, auth, tests がまたがるため。"
  allowed_actions:
    - create_branch
    - edit_code
    - run_tests
    - update_spreadsheet_canonical_fields
    - request_verifier
    - prepare_pr
  explicitly_forbidden_actions:
    - merge
    - deploy
    - read_secrets
  base_branch: main
  branch_name: codex/ait-0001-faq-admin
  max_fix_attempts: 1
  expires_at: 2026-07-04T23:59:59+09:00
  human_gate_required: false
  human_gate_status: not_required
  codecommit_pr_creation_allowed: false
  codecommit_reviewer_comment_allowed: false
  codecommit:
    repository_name: {{CODECOMMIT_REPOSITORY_NAME}}
    region: ap-northeast-1
    destination_branch: main
    aws_profile_name:
    draft_equivalent: true
```

L3 で CodeCommit PR 作成と reviewer comment 投稿まで許可する場合の例:

```yaml
autonomy_activation:
  ticket_id: AIT-0002
  approved_level: L3
  approved_by: human
  approved_at: 2026-07-03T15:30:00+09:00
  approval_source: current_thread
  approval_scope: "承認済み Kiro tasks の範囲で実装、検証、PR package 作成まで。merge は対象外。"
  agent_plan:
    autonomy_level: L3
    execution_mode: implementation
    primary_agent_type: general_implementer_agent
    supporting_agent_types:
      - regression_test_agent
      - pr_package_agent
    review_agent_types:
      - adversarial_review_agent
      - verifier
    coordination_agent_types: []
    allowed_mutations:
      - branch
      - code
      - tests
      - docs
      - spreadsheet_execution_fields
    why_this_agent_plan: "承認済み scope 内で実装、検証、PR package 作成まで行うため。CodeCommit action は repo_action plan で別途実行する。"
  allowed_actions:
    - create_branch
    - edit_code
    - run_tests
    - update_spreadsheet_canonical_fields
    - request_verifier
    - prepare_pr
    - create_codecommit_pr
    - post_codecommit_reviewer_comment
  explicitly_forbidden_actions:
    - merge
    - deploy
    - release
    - read_secrets
  base_branch: main
  branch_name: codex/ait-0002-approved-work
  max_fix_attempts: 3
  expires_at: 2026-07-04T23:59:59+09:00
  human_gate_required: false
  human_gate_status: not_required
  codecommit_pr_creation_allowed: true
  codecommit_reviewer_comment_allowed: true
  codecommit:
    repository_name: {{CODECOMMIT_REPOSITORY_NAME}}
    region: ap-northeast-1
    destination_branch: main
    aws_profile_name:
    draft_equivalent: true
```

L3 で CodeCommit PR 作成へ進む repo action 用の agent plan 例:

```yaml
agent_plan:
  autonomy_level: L3
  execution_mode: repo_action
  primary_agent_type: codecommit_pr_agent
  supporting_agent_types:
    - pr_package_agent
  review_agent_types:
    - verifier
  coordination_agent_types: []
  allowed_mutations:
    - codecommit_pr
  why_this_agent_plan: "verifier APPROVE 後、L3 Activation Record で PR 作成が許可されているため。"
```

L3 で CodeCommit reviewer comment 投稿へ進む repo action 用の agent plan 例:

```yaml
agent_plan:
  autonomy_level: L3
  execution_mode: repo_action
  primary_agent_type: codecommit_comment_agent
  supporting_agent_types: []
  review_agent_types:
    - verifier
  coordination_agent_types: []
  allowed_mutations:
    - codecommit_reviewer_comment
  why_this_agent_plan: "verifier / reviewer の evidence に基づく comment 投稿が L3 Activation Record で許可されているため。"
```
