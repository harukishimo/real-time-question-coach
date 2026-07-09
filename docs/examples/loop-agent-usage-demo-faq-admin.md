# Loop Agent Usage Demo: FAQ Admin CRUD

この文書は、仮に「管理画面に FAQ 管理機能を追加する」実装 Ticket が来た場合に、Loop Engineering がどの sub-agent をどう使うべきかを確認するためのデモである。

実コード、branch、Spreadsheet、CodeCommit、外部状態は変更しない。目的は agent plan の妥当性検証である。

## Demo Premise

```yaml
ticket_id: AIT-DEMO-FAQ-001
title: 管理画面 FAQ 管理機能を追加する
status: ready_for_triage
priority: P2
source_type: conversation
source_summary: >
  管理者が FAQ を登録、編集、削除、公開状態変更できる管理画面機能を追加したい。
  一般ユーザー向け FAQ 表示画面の全面刷新、カテゴリ、タグ、検索、CSV、AI 自動生成は対象外。
problem: FAQ 更新のたびに開発者対応が必要で、運用速度が低下している。
current_state: 管理画面に FAQ 管理メニュー、CRUD UI、公開状態制御がない。
desired_state: 管理者が管理画面から FAQ を CRUD でき、非管理者はアクセスできない。
scope_in:
  - FAQ 一覧
  - FAQ 新規登録
  - FAQ 編集
  - FAQ 削除確認
  - FAQ 公開 / 非公開切り替え
  - 管理者権限チェック
  - 最低限の model / controller / system test
scope_out:
  - FAQ カテゴリ
  - FAQ タグ
  - FAQ 検索
  - CSV import / export
  - 公開{{RESERVATION_DOMAIN}}
  - 多言語対応
  - 一般ユーザー向け FAQ 表示画面の全面刷新
  - FAQ AI 自動生成
affected_areas:
  - admin controller
  - model
  - view / Slim
  - route addition
  - DB schema
  - admin permission
risk_level: medium
risk_reasons:
  - 新規 DB table が必要
  - 管理者権限境界が必要
  - config/routes.rb への route 追加が必要
  - 既存管理画面 UI との整合が必要
human_gate_required: true
human_gate_reason: DB schema、route 追加、管理者権限境界を含むため。
deny_list_checked: true
kiro_required: false
kiro_state: requirements/design/tasks approved before this demo
requested_outcome: 管理者だけが FAQ を管理できる Rails CRUD 機能。
```

## L1 Daily Triage Result

`daily-triage` は agent ではなく Loop Pattern である。Orchestrator Agent は `daily-triage` を起動し、Ticket を読み、L1 では report-only で次の提案だけを行う。

```yaml
l1_triage_proposal:
  ticket_id: AIT-DEMO-FAQ-001
  proposed_status: ready_for_implementation
  proposed_next_owner: Orchestrator
  suggested_next_action: create_activation_record
  proposed_ai_comment: >
    この Ticket は AI Work Ticket として必要情報が揃っています。
    DB schema、route 追加、管理者権限が含まれるため human gate 承認後に L2 実装へ進めます。
    実装 agent は単独ではなく、DB、model、controller、view、auth、test、review に分割してください。
  implementation_agent_type: rails_controller_agent
  triage_notes:
    - Feature-level primary は admin CRUD の request handling を担う rails_controller_agent。
    - DB schema、route、auth は supporting agent として明示的に分離する。
    - jQuery 挙動変更は scope に含めない。必要になった場合は停止して human gate に戻す。
    - money、PDF、daily lock、KPI、{{ACCOUNTING_SYSTEM}}、external API は対象外。
```

L1 では branch 作成、code edit、canonical status の確定更新、CodeCommit 操作は行わない。Spreadsheet に書く場合も Human Communication / L1 Proposed Updates の範囲に留める。

## L2 Activation Record Demo

人間が L2 実装を許可する場合、Orchestrator Agent は次の Activation Record を作成してから `loop-execute` に渡す。

```yaml
activation_record:
  ticket_id: AIT-DEMO-FAQ-001
  approved_autonomy: L2
  approved_by: human
  approved_at: 2026-07-06
  approval_scope:
    - approved Kiro tasks に沿った FAQ 管理 CRUD 実装
    - DB migration の作成
    - admin route の新規追加
    - 管理者権限チェック
    - 必要な model / controller / system test
  approval_excludes:
    - production data access
    - production console
    - CodeCommit PR creation
    - merge
    - deploy
    - FAQ カテゴリ、検索、CSV、多言語、AI 生成
  human_gate:
    status: approved
    approved_for: L2 implementation only
    scope:
      - DB schema
      - route addition
      - admin permission boundary
  branch_name: codex/ait-demo-faq-admin-crud
  base_branch: develop
  agent_plan:
    autonomy_level: L2
    execution_mode: implementation
    primary_agent_type: rails_controller_agent
    supporting_agent_types:
      - agent_planner_agent
      - scope_guard_agent
      - db_schema_agent
      - rails_model_agent
      - route_agent
      - auth_permission_agent
      - view_slim_agent
      - form_validation_agent
      - controller_test_agent
      - model_test_agent
      - system_test_agent
      - manual_verification_agent
      - pr_package_agent
    review_agent_types:
      - human_gate_review_agent
      - security_review_agent
      - performance_review_agent
      - compatibility_review_agent
      - adversarial_review_agent
      - verifier
    coordination_agent_types:
      - purple_coordination_agent
    allowed_mutations:
      - branch
      - code
      - tests
      - docs
      - spreadsheet_execution_fields
      - db_schema
      - route_addition
    why_this_agent_plan: >
      管理画面 CRUD だが、新規 DB table、route 追加、管理者権限、view/form、test がまたがる。
      DB、route、auth を rails_controller_agent に吸収させると gate 判定と責務境界が曖昧になるため分離する。
    planning_note: >
      agent_planner_agent は Activation Record 作成前に agent_plan を作る agent である。
      L2 実行中に使う場合は、承認済み agent_plan の再検証と不足検出に限定し、実装は行わない。
```

## Expected Execution Sequence

### 1. Orchestrator Preflight

Orchestrator Agent は実装前に次を読む。

- `LOOP.md`
- `STATE.md`
- `loop-constraints.md`
- `loop-human-gates.md`
- `loop-budget.md`
- `docs/ai-work-ticket-contract.md`
- `docs/loop-autonomy-contract.md`
- `docs/loop-execution-contract.md`
- `docs/loop-agent-registry.md`
- `docs/loop-agent-behavior-contracts.md`
- 関連する `docs/loop-agent-contracts/*.md`

停止条件:

- Activation Record がない。
- `human_gate.status` が `approved` ではない。
- DB schema、route、auth が agent plan に含まれていない。
- scope に jQuery、money、PDF、daily lock、KPI、{{ACCOUNTING_SYSTEM}}、external API が混ざった。

### 2. Planning Agents

```yaml
agent_result:
  agent_type: agent_planner_agent
  contract: docs/loop-agent-contracts/planning.md
  purpose: agent_plan の妥当性確認
  expected_output:
    - selected primary/supporting/review/coordination agents
    - why_other_agents_not_selected
    - human_gate_review_need
```

`scope_guard_agent` は、FAQ カテゴリ、検索、CSV、一般ユーザー向け FAQ 表示刷新などが混ざらないかを確認する。

### 3. Data And Route Boundary

```yaml
db_schema_agent:
  contract: docs/loop-agent-contracts/data-batch-integration.md
  handles:
    - faqs table migration
    - indexes
    - rollback notes
    - model/spec impact
  must_not:
    - production migration execution
    - data backfill without data_migration_script_agent

route_agent:
  contract: docs/loop-agent-contracts/general-coding.md
  handles:
    - config/routes.rb への明示承認済み admin FAQ route 新規追加
  must_not:
    - 既存 route の変更
    - mount / namespace / auth exposure の無承認変更
```

この時点で DB schema と route 追加の human gate は実装前に再確認する。

### 4. Coding Agents

```yaml
rails_model_agent:
  contract: docs/loop-agent-contracts/general-coding.md
  handles:
    - Faq model
    - question / answer / status validation
    - draft / published enum or existing local equivalent

auth_permission_agent:
  contract: docs/loop-agent-contracts/domain-coding.md
  handles:
    - 管理者のみアクセス可能な権限境界
    - 非管理者の negative case

rails_controller_agent:
  contract: docs/loop-agent-contracts/general-coding.md
  handles:
    - index / new / create / edit / update / destroy
    - params handling
    - redirect / render behavior
    - before_action
  must_not:
    - route 追加を自分だけで行う
    - auth 境界を auth_permission_agent なしで変更する

view_slim_agent:
  contract: docs/loop-agent-contracts/general-coding.md
  handles:
    - FAQ 一覧 / 新規 / 編集 / 削除確認 UI
    - 既存管理画面 UI との整合
  must_not:
    - jQuery event / selector / Ajax を無承認で変更する

form_validation_agent:
  contract: docs/loop-agent-contracts/general-coding.md
  handles:
    - 入力不備時の error 表示
    - server validation と form 表示の整合
```

### 5. Test And Quality Agents

```yaml
model_test_agent:
  contract: docs/loop-agent-contracts/test-quality.md
  covers:
    - question required
    - answer required
    - status allowed values

controller_test_agent:
  contract: docs/loop-agent-contracts/test-quality.md
  covers:
    - admin CRUD success
    - non-admin rejected
    - invalid params render error

system_test_agent:
  contract: docs/loop-agent-contracts/test-quality.md
  covers:
    - 管理者が一覧、登録、編集、削除、公開状態変更を操作できる
    - 非管理者が管理画面へアクセスできない

manual_verification_agent:
  contract: docs/loop-agent-contracts/test-quality.md
  covers:
    - 既存管理画面 UI と大きく乖離していないか
    - 画面遷移と error 表示の確認手順
```

### 6. Review Agents

```yaml
human_gate_review_agent:
  contract: docs/loop-agent-contracts/review-verification.md
  checks:
    - DB schema human gate
    - route addition human gate
    - auth boundary human gate
    - jQuery / money / PDF / KPI / {{ACCOUNTING_SYSTEM}} / external API が混ざっていないか

security_review_agent:
  contract: docs/loop-agent-contracts/review-verification.md
  checks:
    - 管理者権限
    - 非管理者拒否
    - mass assignment
    - PII や secret exposure がないこと

performance_review_agent:
  contract: docs/loop-agent-contracts/review-verification.md
  checks:
    - FAQ 一覧 query
    - index 必要性
    - N+1 の有無

compatibility_review_agent:
  contract: docs/loop-agent-contracts/review-verification.md
  checks:
    - 既存管理画面 view / CSS / jQuery との干渉がないこと
    - UI copy only と behavior change を混同していないこと

adversarial_review_agent:
  contract: docs/loop-agent-contracts/review-verification.md
  checks:
    - scope_out の混入
    - unrelated refactor
    - test 弱体化
    - Kiro tasks とのズレ
```

`verifier` は最後に `APPROVE | REJECT | ESCALATE_HUMAN` を返す。実装修正はしない。

### 7. L2 Repository Package

L2 では CodeCommit PR を作成しない。`pr_package_agent` が draft-equivalent の PR title / description / evidence を作るだけである。

```yaml
pr_package_agent:
  contract: docs/loop-agent-contracts/repository-action.md
  output:
    title: "[DRAFT] AIT-DEMO-FAQ-001 管理画面 FAQ 管理機能を追加"
    description_sections:
      - Status: Draft
      - Scope
      - Changed files
      - Checks
      - Human gate status
      - Known risks
      - Do not merge without explicit human approval.
```

### 8. Optional L3 CodeCommit PR

L3 が別途承認された場合だけ、`codecommit_pr_agent` を repo_action として起動する。

```yaml
l3_repo_action_activation:
  approved_autonomy: L3
  execution_mode: repo_action
  codecommit_pr_creation_allowed: true
  primary_agent_type: codecommit_pr_agent
  supporting_agent_types:
    - pr_package_agent
  allowed_mutations:
    - codecommit_pr
  requires_before_command:
    - verifier APPROVE
    - human approval for AWS CodeCommit PR command
    - repository_name / region / source_branch / destination_branch
```

`codecommit_comment_agent` は reviewer comment を投稿する場合にだけ使う。approve、merge、resolve、close は行わない。

## Agent Usage Check

| Checkpoint | Selected agent | Contract | Verdict | Reason |
| --- | --- | --- | --- | --- |
| Pattern selection | Orchestrator + daily-triage | `docs/pattern-picker.md`, `loop-triage` | OK | daily-triage は agent ではなく L1 report-only pattern として扱っている |
| Agent plan creation | `agent_planner_agent` | `planning.md` | OK | DB、route、auth、view、test、review を分離している |
| Scope guard | `scope_guard_agent` | `planning.md` | OK | FAQ 検索、CSV、一般ユーザー画面刷新などの scope_out を明示している |
| DB schema | `db_schema_agent` | `data-batch-integration.md` | OK | migration と rollback notes を担当し、production execution を禁止している |
| Route addition | `route_agent` | `general-coding.md` | OK | 新規 route 追加だけ。既存 route 変更はしない |
| Admin permission | `auth_permission_agent` | `domain-coding.md` | OK | 権限境界を controller agent へ混ぜていない |
| CRUD request handling | `rails_controller_agent` | `general-coding.md` | OK | feature-level primary として妥当。ただし route/auth は supporting に分離済み |
| Model behavior | `rails_model_agent` | `general-coding.md` | OK | validation と persistence invariant を担当する |
| View / form | `view_slim_agent`, `form_validation_agent` | `general-coding.md` | OK | jQuery 挙動変更は scope 外として停止条件にしている |
| Tests | `model_test_agent`, `controller_test_agent`, `system_test_agent` | `test-quality.md` | OK | model、controller、権限、画面操作を分けている |
| Human gate | `human_gate_review_agent` | `review-verification.md` | OK | DB、route、auth を機能影響で判定する |
| Security | `security_review_agent` | `review-verification.md` | OK | 管理者権限、mass assignment、非管理者拒否を確認する |
| Compatibility | `compatibility_review_agent` | `review-verification.md` | OK | view 変更と legacy jQuery 干渉を確認する |
| Final check | `verifier` | `.codex/agents/verifier.toml` | OK | 実装せず、証跡に基づいて最終判定だけ返す |
| PR package | `pr_package_agent` | `repository-action.md` | OK | L2 では PR command を実行しない |
| CodeCommit PR | `codecommit_pr_agent` | `repository-action.md`, `.codex/agents/codecommit_pr_agent.toml` | OK if L3 approved | L3 承認、verifier APPROVE、人間承認後のみ AWS command を扱う |

## Agents Intentionally Not Selected

| Agent | Reason |
| --- | --- |
| `general_implementer_agent` | DB、route、auth、view、test がまたがり、低リスク小修正ではない |
| `jquery_behavior_agent` | 今回は jQuery event、selector、Ajax、shared UI state を変更しない。必要になったら停止して agent plan を作り直す |
| `money_calculation_agent` | {{MONEY_DOMAIN}}、{{TAX_DOMAIN}}、丸め、割引、合計に影響しない |
| `pdf_report_agent` | PDF / {{REPORT_DOCUMENT_DOMAIN}}出力に影響しない |
| `daily_lock_agent` | {{DAILY_LOCK_DOMAIN}}、lock / unlock に影響しない |
| `kpi_management_agent` | management / KPI / aggregation に影響しない |
| `bugyo_accounting_agent` | {{ACCOUNTING_SYSTEM}}、{{ACCOUNTING_DOMAIN}} master、{{JOURNAL_DOMAIN}}に影響しない |
| `external_api_agent` | 外部 API 連携を扱わない |
| `script_processing_agent` | script / batch / local automation を扱わない |
| `codecommit_comment_agent` | reviewer comment 投稿が今回の demo 範囲にない |

## Demo Verdict

このデモ上では、sub-agent は適切に分担されている。

ただし、実運用では次の条件を満たさない限り L2/L3 実行へ進めない。

- AI Work Ticket が canonical schema を満たしている。
- Kiro requirements / design / tasks が必要な場合は承認済みである。
- Activation Record がある。
- DB schema、route、auth の human gate が承認済みである。
- `loop-constraints.md` と `loop-human-gates.md` に反していない。
- 実装前後で `human_gate_review_agent` と `verifier` が通っている。
- L3 CodeCommit PR は別承認である。
