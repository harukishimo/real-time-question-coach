# AI Work Ticket Spreadsheet Schema

## Purpose

この文書は、AI Work Ticket を 1 ページのスプレッドシートで管理するための列定義を定める。

目的は、Ticket Builder、daily-triage、実装エージェント、検証エージェント、人間が同じ行を見て、認識のズレなく次の処理へ進める状態を作ることである。

## Core Rules

- AI Work Ticket 一覧の source of truth は外部 issue / repository issue ではなく、1 ページのスプレッドシートである。
- 1 行は 1 つの AI Work Ticket を表す。
- 外部 issue、PR、会話ログ、仕様書、repository service 上の情報は `source_link` または `evidence_links` に入れる参照情報であり、AI Work Ticket 一覧そのものではない。
- raw human request を AI Work Ticket 一覧に直接混ぜない。Ticket Builder / Intake が AI-readable な内容に変換してから登録する。
- スプレッドシートは 1 シートで運用する。フィルタビューは使用してよいが、ステータス別に別シートを作らない。
- long text は列内に構造化して書く。Issue 本文相当の背景、要件、対象外、完了条件は過度に要約して失わない。
- Google Sheets connector には運用上 Editor 権限を付与する。読み取りだけでは、L2 以降の status 更新や L1 の proposed column write-back に進めない。
- Connector の書き込み権限と Loop の書き込み許可は分けて扱う。Editor 権限があっても、Loop は自律度と write mode で許可された列だけを更新する。
- L1 は canonical な `status` を直接変更しない。
- L1 は人間が判断できるように、Human Communication columns と L1 Proposed Updates columns への write-back を許可する。
- L1 が更新できるのは `ai_comment_type`, `ai_comment_summary`, `decision_needed`, `questions_for_human`, `default_assumption`, `reply_format`, `proposed_*`, `last_loop_run_id`, `triage_notes` に限定する。
- canonical な `status`, `next_owner`, triage / execution columns の更新は L2 以上かつ human approval 後に限る。

## Sheet

推奨シート名:

```text
AI Work Tickets
```

## Column Ownership

| Owner | Editable Columns |
| --- | --- |
| Ticket Builder / Intake | source、understanding、scope、detailed_requirements、agent_alignment、risk、constraints、verification、cc_sdd、loop_policy、requested_outcome |
| Orchestrator / daily-triage L1 | `ai_comment_type`, `ai_comment_summary`, `decision_needed`, `questions_for_human`, `default_assumption`, `reply_format`, `proposed_*`, `last_loop_run_id`, `triage_notes` |
| Orchestrator / daily-triage L2+ | human approval 後に `status`, triage / execution columns |
| Implementation Agent | L2 / L3 Activation Record がある場合のみ、execution columns、`verification_result`, `verification_evidence`, `triage_notes`, `last_loop_run_id` |
| Red Team / QA / Tester Agent | 専用列がない場合、`verification_evidence`, `done_evidence`, `triage_notes`, `last_loop_run_id` に構造化証跡を記録 |
| Verifier Agent | `verification_result`, `verification_evidence`, `verifier_verdict`, `verifier_notes`, `proposed_status` |
| Human | approval columns、human gate、優先度、最終承認、merge / close 判断 |

## Columns

### Identity

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `ticket_id` | yes | text | 一意で安定した ID。例: `AIT-0001` |
| `title` | yes | text | AI と人間が内容を識別できる短いタイトル |
| `status` | yes | dropdown | 現在の canonical status |
| `priority` | yes | dropdown | `P0`, `P1`, `P2`, `P3` |
| `created_at` | yes | date | `YYYY-MM-DD` |
| `updated_at` | yes | date | `YYYY-MM-DD` |
| `next_owner` | yes | dropdown | 次に責務を持つ owner |

### Source

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `source_type` | yes | dropdown | 入力元の種別 |
| `source_link` | no | url | 外部 issue、PR、会話、仕様書などのリンク |
| `source_summary` | yes | text | source の要約。raw request の貼り付けは禁止 |
| `evidence_links` | no | text | 判断根拠リンク。複数ある場合は改行で区切る |

### Understanding

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `overview` | yes | text | 何を追加、変更、解決する ticket か |
| `background_purpose` | yes | text | なぜこの作業が必要か。背景と目的 |
| `problem` | yes | text | 解決すべき問題 |
| `current_state` | yes | text | 現在の状態 |
| `desired_state` | yes | text | 望ましい状態 |
| `target_users` | yes | text | 対象ユーザー。非 UI 作業の場合は `internal`, `system`, `none` などを書く |
| `unknowns` | no | text | 未確定事項。不明点がなければ `none` |

### Scope

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `scope_in` | yes | text | 対応範囲 |
| `scope_out` | yes | text | 対応しない範囲 |
| `affected_areas` | yes | text | 影響しうる機能、画面、処理領域 |
| `screen_scope` | conditional | text | 対象画面。画面が関係しない場合は `none` |
| `functional_scope` | conditional | text | 対象機能。新機能、仕様変更では必須 |
| `data_scope` | conditional | text | 対象データ、主要 field、status、保存対象 |

### Detailed Requirements

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `screen_requirements` | conditional | text | 画面ごとの表示、導線、UI 要件 |
| `functional_requirements` | conditional | text | 機能ごとの振る舞い、操作、処理要件 |
| `data_requirements` | conditional | text | データ構造、保持項目、状態値、永続化要件 |
| `validation_requirements` | conditional | text | 保存不可条件、入力エラー、エラー表示要件 |
| `permission_requirements` | conditional | text | 権限、認可、アクセス制御要件 |
| `implementation_notes` | no | text | 実装時の注意、既存設計優先、禁止する広げ方 |
| `reference_info` | no | text | 参考画面、参考実装、関連 Issue、関連 Notion など |

### Agent Alignment

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `intent_summary` | yes | text | このチケットで達成したい意図 |
| `success_boundary` | yes | text | どこまでできれば成功か |
| `non_goals` | yes | text | やらないこと |
| `assumptions` | no | text | AI が前提にしてよいこと |
| `decisions_already_made` | no | text | 既に決まっている判断 |
| `expected_agent_behavior` | yes | text | 実装エージェントに期待する振る舞い |
| `handoff_notes` | no | text | 後続エージェントへの補足 |

### Risk And Constraints

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `risk_level` | yes | dropdown | `low`, `medium`, `high` |
| `risk_reasons` | yes | text | risk level の理由 |
| `human_gate_required` | yes | dropdown | `true`, `false`, `unknown` |
| `human_gate_reason` | conditional | text | human gate が必要な理由 |
| `deny_list_checked` | yes | dropdown | `true`, `false` |
| `forbidden_actions` | no | text | このチケット固有の禁止操作 |
| `blocked_reason` | conditional | text | 実行不可の場合の理由 |

### Verification

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `acceptance_criteria` | yes | text | 完了判定条件 |
| `required_checks` | yes | text | 必須確認。例: unit test、manual check |
| `test_perspectives` | no | text | テスト観点。何を確認すべきか |
| `test_plan` | no | text | 具体的な検証手順 |
| `verification_result` | no | dropdown | `not_started`, `passed`, `failed`, `blocked` |
| `verification_evidence` | no | text | 検証結果の証跡 |

`verification_evidence` には、専用列がない場合でも次の構造を含める。これが欠ける場合、`done` に進めない。

```yaml
completion_gate_evidence:
  red_team_review:
    agent_type: adversarial_review_agent
    verdict: APPROVE | REJECT | ESCALATE_HUMAN
    findings:
    evidence:
  qa_agent_result:
    agent_type: qa_agent
    status: passed | failed
    acceptance_criteria_traceability:
    required_checks_coverage:
    not_run_review:
  tester_agent_result:
    agent_type: tester_agent
    status: passed | failed
    environment:
    commands:
    artifacts:
    not_run:
  purple_coordination:
    required: true | false
    decision:
    evidence:
  verifier:
    verdict: APPROVE | REJECT | ESCALATE_HUMAN
    evidence:
```

### Requested Outcome

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `requested_outcome` | yes | text | 最終的に得たい成果物または状態 |

### Triage And Execution

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `work_type` | no | dropdown | 作業分類 |
| `suggested_next_action` | no | dropdown | 次に取るべき action |
| `cc_sdd_required` | yes | dropdown | `true`, `false`, `unknown` |
| `cc_sdd_reason` | conditional | text | cc-sdd 対象かどうかの判断理由 |
| `kiro_required` | no | dropdown | `true`, `false`, `unknown` |
| `implementation_agent_type` | no | text | 想定する対応エージェント。値は `docs/loop-agent-registry.md` の `agent_type` を使う |
| `allowed_autonomy` | no | dropdown | `L0`, `L1`, `L2`, `L3` |
| `branch_required` | no | dropdown | `true`, `false`, `unknown` |
| `verifier_required` | no | dropdown | `true`, `false`, `unknown` |
| `loop_policy` | yes | text | L1 / L2 でどう扱うか、人間承認、branch、merge 方針 |
| `triage_notes` | no | text | triage 時の補足 |

### Human Communication

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `ai_comment_type` | no | dropdown | 人間へ伝えるコメント種別 |
| `ai_comment_summary` | no | text | 人間が読むためのコメント本文 |
| `decision_needed` | no | text | 人間に判断してほしいこと |
| `questions_for_human` | no | text | 人間への質問。複数ある場合は改行で区切る |
| `default_assumption` | no | text | 回答がない場合に採用する前提。採用不可なら `none` |
| `reply_format` | no | text | 人間に期待する回答形式 |

### L1 Proposed Updates

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `proposed_status` | no | dropdown | L1 が提案する次 status |
| `proposed_next_owner` | no | dropdown | L1 が提案する next owner |
| `proposed_ai_comment` | no | text | L1 が人間へ提示するコメント案 |
| `proposed_update_reason` | no | text | なぜ更新が必要か |
| `proposed_by` | no | text | 提案した Loop または Agent |
| `proposed_at` | no | date | `YYYY-MM-DD` |
| `last_loop_run_id` | no | text | 対応する loop-run-log の ID |

### L2 / L3 Execution

L2 / L3 実行時に使う列である。L1 daily-triage はこれらを直接更新しない。L1 は必要に応じて `proposed_*` または Human Communication columns に更新案だけを書く。

現運用では、実シートの既存103列を正とする。`agent_plan`, `allowed_actions`, `allowed_mutations` は専用列として追加しない。これらはActivation Recordの一部として、最新の人間指示、`approval_scope`, `handoff_notes`, `triage_notes`, または `loop-run-log.md` に記録する。

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `approved_autonomy` | conditional | dropdown | 人間が承認した自律度。`L2`, `L3` |
| `approved_by` | conditional | text | 承認者。人名、role、または承認元 |
| `approved_at` | conditional | datetime | 承認日時。`YYYY-MM-DDTHH:mm:ss+09:00` 推奨 |
| `approval_source` | conditional | text | 承認が残っている場所。例: current_thread, spreadsheet, comment |
| `approval_scope` | conditional | text | L2 / L3 が実行してよい範囲。scope_in より広げない |
| `approval_expires_at` | conditional | datetime | 承認期限。期限切れなら実行しない |
| `max_fix_attempts` | conditional | number | verifier / test failure に対して自律修正できる最大回数 |
| `human_gate_status` | conditional | dropdown | `not_required`, `pending`, `approved`, `rejected` |
| `branch_name` | conditional | text | 実行 branch。例: `codex/AIT-0001-faq-admin` |
| `base_branch` | conditional | text | 作業開始元 branch |
| `destination_branch` | conditional | text | PR の merge 先 branch。CodeCommit では destination reference |
| `commit_sha` | no | text | 実装完了時点の commit SHA。複数ある場合は改行で区切る |
| `codecommit_repository_name` | conditional | text | CodeCommit repository name |
| `codecommit_region` | conditional | text | AWS region。例: `ap-northeast-1` |
| `aws_profile_name` | conditional | text | 使用してよい AWS profile 名。credential 自体は書かない |
| `codecommit_pr_creation_allowed` | conditional | dropdown | `true`, `false`。L3 で PR 作成 command を許可するか |
| `codecommit_reviewer_comment_allowed` | conditional | dropdown | `true`, `false`。L3 で reviewer comment command を許可するか |
| `pr_id` | no | text | CodeCommit PR ID |
| `pr_url` | no | url | PR URL |
| `implementation_started_at` | no | datetime | 実装開始日時 |
| `implementation_completed_at` | no | datetime | 実装完了日時 |
| `verifier_verdict` | no | dropdown | `APPROVE`, `REJECT`, `ESCALATE_HUMAN` |
| `verifier_notes` | no | text | verifier の要約、scope / test / risk / human gate の証跡 |
| `merge_approval_status` | no | dropdown | `not_requested`, `pending`, `approved`, `rejected`, `merged` |

### Closing

| Column | Required | Type | Description |
| --- | --- | --- | --- |
| `done_criteria_met` | no | dropdown | `true`, `false`, `partial` |
| `done_evidence` | no | text | 完了証跡。`done_criteria_met = true` の場合は Red Team `APPROVE`、QA `passed`、Tester `passed`、Verifier `APPROVE` の構造化証跡を含める |
| `closed_at` | no | date | `YYYY-MM-DD` |

## Dropdown Values

### status

```text
ready_for_triage
triage_in_progress
ticket_builder_required
needs_human_management
blocked_by_constraints
out_of_scope
pending
no_action_required
ready_for_kiro
ready_for_implementation
implementation_in_progress
under_verification
human_gate_pending
done
```

### next_owner / proposed_next_owner

```text
Ticket Builder
Orchestrator
daily-triage
Kiro Spec
Implementation Agent
Verifier Agent
Red Team Agent
QA Agent
Tester Agent
Human
None
```

### source_type

```text
human_input
issue
pr_comment
conversation
spec
incident
other
```

### work_type

```text
bug_fix
feature
spec_refinement
docs
test
ops
cleanup
dependency
unknown
```

### implementation_agent_type

`implementation_agent_type` は text column だが、値は `docs/loop-agent-registry.md` の `agent_type` のうち、primary implementation agent として起動できるものだけを正とする。planning / review / verification / repository action agent はこの column に書かず、Activation Record、`handoff_notes`、`triage_notes`、または `loop-run-log.md` に残す。

```text
general_implementer_agent
rails_controller_agent
rails_model_agent
rails_service_agent
rails_helper_agent
grape_api_agent
rails_job_agent
mailer_notification_agent
uploader_storage_agent
view_slim_agent
jquery_behavior_agent
stimulus_js_agent
frontend_asset_agent
form_validation_agent
route_agent
i18n_copy_agent
docs_agent
reservation_domain_agent
estimate_billing_agent
money_calculation_agent
pdf_report_agent
daily_lock_agent
kpi_management_agent
bugyo_accounting_agent
master_data_agent
auth_permission_agent
customer_data_agent
db_schema_agent
data_migration_script_agent
script_processing_agent
seed_master_agent
csv_import_agent
excel_export_agent
batch_rake_agent
external_api_agent
aws_infra_agent
dependency_agent
config_agent
controller_test_agent
model_test_agent
service_test_agent
view_test_agent
system_test_agent
task_test_agent
regression_test_agent
```

### suggested_next_action

```text
return_to_builder
needs_human
refine_spec
ready_to_implement
mark_pending
mark_no_action_required
block_by_constraints
no_op
```

### ai_comment_type

```text
clarification_request
status_update
human_gate_request
blocked_notice
pending_notice
no_action_notice
ready_notice
```

### approved_autonomy

```text
L2
L3
```

### human_gate_status

```text
not_required
pending
approved
rejected
```

### verifier_verdict

```text
APPROVE
REJECT
ESCALATE_HUMAN
```

### merge_approval_status

```text
not_requested
pending
approved
rejected
merged
```

## Required Completeness

`status = ready_for_triage` にするには、少なくとも次が埋まっている必要がある。

- `ticket_id`
- `title`
- `status`
- `priority`
- `source_type`
- `source_summary`
- `overview`
- `background_purpose`
- `problem`
- `current_state`
- `desired_state`
- `target_users`
- `scope_in`
- `scope_out`
- `affected_areas`
- `intent_summary`
- `success_boundary`
- `non_goals`
- `expected_agent_behavior`
- `risk_level`
- `risk_reasons`
- `human_gate_required`
- `deny_list_checked`
- `acceptance_criteria`
- `required_checks`
- `cc_sdd_required`
- `loop_policy`
- `requested_outcome`

不足している場合、daily-triage は Pattern 実行や実装に進めず、`proposed_status = ticket_builder_required` を提案する。

## Feature Ticket Completeness

新機能、仕様変更、責務境界がある work item は、`ready_for_triage` にする前に次も埋める。

- `screen_scope`
- `functional_scope`
- `data_scope`
- `screen_requirements`
- `functional_requirements`
- `data_requirements`
- `validation_requirements`
- `permission_requirements`
- `test_perspectives`
- `cc_sdd_reason`

該当しない項目は空欄にせず、`none` または `not_applicable` と書く。AI が「未記入」なのか「対象外」なのかを誤認しないようにする。

## L2 / L3 Execution Readiness

`status = ready_for_implementation` から L2 / L3 実行へ進むには、少なくとも次が埋まっている必要がある。

- `approved_autonomy`
- `approved_by`
- `approved_at`
- `approval_source`
- `approval_scope`
- `approval_expires_at`
- `implementation_agent_type`
- `max_fix_attempts`
- `human_gate_status`
- `branch_name`
- `base_branch`
- `verifier_required`
- `last_loop_run_id`

加えて、Activation Record として、現在の execution step、許可action、許可mutation、primary agent、review / verifier agent、禁止action が最新の人間指示、`approval_scope`, `handoff_notes`, `triage_notes`, または `loop-run-log.md` のいずれかに残っている必要がある。

CodeCommit PR 作成または reviewer comment 投稿まで許可する場合は、さらに次が必要である。

- `destination_branch`
- `codecommit_repository_name`
- `codecommit_region`
- `codecommit_pr_creation_allowed`
- `codecommit_reviewer_comment_allowed`

`aws_profile_name` は人間が使用 profile を明示した場合だけ書く。credential、access key、secret access key、session token は spreadsheet に書かない。

## Issue Section Mapping

人間が書く Issue 本文相当の粒度は、次の列へ分解して登録する。

| Issue Section | Spreadsheet Column |
| --- | --- |
| 概要 | `overview` |
| 背景・目的 | `background_purpose`, `problem` |
| 現状 | `current_state` |
| To Be / 期待する状態 | `desired_state` |
| 対象ユーザー | `target_users` |
| 対象範囲 / 画面 | `screen_scope` |
| 対象範囲 / 機能 | `functional_scope` |
| 対象範囲 / データ | `data_scope`, `data_requirements` |
| 対象外 | `scope_out`, `non_goals` |
| 画面要件 | `screen_requirements` |
| バリデーション | `validation_requirements` |
| 権限 | `permission_requirements`, `human_gate_required`, `human_gate_reason` |
| 完了条件 | `acceptance_criteria` |
| テスト観点 | `test_perspectives`, `test_plan` |
| 実装時の注意 | `implementation_notes`, `forbidden_actions` |
| 参考情報 | `reference_info`, `source_link`, `evidence_links` |
| 不明点・人間確認が必要な点 | `unknowns`, `questions_for_human`, `decision_needed` |
| cc-sdd判断 | `cc_sdd_required`, `cc_sdd_reason`, `kiro_required` |
| Loop処理方針 | `loop_policy`, `allowed_autonomy`, `branch_required`, `verifier_required` |

## Human Comment Rules

AI が人間に伝える必要がある場合は、チケット行に次を残す。

- `ai_comment_type`
- `ai_comment_summary`
- `decision_needed`
- `questions_for_human`
- `reply_format`

L1 では、人間が判断できるように `ai_comment_*`, `decision_needed`, `questions_for_human`, `default_assumption`, `reply_format` へ直接書き込んでよい。あわせて、agent 向けの提案履歴として `proposed_ai_comment`, `proposed_status`, `proposed_update_reason`, `last_loop_run_id` を残す。

L1 であっても、`status`, `next_owner`, ticket 本体、scope、risk、acceptance criteria は更新しない。

コメントは「何が足りないか」ではなく、「AI Work Ticket にするために何を決める必要があるか」を人間が判断できる形で書く。

## Status Update Rules

- `ticket_builder_required`: AI Work Ticket として構造不足。`ai_comment_summary` または `proposed_ai_comment` に差し戻し理由を書く。
- `needs_human_management`: 人間の管理、判断、補足、承認が必要。判断観点と必要な回答形式を書く。
- `blocked_by_constraints`: deny list、budget、kill switch、禁止操作により実行不可。該当制約を書く。
- `pending`: 外部待ち、期限待ち、判断保留などにより今は進めない。再確認条件を書く。
- `no_action_required`: 対応不要。なぜ不要か、どの観点で対象外かを書く。
- `done`: 必要な処理と証跡が揃った場合のみ使用する。

## Example Row

| Column | Example |
| --- | --- |
| `ticket_id` | `AIT-0001` |
| `title` | `FAQ管理機能を追加する` |
| `status` | `ready_for_triage` |
| `source_type` | `issue` |
| `source_summary` | `管理者が管理画面から FAQ を登録、編集、削除できる機能追加依頼` |
| `overview` | `管理者が管理画面から FAQ を登録、編集、削除できる機能を追加する。一般ユーザー向け FAQ 表示画面の大幅刷新は対象外` |
| `background_purpose` | `FAQ 更新のたびに開発者対応が必要で運用速度が低下している。管理者が問い合わせ内容に応じて FAQ を素早く改善できる状態にしたい` |
| `problem` | `運用者が FAQ を直接追加、修正、削除できない` |
| `current_state` | `管理画面に FAQ 管理メニュー、登録 UI、編集 UI、削除 UI、公開状態制御がない` |
| `desired_state` | `管理者が FAQ 一覧、登録、編集、削除、公開 / 非公開切り替えを行える` |
| `target_users` | `管理者ユーザー` |
| `scope_in` | `FAQ 管理画面、FAQ CRUD、公開状態切り替え、入力バリデーション、管理者権限チェック` |
| `scope_out` | `FAQカテゴリ、タグ、検索、CSV import/export、公開{{RESERVATION_DOMAIN}}、多言語、並び順変更、一般ユーザー向け表示画面の全面リニューアル、閲覧数計測、AI自動生成` |
| `screen_scope` | `FAQ一覧画面、FAQ新規登録画面、FAQ編集画面、FAQ削除確認UI` |
| `functional_scope` | `一覧取得、新規登録、編集、削除、公開状態切り替え、入力バリデーション、管理者権限チェック` |
| `data_scope` | `id, question, answer, status, created_at, updated_at。status は draft / published` |
| `screen_requirements` | `一覧では質問文、公開状態、作成日時、更新日時、編集ボタン、削除ボタンを表示。初期状態は更新日時降順` |
| `validation_requirements` | `question 空、answer 空、status 不正値の場合は保存できない。対象項目近くにエラーを表示` |
| `permission_requirements` | `FAQ管理機能は管理者のみ利用可能。API またはサーバー処理でも管理者権限を確認` |
| `acceptance_criteria` | `管理者が一覧、登録、編集、削除、公開状態切り替えを行える。非管理者はアクセスできない。既存管理画面UI、設計、命名規則に沿う` |
| `test_perspectives` | `一覧取得、登録、編集、削除、question / answer 空エラー、非管理者拒否、公開状態保存` |
| `implementation_notes` | `既存管理画面構成、API設計、DB設計、命名規則を優先。新しい大規模UIライブラリは追加しない。範囲外リファクタリングは行わない` |
| `reference_info` | `関連画面: 管理画面の既存CRUD機能。参考実装: お知らせ管理またはユーザー管理` |
| `unknowns` | `既存DBにFAQ相当テーブルがあるか。既存CRUDパターン。物理削除か論理削除か` |
| `human_gate_required` | `true` |
| `human_gate_reason` | `新機能、DB、権限、管理画面に関わるため、requirements / design / tasks の人間承認が必要` |
| `cc_sdd_required` | `true` |
| `cc_sdd_reason` | `新機能開発であり、画面、サーバー処理、DB、権限、テストが関係するため` |
| `kiro_required` | `true` |
| `loop_policy` | `L1ではcc-sdd対象として認識。不明点が既存コード確認で解消できる場合はAIが調査。仕様判断が必要なら人間確認。requirements / design / tasks 作成後に人間承認。実装はL2でPR作成まで。mergeは人間が行う` |
| `requested_outcome` | `daily-triage が cc-sdd 対象として Kiro spec workflow に渡せる状態` |
