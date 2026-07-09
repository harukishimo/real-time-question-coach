# Loop Agent Registry

このドキュメントは、Realtime Question Coach Loop Engineering で起動できる agent 種別を定義する。

`daily-triage` は agent ではなく Loop Pattern である。Orchestrator Agent は Pattern、実行可否、agent plan を選ぶ役割であり、原則として自分では実装しない。

agent は L2 / L3 専用ではない。L1 でも、read-only、triage、planning、review、human gate 判定補助、agent plan 作成のために agent を起動できる。ただし L1 agent は report-only であり、code、branch、canonical ticket fields、external state を変更しない。

L2 / L3 で実装を行う場合は、対象 AI Work Ticket の Activation Record とこの registry に従って coding / verification / repository action agent を選ぶ。

## Current Runtime Status

現時点で物理ファイルとして存在する agent は次である。

| File | Runtime role |
| --- | --- |
| `.codex/agents/implementer.toml` | L2 / L3 の実装 runtime。下記の coding agent profile のいずれかとして動く |
| `.codex/agents/verifier.toml` | 実装後、または L1 の検証観点整理時の checker。`APPROVE`, `REJECT`, `ESCALATE_HUMAN` または report-only finding を返す |
| `.codex/agents/script_processing_agent.toml` | script 作成、修正、dry-run 設計、実行安全性確認に特化した coding agent |
| `.codex/agents/behavior_contract_review_agent.toml` | agent registry / behavior contract / runtime agent file の整合性を確認する read-only review agent |
| `.codex/agents/codecommit_pr_agent.toml` | L3 repo_action 承認時だけ CodeCommit PR 作成 command を扱う repository action agent |
| `.codex/agents/codecommit_comment_agent.toml` | L3 repo_action 承認時だけ CodeCommit reviewer comment command を扱う repository action agent |

この registry の agent は、まず論理 agent profile として扱う。専用 `.toml` がない coding agent profile は、`implementer.toml` がその profile の制約を読んで実行する。review / verification / repository action agent は maker/checker/repo-action 分離を守るため、専用 `.toml` がある場合だけ直接実行する。運用上必要になった profile から専用 `.toml` へ分離してよい。

各 agent の具体的な振る舞いは `docs/loop-agent-behavior-contracts.md` と `docs/loop-agent-contracts/*.md` を正とする。この registry は一覧と選択基準を定義し、behavior contracts は共通ルールと summary、`docs/loop-agent-contracts/*.md` は実行手順、停止条件、output schema を定義する。

## Core Rule

agent を起動する場合は、autonomy level に応じた agent plan が必要である。

```yaml
agent_plan:
  autonomy_level: L1 | L2 | L3
  execution_mode: read_only | report_only | implementation | verification | repo_action
  primary_agent_type:
  supporting_agent_types: []
  review_agent_types:
    - verifier
  coordination_agent_types: []
  allowed_mutations: []
  why_this_agent_plan:
```

L1 では、`execution_mode` は `read_only` または `report_only` のみである。L1 agent は、調査、分類、提案、human gate 判定補助、agent plan 作成、質問作成、run-log 記録案の作成までを担当する。

L2 / L3 で実装を開始するには、Activation Record に承認済み agent plan が必要である。`agent_plan` がない場合、Orchestrator Agent は実装を開始しない。

## Agent Type Groups

この registry では、agent を次の group に分ける。

| Group | Purpose | Code edit |
| --- | --- | --- |
| `planning` | 仕様、設計、実装計画、agent plan の補助 | no by default |
| `coding` | code / test / docs を実際に変更する | yes, only within Activation Record |
| `domain_coding` | {{RESERVATION_DOMAIN}}、{{BILLING_DOMAIN}}、KPI、{{DAILY_LOCK_DOMAIN}}、{{ACCOUNTING_SYSTEM}}など Realtime Question Coach 固有業務領域を実装する | explicit approval required |
| `data_ops` | DB、migration、seed、CSV、script、batch、export を扱う | explicit approval required |
| `review` | 対立レビュー、security、regression、performance などを確認する | no |
| `verification` | 最終判定を返す | no |
| `repo_action` | PR、review comment、changelog など repository service 周辺を扱う | no code edit |

Red Team / Blue Team / Purple Team は、MVP完了判定では必須の運用ゲートとして扱う。

- Red Team は `adversarial_review_agent` を主担当とし、完了主張を敵対的に検証する。MVPまたはAI Work Ticketを `done` にするには Red Team verdict が `APPROVE` でなければならない。
- Blue Team は実装agentと修正担当agentを指し、Red Team / QA / Tester findings を scope 内で修正する。
- Purple Team は `purple_coordination_agent` を主担当とし、実装側とレビュー側の判断差分を整理する。finding がある場合は、修正して再試験するか、human gate / blocked に戻す。
- QA Agent と Tester Agent は、完了判定に必要な test/quality gate である。QA Agent は試験設計と証跡妥当性、Tester Agent は実試験実行と結果記録を担当する。

## Canonical Agent Types

`implementation_agent_type` には、原則として primary implementation agent だけを書く。planning / review / verification / repository action agent は `implementation_agent_type` に書かず、Activation Record の `agent_plan`、`handoff_notes`、`triage_notes`、または `loop-run-log.md` に残す。

各表の `Write/action level` は、その agent が code edit、canonical field 更新、repository command などの mutation を実行できる自律度を示す。agent を起動できる自律度ではない。L1 でも、必要であれば任意の agent type を `read_only` または `report_only` として起動できるが、実装、branch 作成、canonical update、external command は行わない。

### Planning Agents

| agent_type | Main responsibility | Select when | Write/action level | Code edit | Gate posture |
| --- | --- | --- | --- | --- | --- |
| `kiro_requirements_agent` | requirements を整理する | 仕様、受け入れ条件、scope が未分解 | L1 / L2 | no | human approval per Kiro phase |
| `kiro_design_agent` | design を整理する | 仕様はあるが設計、責務境界、データ流れが未整理 | L1 / L2 | no | human approval per Kiro phase |
| `kiro_tasks_agent` | tasks を実装単位に分解する | 実装前に task split が必要 | L1 / L2 | no | human approval per Kiro phase |
| `agent_planner_agent` | agent plan を作る | L1 run plan または L2 / L3 Activation Record に agent_plan がない | L1 / L2 | no | no implementation |
| `scope_guard_agent` | scope_in / scope_out / non_goals を確認する | scope creep が起きやすい ticket | L1 / L2 / L3 | no | escalation aware |

### General Coding Agents

| agent_type | Main responsibility | Select when | Write/action level | Code edit | Gate posture |
| --- | --- | --- | --- | --- | --- |
| `general_implementer_agent` | 低リスクの一般実装 | 専門 agent が不要な小さい修正 | L2 / L3 | yes | normal |
| `rails_controller_agent` | controller、params、response、redirect、before_action | `app/controllers/**` の request handling が主対象 | L2 / L3 | yes | route/auth impact check |
| `rails_model_agent` | model、association、validation、callback | `app/models/**` の domain persistence が主対象 | L2 / L3 | yes | domain gate check |
| `rails_service_agent` | service object、use case、business process | `app/services/**` の内部処理が主対象 | L2 / L3 | yes | external / money / PDF gate check |
| `rails_helper_agent` | helper、decorator、presenter 相当 | 表示補助や整形 logic が主対象 | L2 / L3 | yes | output meaning check |
| `grape_api_agent` | {{API_FRAMEWORK}} API、serializer、API response | `app/api/**`, `app/serializers/**` が主対象 | L2 / L3 | yes | auth / external contract gate |
| `rails_job_agent` | ActiveJob、background job | `app/jobs/**` が主対象 | L2 / L3 | yes | async / retry / external state gate |
| `mailer_notification_agent` | mailer、notification、送信内容 | `app/mailers/**`, `app/notifications/**` が主対象 | L2 / L3 | yes | delivery / personal data gate |
| `uploader_storage_agent` | upload、ActiveStorage、file handling | `app/uploaders/**`, attachment, file validation が主対象 | L2 / L3 | yes | security / data retention gate |
| `view_slim_agent` | Slim / view / partial / form | `app/views/**` の表示や form が主対象 | L2 / L3 | yes | jQuery / money / PDF copy check |
| `jquery_behavior_agent` | jQuery、event、selector、Ajax、shared UI state | `app/assets/javascripts/**`, vendor jQuery 周辺の挙動変更 | L2 / L3 | explicit approval required | strict human gate |
| `stimulus_js_agent` | Stimulus / app/javascript controller | `app/javascript/controllers/**` が主対象 | L2 / L3 | yes | JS behavior gate |
| `frontend_asset_agent` | CSS、SCSS、image、asset pipeline | `app/assets/stylesheets/**`, images, packs が主対象 | L2 / L3 | yes | visual / layout check |
| `form_validation_agent` | 入力 validation、error 表示、form UX | form、model validation、client/server validation がまたがる | L2 / L3 | yes | data / auth / jQuery check |
| `route_agent` | route 追加 | `config/routes.rb` に新規 route を追加する | L2 / L3 | explicit approval required | route-only exception; no route mutation |
| `i18n_copy_agent` | locale、表示文言、translation | `config/locales/**` や UI 文言のみ | L2 / L3 | limited | config file gate; text-only safety needed |
| `docs_agent` | docs、runbook、markdown、spec 周辺更新 | code behavior を変えない docs 更新 | L2 / L3 | docs only | low unless policy changes |

### Realtime Question Coach Domain Coding Agents

| agent_type | Main responsibility | Select when | Write/action level | Code edit | Gate posture |
| --- | --- | --- | --- | --- | --- |
| `reservation_domain_agent` | event、room、reservation、availability | {{RESERVATION_DOMAIN}}、{{ROOM_DOMAIN}}、日程、仮押さえ、確定、{{CANCEL_DOMAIN}}に関係する | L2 / L3 | explicit approval required | strict human gate |
| `estimate_billing_agent` | estimate、bill、receipt、statement、payment | {{ESTIMATE_DOMAIN}}、{{BILLING_DOMAIN}}、{{RECEIPT_DOMAIN}}、明細、支払いに関係する | L2 / L3 | explicit approval required | strict money gate |
| `money_calculation_agent` | {{MONEY_DOMAIN}}計算、{{TAX_DOMAIN}}、丸め、割引、合計 | {{MONEY_DOMAIN}}、{{TAX_DOMAIN}}、単価、計算式、{{BILLING_DOMAIN}}額に影響する | L2 / L3 | explicit approval required | strict human gate |
| `pdf_report_agent` | PDF 生成、{{REPORT_DOCUMENT_DOMAIN}}、{{PDF_TEMPLATE_ENGINE}}、TLF | PDF generation / template / legal or accounting output に関係する | L2 / L3 | explicit approval required | strict human gate except safe text-only |
| `daily_lock_agent` | {{DAILY_LOCK_DOMAIN}}、lock、unlock、締め後変更制御 | `daily_lock`, `daily_locked`, lock statement に関係する | L2 / L3 | explicit approval required | strict human gate |
| `kpi_management_agent` | management、KPI、集計、経営指標 | `management_*`, KPI, sales aggregation に関係する | L2 / L3 | explicit approval required | strict human gate |
| `bugyo_accounting_agent` | {{ACCOUNTING_SYSTEM}}、{{ACCOUNTING_DOMAIN}} master、customer code、journal | {{ACCOUNTING_SYSTEM}}Customer、{{ACCOUNTING_SYSTEM}}連携、{{ACCOUNTING_DOMAIN}} master、{{JOURNAL_DOMAIN}}に関係する | L2 / L3 | explicit approval required | strict human gate |
| `master_data_agent` | master、type、price、system setting | *_types、価格 master、設定 master に関係する | L2 / L3 | explicit approval required | data integrity gate |
| `auth_permission_agent` | role、権限、管理者制御、認可 | role、management_user、admin access、before_action に関係する | L2 / L3 | explicit approval required | strict security gate |
| `customer_data_agent` | customer、staff、個人情報、会社情報 | customer / customer_staff / personal data に関係する | L2 / L3 | explicit approval required | privacy gate |

### Data, Batch, And Integration Agents

| agent_type | Main responsibility | Select when | Write/action level | Code edit | Gate posture |
| --- | --- | --- | --- | --- | --- |
| `db_schema_agent` | migration、schema、index、foreign key | `db/migrate`, schema, DB structure に影響する | L2 / L3 | explicit approval required | strict human gate |
| `data_migration_script_agent` | one-off script、data backfill | `script/**`, data repair, import script に関係する | L2 / L3 | explicit approval required | dry-run / backup evidence required |
| `script_processing_agent` | 汎用 script 処理、運用補助 script、dry-run / idempotency | data backfill 以外の `script/**`, helper script, operational script, local automation が主対象 | L2 / L3 | explicit approval required | dry-run / side-effect gate |
| `seed_master_agent` | seed、master import、CSV master | `lib/seeds/**`, `doc/template/**`, insert CSV に関係する | L2 / L3 | explicit approval required | master data gate |
| `csv_import_agent` | CSV import、parser、bulk create | CSV input、import、validation、encoding に関係する | L2 / L3 | explicit approval required | data integrity gate |
| `excel_export_agent` | Excel / raw data export | Excel export、annual result、raw data、lambda script に関係する | L2 / L3 | explicit approval required | accounting / data gate |
| `batch_rake_agent` | rake task、lib/batch、scheduled job | `lib/tasks/**`, `lib/batch/**`, `config/schedule.rb` に関係する | L2 / L3 | explicit approval required | schedule / external state gate |
| `external_api_agent` | external API service / connector | 外部 API、{{EXTERNAL_SIGNATURE_SERVICE}}、{{CRM_SERVICE}}、AWS connector 等に関係する | L2 / L3 | explicit approval required | default escalate |
| `aws_infra_agent` | AWS, EB, Docker, infrastructure config | `.ebextensions`, Docker, AWS initializer, deploy config に関係する | L2 / L3 | explicit approval required | default deny unless approved |
| `dependency_agent` | Gem / npm dependency update | Gemfile, package, lockfile に関係する | L2 / L3 | explicit approval required | dependency-sweeper handoff |
| `config_agent` | config 変更 | `config/**` を変更する必要がある | L2 / L3 | explicit approval required | default deny except scoped route addition |

### Test And Quality Agents

| agent_type | Main responsibility | Select when | Write/action level | Code edit | Gate posture |
| --- | --- | --- | --- | --- | --- |
| `controller_test_agent` | controller spec | controller 変更の検証が必要 | L2 / L3 | tests only | cannot weaken tests |
| `model_test_agent` | model spec | model / validation / domain rule の検証が必要 | L2 / L3 | tests only | cannot weaken tests |
| `service_test_agent` | service spec | service object / PDF / integration logic の検証が必要 | L2 / L3 | tests only | cannot weaken tests |
| `view_test_agent` | view spec | view / partial / helper の検証が必要 | L2 / L3 | tests only | cannot weaken tests |
| `system_test_agent` | system spec / browser flow | UI flow、JS、権限、画面遷移を確認する必要がある | L2 / L3 | tests only | may require human gate for JS |
| `qa_agent` | 試験計画、受入条件対応、証跡妥当性 | AI Work Ticket を `done` にする前に試験網羅性を確認する | L2 / L3 | tests/docs only | cannot approve without evidence |
| `tester_agent` | 実試験実行、Playwright/API/manual evidence 記録 | UI/API/browser/audio/export等の挙動を実際に試す必要がある | L2 / L3 | tests only | cannot mark pass without command/artifact |
| `task_test_agent` | rake / task / script spec | lib/tasks, script, batch の検証が必要 | L2 / L3 | tests only | cannot run destructive tasks |
| `regression_test_agent` | 既存挙動の退行確認 | 影響範囲が広い、関連 spec が多い | L2 / L3 | tests only | evidence required |
| `manual_verification_agent` | 手動確認手順の作成 | 自動 test だけでは確認しにくい | L1 / L2 / L3 | no by default | human-readable evidence |

### Review, Coordination, And Verification Agents

| agent_type | Main responsibility | Select when | Write/action level | Code edit | Gate posture |
| --- | --- | --- | --- | --- | --- |
| `adversarial_review_agent` | scope creep、仕様漏れ、危険変更を探す | L2 / L3 実装後の対立レビュー | L2 / L3 | no | adversarial |
| `security_review_agent` | auth、permission、secret、PII、file upload を確認 | 認可、個人情報、upload、external API が関係する | L2 / L3 | no | strict |
| `human_gate_review_agent` | `loop-human-gates.md` 判定 | human gate 対象か曖昧な場合 | L1 / L2 / L3 | no | escalation first |
| `performance_review_agent` | N+1、重い query、batch performance | query、集計、一覧、export、batch が関係する | L2 / L3 | no | evidence required |
| `compatibility_review_agent` | 既存 UI / jQuery / browser 互換 | JS、CSS、view、vendor asset が関係する | L2 / L3 | no | regression aware |
| `behavior_contract_review_agent` | agent 定義、registry、behavior contract、runtime file の整合性確認 | agent 追加、agent 振る舞い変更、sub-agent 起動可否レビューが必要 | L1 / L2 / L3 | no | contract compliance |
| `purple_coordination_agent` | 実装 agent と review agent の判断差分を整理 | review finding 後、再実装か human escalation か迷う | L2 / L3 | no by default | escalation aware |
| `verifier` | 最終判定 | 実装後の必須 checker | L2 / L3 | no | default reject until proven safe |

### Repository Action Agents

| agent_type | Main responsibility | Select when | Write/action level | Code edit | Gate posture |
| --- | --- | --- | --- | --- | --- |
| `codecommit_pr_agent` | PR package、CodeCommit PR 作成 | verifier `APPROVE` 後、L3 で PR 作成が明示許可された | L3 only | no code edit | command approval required |
| `codecommit_comment_agent` | CodeCommit reviewer comment 投稿 | L3 で reviewer comment command が明示許可された | L3 only | no code edit | no approve / merge / resolve |
| `changelog_agent` | changelog / release note draft | release note や変更履歴が必要 | L1 / L2 / L3 | docs only | changelog-drafter handoff |
| `pr_package_agent` | PR title / description / evidence 整理 | L2 で PR 作成前の package を作る | L2 / L3 | no code edit | no PR command in L2 |

## Default Agent Compositions

### Low Risk Bug Fix

```yaml
agent_plan:
  autonomy_level: L2
  execution_mode: implementation
  primary_agent_type: general_implementer_agent
  supporting_agent_types:
    - regression_test_agent
  review_agent_types:
    - adversarial_review_agent
    - qa_agent
    - tester_agent
    - verifier
  coordination_agent_types: []
  allowed_mutations:
    - branch
    - code
    - tests
    - docs
    - spreadsheet_execution_fields
  why_this_agent_plan: "scope が小さい bug fix だが、scope creep と regression は確認するため。"
```

### Standard Rails CRUD Feature

```yaml
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
    - qa_agent
    - tester_agent
    - verifier
  coordination_agent_types:
    - purple_coordination_agent
  allowed_mutations:
    - branch
    - code
    - tests
    - docs
    - spreadsheet_execution_fields
  why_this_agent_plan: "controller, model, view, auth, tests がまたがるため。"
```

### jQuery Or Complex UI Change

```yaml
agent_plan:
  autonomy_level: L2
  execution_mode: implementation
  primary_agent_type: jquery_behavior_agent
  supporting_agent_types:
    - view_slim_agent
    - system_test_agent
  review_agent_types:
    - compatibility_review_agent
    - human_gate_review_agent
    - qa_agent
    - tester_agent
    - verifier
  coordination_agent_types:
    - purple_coordination_agent
  allowed_mutations:
    - branch
    - code
    - tests
    - docs
    - spreadsheet_execution_fields
  why_this_agent_plan: "event order, selector, shared UI state による既存画面影響を確認するため。"
```

### Money, Billing, Reservation, PDF, Or Daily Lock

```yaml
agent_plan:
  autonomy_level: L2
  execution_mode: implementation
  primary_agent_type: estimate_billing_agent
  supporting_agent_types:
    - money_calculation_agent
    - service_test_agent
    - regression_test_agent
  review_agent_types:
    - human_gate_review_agent
    - adversarial_review_agent
    - qa_agent
    - tester_agent
    - verifier
  coordination_agent_types:
    - purple_coordination_agent
  allowed_mutations:
    - branch
    - code
    - tests
    - docs
    - spreadsheet_execution_fields
  why_this_agent_plan: "{{MONEY_DOMAIN}}、{{REPORT_DOCUMENT_DOMAIN}}、締め、{{RESERVATION_DOMAIN}}に関わる変更は strict human gate 対象のため。"
```

### DB Or Data Migration

```yaml
agent_plan:
  autonomy_level: L2
  execution_mode: implementation
  primary_agent_type: db_schema_agent
  supporting_agent_types:
    - data_migration_script_agent
    - model_test_agent
    - task_test_agent
  review_agent_types:
    - human_gate_review_agent
    - performance_review_agent
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
  why_this_agent_plan: "DB とデータ変更は rollback、migration、既存データ影響を確認する必要があるため。"
```

### General Script Processing

```yaml
agent_plan:
  autonomy_level: L2
  execution_mode: implementation
  primary_agent_type: script_processing_agent
  supporting_agent_types:
    - task_test_agent
    - manual_verification_agent
  review_agent_types:
    - human_gate_review_agent
    - adversarial_review_agent
    - verifier
  coordination_agent_types: []
  allowed_mutations:
    - branch
    - code
    - tests
    - docs
    - spreadsheet_execution_fields
    - script
  why_this_agent_plan: "script は実行時副作用、入力、dry-run、idempotency、対象環境の誤認が事故につながるため。"
```

### L3 CodeCommit PR

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

## Routing Rules

Orchestrator Agent は agent 起動前に、次の順序で agent を選ぶ。

1. `loop-constraints.md` と `loop-human-gates.md` を読む。
2. AI Work Ticket の `scope_in`, `scope_out`, `affected_areas`, `risk_reasons`, `required_checks`, `cc_sdd_required`, `kiro_required` を確認する。
3. deny list または未承認 human gate があれば、mutation 可能な coding / repo action agent を起動せず停止する。L1 の read-only 調査 agent は、停止理由を整理する目的に限って起動できる。
4. `affected_areas`, `work_type`, `detailed_requirements`, `agent_alignment`, Kiro tasks から primary agent を選ぶ。
5. 変更対象が複数領域にまたがる場合は supporting agent を追加する。
6. `auth`, `money`, `PDF`, `daily lock`, `KPI`, `management`, `{{ACCOUNTING_SYSTEM}}`, `DB`, `external API`, `config`, `route`, `jQuery` のいずれかに関係する場合は `human_gate_review_agent` を review agent に含める。
7. 実装がある場合は必ず Red Team として `adversarial_review_agent` を含める。`done` には Red Team `APPROVE` が必要である。
8. 実装がある場合は必ず `qa_agent` と `tester_agent` を含める。QA Agent は試験網羅性、Tester Agent は実試験実行と結果記録を担当する。
9. 実装がある場合は必ず `verifier` を review agent に含める。L1 では verifier を report-only checker として使える。
10. Red Team、QA Agent、Tester Agent、実装agentの判断が割れた場合、またはfindingが残る場合は `purple_coordination_agent` を coordination agent に含める。
11. `agent_plan` を Activation Record、Spreadsheet、または `loop-run-log.md` に残す。

## Selection Matrix

| Signal | Primary agent | Supporting agents | Required review |
| --- | --- | --- | --- |
| simple docs only | `docs_agent` | none | `verifier` |
| requirements / design / tasks missing | `kiro_requirements_agent` / `kiro_design_agent` / `kiro_tasks_agent` | `agent_planner_agent` | human review |
| low-risk bug fix | `general_implementer_agent` | `regression_test_agent` | `adversarial_review_agent`, `verifier` |
| Rails controller change | `rails_controller_agent` | `controller_test_agent` | `adversarial_review_agent`, `verifier` |
| model / validation / association | `rails_model_agent` | `model_test_agent` | `adversarial_review_agent`, `verifier` |
| service object / business process | `rails_service_agent` | `service_test_agent` | `adversarial_review_agent`, `verifier` |
| {{API_FRAMEWORK}} API / serializer | `grape_api_agent` | `controller_test_agent` | `security_review_agent`, `verifier` |
| view / Slim / form | `view_slim_agent` | `view_test_agent` | `compatibility_review_agent`, `verifier` |
| jQuery behavior | `jquery_behavior_agent` | `system_test_agent` | `compatibility_review_agent`, `human_gate_review_agent`, `verifier` |
| Stimulus / app/javascript | `stimulus_js_agent` | `system_test_agent` | `compatibility_review_agent`, `verifier` |
| CSS / asset | `frontend_asset_agent` | `manual_verification_agent` | `compatibility_review_agent`, `verifier` |
| route addition | `route_agent` | `controller_test_agent` | `human_gate_review_agent`, `security_review_agent`, `verifier` |
| i18n / UI copy | `i18n_copy_agent` | `manual_verification_agent` | `human_gate_review_agent` when money/PDF/legal meaning |
| auth / permission | `auth_permission_agent` | `controller_test_agent` | `security_review_agent`, `human_gate_review_agent`, `verifier` |
| reservation / event / room | `reservation_domain_agent` | `rails_service_agent`, `regression_test_agent` | `human_gate_review_agent`, `verifier` |
| estimate / billing / receipt / statement | `estimate_billing_agent` | `money_calculation_agent`, `service_test_agent` | `human_gate_review_agent`, `verifier` |
| money / tax / total | `money_calculation_agent` | `model_test_agent`, `service_test_agent` | `human_gate_review_agent`, `verifier` |
| PDF / TLF / {{PDF_TEMPLATE_ENGINE}} | `pdf_report_agent` | `service_test_agent`, `manual_verification_agent` | `human_gate_review_agent`, `verifier` |
| daily lock | `daily_lock_agent` | `regression_test_agent` | `human_gate_review_agent`, `verifier` |
| KPI / management | `kpi_management_agent` | `performance_review_agent`, `regression_test_agent` | `human_gate_review_agent`, `verifier` |
| {{ACCOUNTING_SYSTEM}} / accounting master | `bugyo_accounting_agent` | `service_test_agent` | `human_gate_review_agent`, `verifier` |
| customer / personal data | `customer_data_agent` | `controller_test_agent` | `security_review_agent`, `human_gate_review_agent`, `verifier` |
| DB schema | `db_schema_agent` | `model_test_agent` | `human_gate_review_agent`, `performance_review_agent`, `verifier` |
| one-off script / backfill | `data_migration_script_agent` | `task_test_agent` | `human_gate_review_agent`, `verifier` |
| general script / operational helper | `script_processing_agent` | `task_test_agent`, `manual_verification_agent` | `human_gate_review_agent`, `adversarial_review_agent`, `verifier` |
| CSV import | `csv_import_agent` | `task_test_agent` | `human_gate_review_agent`, `verifier` |
| Excel export / raw data | `excel_export_agent` | `task_test_agent` | `human_gate_review_agent`, `verifier` |
| batch / schedule | `batch_rake_agent` | `task_test_agent` | `human_gate_review_agent`, `verifier` |
| external API | `external_api_agent` | `service_test_agent` | `human_gate_review_agent`, `security_review_agent`, `verifier` |
| AWS / infra / Docker | `aws_infra_agent` | none | `human_gate_review_agent`, `security_review_agent`, `verifier` |
| dependency update | `dependency_agent` | `regression_test_agent` | dependency-sweeper, `verifier` |
| agent behavior contract review | `behavior_contract_review_agent` | `scope_guard_agent` | `verifier` when implementation follows |
| CodeCommit PR | `codecommit_pr_agent` | `pr_package_agent` | `verifier` |
| CodeCommit reviewer comment | `codecommit_comment_agent` | none | `verifier` |
| changelog | `changelog_agent` | `pr_package_agent` | human review if release-facing |

## Review And Coordination Responsibilities

### adversarial_review_agent

- scope 外実装が混ざっていないか確認する。
- `scope_out`, `non_goals`, `explicitly_forbidden_actions` に反していないか確認する。
- test を削除、skip、弱体化していないか確認する。
- Kiro spec と実装がズレていないか確認する。
- 修正はしない。finding を出す。

### human_gate_review_agent

- `loop-human-gates.md` を正として、実装前後の gate 判定を確認する。
- path だけでなく機能影響で判定する。
- 判断に迷う場合は `ESCALATE_HUMAN` 側に倒す。

### security_review_agent

- auth、role、permission、secret、PII、file upload、external API、session、cookie 影響を確認する。
- data exposure、privilege escalation、unsafe redirect、mass assignment を確認する。

### compatibility_review_agent

- jQuery event order、selector、DOM state、既存 UI、browser 互換、vendor asset 影響を確認する。
- UI copy だけの変更か、挙動に影響する変更かを分ける。

### behavior_contract_review_agent

- agent type が `docs/loop-agent-registry.md` と `docs/loop-agent-behavior-contracts.md` の両方に存在するか確認する。
- 専用 `.toml` がある場合、read order、禁止事項、output、stop condition が behavior contract と矛盾していないか確認する。
- L1 / L2 / L3 の許可範囲、mutation 条件、human gate 条件が曖昧になっていないか確認する。
- 実装や修正はしない。finding と改善案だけを返す。

### purple_coordination_agent

- coding agent と review agent の判断差分を整理する。
- scope 内で再実装できるか、人間判断が必要かを分ける。
- `max_fix_attempts` 内で戻すか、`human_gate_pending` にするかを判断する。
- 原則として code edit しない。

### verifier

`verifier` は `.codex/agents/verifier.toml` を正として、最終的に次のいずれかだけを返す。

```text
APPROVE
REJECT
ESCALATE_HUMAN
```

L1 read-only / report-only で verifier を使う場合は、実装判定ではなく `L1_FINDING` を返す。L1 verifier は承認、却下、実装継続判断、repository action を行わない。

Verifier は実装しない。Verifier は review findings、coordination decision、test evidence、human gate evidence、CodeCommit PR evidence を見て最終判断する。

## Spreadsheet Usage

`implementation_agent_type` はこの registry の `agent_type` のうち、primary implementation agent として起動するものだけを書く。複数 agent が必要な場合は次のどちらかで扱う。

- `implementation_agent_type` には primary agent だけを書く。
- planning / supporting / review / coordination / repository action agent は `handoff_notes`, `triage_notes`, `ai_comment_summary`, `loop-run-log.md`, または Activation Record の `agent_plan` に書く。

L1 でも agent を起動できる。ただし L1 agent は `read_only` または `report_only` に限り、次だけを行う。

- ticket、docs、state、run-log、spreadsheet の許可範囲を読む。
- triage、risk、human gate、agent plan、質問、AI comment、status 更新案を作る。
- Human Communication columns、L1 Proposed Updates columns、`STATE.md`、`loop-run-log.md` の許可範囲に提案や証跡を残す。

L1 agent は code、branch、canonical ticket fields、external issue、PR、CodeCommit、production、secrets、config、DB、外部サービスを変更しない。

L2 / L3 で mutation を伴う agent を起動する場合は、Activation Record に承認済み `agent_plan` が必要である。

## When To Create Dedicated Agent Files

次に該当する agent profile は、専用 `.codex/agents/*.toml` へ分離してよい。

- 同じ profile が繰り返し使われる。
- guardrail が profile ごとに大きく異なる。
- prompt が長くなり、汎用 `implementer.toml` では誤動作しやすい。
- coding / review / coordination / repository action の役割を実行時に明確に分離したい。

初期分離候補:

```text
.codex/agents/rails_controller_agent.toml
.codex/agents/rails_model_agent.toml
.codex/agents/rails_service_agent.toml
.codex/agents/view_slim_agent.toml
.codex/agents/jquery_behavior_agent.toml
.codex/agents/money_calculation_agent.toml
.codex/agents/pdf_report_agent.toml
.codex/agents/db_schema_agent.toml
.codex/agents/script_processing_agent.toml
.codex/agents/human_gate_review_agent.toml
.codex/agents/adversarial_review_agent.toml
.codex/agents/behavior_contract_review_agent.toml
.codex/agents/purple_coordination_agent.toml
.codex/agents/codecommit_pr_agent.toml
.codex/agents/codecommit_comment_agent.toml
```

ただし、専用 agent file を作る場合も、この registry の agent_type と責務境界を正とする。
