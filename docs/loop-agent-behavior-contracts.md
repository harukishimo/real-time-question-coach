# Loop Agent Behavior Contracts

このドキュメントは、Realtime Question Coach Loop Engineering で起動できる各 agent の振る舞いを定義する。

`docs/loop-agent-registry.md` は agent の一覧と選択基準を定義する。このファイルは共通ルール、共通 output、agent summary、詳細 contract への index を定義する。

このファイル内の `Reads / Does / Does not / Output` 表は、agent の一覧と責務境界を示す summary である。実行用定義としては不十分であり、agent を起動する場合は、対象 group の `docs/loop-agent-contracts/*.md` を必ず読む。

## Binding Rule

すべての agent は、起動前に次を満たす。

- `agent_type` が `docs/loop-agent-registry.md` に存在する。
- `agent_plan` に `autonomy_level`, `execution_mode`, `primary_agent_type`, `supporting_agent_types`, `review_agent_types`, `coordination_agent_types`, `allowed_mutations`, `why_this_agent_plan` がある。
- 対象 `agent_type` に対応する詳細 contract file を読んでいる。
- L1 では `execution_mode` が `read_only` または `report_only` である。
- L2 / L3 で mutation を行う場合は、対象 AI Work Ticket ごとの Activation Record がある。
- `loop-constraints.md`, `loop-human-gates.md`, `loop-budget.md` に反しない。

`agent_type` が registry にあるだけでは実行許可にならない。許可される行動は、autonomy level、execution mode、Activation Record、human gate、budget、詳細 contract の交差で決まる。

## Common Read Order

すべての agent は、必要な範囲で次を読む。

1. `LOOP.md`
2. `loop-constraints.md`
3. `loop-human-gates.md`
4. `loop-budget.md`
5. `STATE.md`
6. `loop-run-log.md`
7. `docs/loop-agent-registry.md`
8. `docs/loop-agent-behavior-contracts.md`
9. `docs/ai-work-ticket-contract.md`
10. `docs/ai-work-ticket-spreadsheet-schema.md`
11. 対象 AI Work Ticket row
12. 関連 Kiro spec / requirements / design / tasks
13. 対象 agent group の `docs/loop-agent-contracts/*.md`

L2 / L3 の実装 agent は、追加で `docs/loop-autonomy-contract.md`, `docs/loop-execution-contract.md`, `.codex/agents/implementer.toml`, `.codex/agents/verifier.toml` を読む。

専用 `.codex/agents/*.toml` が存在する agent は、自分自身の `.toml` も追加で読む。

CodeCommit action agent は、追加で `docs/codecommit-pr-contract.md` と対象の `.codex/agents/codecommit_*_agent.toml` を読む。

## Detailed Contract Index

Agent は summary table ではなく、次の詳細 contract を正として実行する。

| Agent group | Detailed contract |
| --- | --- |
| Planning Agents | `docs/loop-agent-contracts/planning.md` |
| General Coding Agents | `docs/loop-agent-contracts/general-coding.md` |
| Realtime Question Coach Domain Coding Agents | `docs/loop-agent-contracts/domain-coding.md` |
| Data, Batch, And Integration Agents | `docs/loop-agent-contracts/data-batch-integration.md` |
| Test And Quality Agents | `docs/loop-agent-contracts/test-quality.md` |
| Review, Coordination, And Verification Agents | `docs/loop-agent-contracts/review-verification.md` |
| Repository Action Agents | `docs/loop-agent-contracts/repository-action.md` |

詳細 contract が読めない場合、agent は実行せず Orchestrator Agent へ `blocked_by_missing_agent_contract` を返す。

高リスク agent は summary table だけで実行してはならない。少なくとも次は詳細 contract または専用 `.toml` を読むまで停止する。

- `jquery_behavior_agent`
- `money_calculation_agent`
- `pdf_report_agent`
- `daily_lock_agent`
- `kpi_management_agent`
- `bugyo_accounting_agent`
- `db_schema_agent`
- `data_migration_script_agent`
- `external_api_agent`
- `aws_infra_agent`
- `auth_permission_agent`
- `human_gate_review_agent`
- `adversarial_review_agent`
- `pr_package_agent`

## Common Output Format

各 agent は、実行結果を次の構造で Orchestrator Agent に返す。

```yaml
agent_result:
  agent_type:
  autonomy_level: L1 | L2 | L3
  execution_mode: read_only | report_only | implementation | verification | repo_action
  ticket_id:
  summary:
  actions_taken:
    - 
  files_read:
    - 
  files_changed:
    - 
  spreadsheet_updates:
    - column:
      value:
      reason:
  findings:
    - severity: info | low | medium | high
      category:
      detail:
      evidence:
  human_gate:
    required: true | false
    reason:
  constraints:
    deny_list_touched: true | false
    notes:
  checks:
    run:
      - 
    not_run:
      - check:
        reason:
  recommended_next_action:
  handoff_notes:
```

L1 agent は `files_changed` を空にする。ただし許可済みの Spreadsheet Human Communication / L1 Proposed Updates、`STATE.md`, `loop-run-log.md` への記録案は `spreadsheet_updates` または `handoff_notes` に残してよい。

## Common Prohibitions

すべての agent は次を行わない。

- secret、credential、private key、token を読む、表示する、編集する。
- production data、production console、production deploy に触れる。
- `git reset --hard`, `git checkout --`, force push、履歴改変を行う。
- test を green にする目的で削除、skip、disable、弱体化する。
- scope 外の refactor を行う。
- merge、deploy、release、close、approve を自律実行する。
- human gate が未承認のまま gate 対象の mutation を行う。
- L1 で code、branch、canonical ticket fields、external issue、PR、CodeCommit、config、DB、外部サービスを変更する。

## Planning Agents

| agent_type | Reads | Does | Does not | Output |
| --- | --- | --- | --- | --- |
| `kiro_requirements_agent` | AI Work Ticket, source summary, unknowns, acceptance criteria, related specs | requirements に分解する。曖昧な目的、scope、acceptance criteria を質問化する。L1 では requirements 案だけ作る | design / tasks / implementation を確定しない。人間承認なしに spec phase を完了扱いしない | requirements draft, questions_for_human, missing decisions |
| `kiro_design_agent` | approved requirements, affected areas, architecture notes, existing code evidence | data flow、responsibility boundary、UI / API / DB / test design を整理する | requirements 未承認のまま design を確定しない。実装しない | design draft, risk notes, human gate candidates |
| `kiro_tasks_agent` | approved requirements and design | implementation tasks に分解する。agent assignment と test task を提案する | tasks 未承認のまま implementation に進めない | task list, suggested agent_plan, verification plan |
| `agent_planner_agent` | registry, behavior contracts, ticket scope, affected areas, risk, required checks | `agent_plan` を作る。primary / supporting / review / coordination agent を選ぶ | 実装しない。agent plan なしで coding agent を起動しない | agent_plan, why_this_agent_plan, human_gate_review_need |
| `scope_guard_agent` | scope_in, scope_out, non_goals, acceptance criteria, diff or proposed plan | scope creep の有無を判定する。scope 不足を Ticket Builder / Human へ戻す | scope を勝手に広げない。仕様判断を代行しない | scope finding, allowed_scope, blocked_scope, escalation reason |

## General Coding Agents

| agent_type | Reads | Does | Does not | Output |
| --- | --- | --- | --- | --- |
| `general_implementer_agent` | ticket, Kiro tasks, local patterns, tests | 低リスクで専門性の低い変更を最小差分で実装する | domain gate 対象を専門 agent なしで進めない | diff summary, checks, handoff to verifier |
| `rails_controller_agent` | routes, controller, before_action, params, specs, auth policy | controller action、params handling、redirect / render、strong parameters を実装する | route 変更、auth boundary 変更を無承認で行わない | changed controllers, request behavior summary, controller spec evidence |
| `rails_model_agent` | model, associations, validations, callbacks, factories, model specs | model validation、association、domain method を実装する | DB schema、money、daily lock、reservation rule を無承認で変更しない | model behavior summary, model spec evidence |
| `rails_service_agent` | service object, callers, specs, error handling | service object / use case logic を実装する | external API mutation、PDF、money、{{ACCOUNTING_SYSTEM}} を無承認で変更しない | service flow summary, check evidence |
| `rails_helper_agent` | helpers, decorators, view usage, specs | 表示補助、formatting、decorator 的処理を実装する | 法的 / {{ACCOUNTING_DOMAIN}}的意味を持つ表示変更を無承認で行わない | display logic summary, affected views |
| `grape_api_agent` | `app/api/**`, serializers, auth, request specs | API endpoint / serializer / response shape を実装する | API contract、auth、external exposure を無承認で変更しない | API change summary, compatibility notes |
| `rails_job_agent` | jobs, enqueue callers, retries, side effects, specs | background job の処理を実装する | production state、external side effects、schedule を無承認で変更しない | job behavior summary, retry / idempotency notes |
| `mailer_notification_agent` | mailers, notifications, templates, delivery triggers | mail / notification content and trigger を実装する | 個人情報、送信先、送信条件を無承認で変えない | delivery impact summary, sample output notes |
| `uploader_storage_agent` | uploaders, attachments, validators, file handling | upload validation、file metadata、storage integration を実装する | unsafe file acceptance、secret exposure、retention policy 変更をしない | file handling summary, security notes |
| `view_slim_agent` | Slim views, partials, helpers, forms, related JS | view / form / partial / UI copy を実装する | jQuery behavior、money/PDF/legal copy を無承認で変えない | affected screens, copy/UI summary, manual check notes |
| `jquery_behavior_agent` | JS files, selectors, events, DOM dependencies, related views | jQuery event、selector、Ajax、shared UI state を実装する | human gate 未承認で複雑 JS 挙動を変更しない | JS behavior map, compatibility risk, test/manual check |
| `stimulus_js_agent` | Stimulus controllers, packs, related views | Stimulus controller / frontend helper を実装する | shared state や legacy jQuery 連携を無視しない | controller behavior summary, interaction notes |
| `frontend_asset_agent` | CSS/SCSS, images, asset pipeline, target views | style、layout、asset reference を変更する | UI behavior、business meaning、PDF output を変えない | visual impact summary, before/after check notes |
| `form_validation_agent` | forms, model validations, controller params, JS validation | server/client validation、error display を整える | validation を弱めない。保存可能条件を無承認で変えない | validation matrix, error behavior, test evidence |
| `route_agent` | `config/routes.rb`, controller, auth, namespace | 明示承認された新規 route 追加だけを行う | 既存 route の変更、mount、namespace、auth exposure を無承認で変えない | route diff, target controller, security review notes |
| `i18n_copy_agent` | locales, views, target UI context | text / locale / label を変更する | config 全般や meaning-changing copy を無承認で変えない | copy change summary, meaning impact assessment |
| `docs_agent` | docs, specs, runbooks | docs / markdown / spec note を更新する | code behavior を変えない。policy を勝手に変えない | docs diff summary, readers affected |

## Realtime Question Coach Domain Coding Agents

| agent_type | Reads | Does | Does not | Output |
| --- | --- | --- | --- | --- |
| `reservation_domain_agent` | event, room, reservation models/services/controllers/specs | {{RESERVATION_DOMAIN}}、{{ROOM_DOMAIN}}、日程、仮押さえ、確定、{{CANCEL_DOMAIN}} logic を扱う | availability、確定条件、締め後変更を無承認で変えない | reservation impact matrix, human gate evidence |
| `estimate_billing_agent` | estimate, bill, receipt, statement, payment code/specs | {{ESTIMATE_DOMAIN}}、{{BILLING_DOMAIN}}、{{RECEIPT_DOMAIN}}、明細、支払い処理を扱う | {{MONEY_DOMAIN}}や{{ACCOUNTING_DOMAIN}}意味を無承認で変更しない | billing flow summary, money/PDF gate notes |
| `money_calculation_agent` | price, tax, rounding, discount, total, specs | {{MONEY_DOMAIN}}計算、{{TAX_DOMAIN}}、丸め、割引、合計を扱う | text-only 変更を計算変更と混ぜない。計算式を無承認で変更しない | calculation before/after, test cases, residual risk |
| `pdf_report_agent` | PDF services, TLF templates, {{PDF_TEMPLATE_ENGINE}} config, PDF specs | PDF / {{REPORT_DOCUMENT_DOMAIN}}の生成、表示、出力項目を扱う | 文字変更だけなら計算 / 法的 / {{ACCOUNTING_DOMAIN}}意味に影響しないことを確認せず進めない | PDF impact summary, sample/check evidence |
| `daily_lock_agent` | daily lock controllers/models/specs, lock flags | {{DAILY_LOCK_DOMAIN}}、lock / unlock、締め後変更制御を扱う | lock bypass、締め済みデータ変更を無承認で行わない | lock state impact, strict human gate result |
| `kpi_management_agent` | management_* areas, reports, aggregations, specs | KPI、management、集計、経営指標を扱う | KPI 定義や集計条件を無承認で変えない | KPI impact summary, aggregation check evidence |
| `bugyo_accounting_agent` | {{ACCOUNTING_SYSTEM}}Customer, journals, accounting master, export/import | {{ACCOUNTING_SYSTEM}}、{{ACCOUNTING_DOMAIN}} master、customer code、{{JOURNAL_DOMAIN}}を扱う | accounting master / journal meaning を無承認で変更しない | accounting impact, data mapping evidence |
| `master_data_agent` | master tables, type models, price masters, settings | master data / type / price / system setting を扱う | seed / production master を無承認で変更しない | master impact summary, migration/import plan |
| `auth_permission_agent` | roles, policies, before_action, admin access, user specs | 権限、role、認可境界を扱う | privilege expansion を無承認で行わない | permission matrix, negative test evidence |
| `customer_data_agent` | customer, customer_staff, PII fields, controllers/specs | {{CUSTOMER_DOMAIN}}、担当者、個人情報の処理を扱う | PII exposure、削除、外部送信を無承認で行わない | privacy impact, access control evidence |

## Data, Batch, And Integration Agents

| agent_type | Reads | Does | Does not | Output |
| --- | --- | --- | --- | --- |
| `db_schema_agent` | migrations, schema, models, DB constraints | migration、index、foreign key、schema 変更を扱う | human gate 未承認で DB 変更しない。rollback 不能な変更を隠さない | migration plan, rollback notes, data risk |
| `data_migration_script_agent` | scripts, target data shape, dry-run evidence | one-off script、backfill、data repair を設計 / 実装する | production data を直接変更しない。dry-run なしで実行しない | dry-run plan, affected rows estimate, rollback notes |
| `script_processing_agent` | target script, callers, CLI args, env assumptions, side effects, dry-run/test evidence | 汎用 script、運用補助 script、local automation、safe execution path を設計 / 実装する。入力 validation、dry-run、idempotency、logging、rollback notes を整理する | production data、external state、DB mutation、data repair、backfill、credentials、schedule、deploy を扱わない。該当時は専門 agent に handoff する。dry-run 不能な script を安全扱いしない | script behavior summary, command plan, dry-run/test evidence, side-effect map, rollback/abort notes, handoff target when needed |
| `seed_master_agent` | seeds, CSV master, template files | seed / master import を扱う | production master 変更を無承認で行わない | seed/import summary, validation evidence |
| `csv_import_agent` | CSV samples, parser, encoding, import specs | CSV import、parser、bulk create を扱う | encoding / validation を曖昧にしない。bad rows を無視しない | import validation matrix, error handling notes |
| `excel_export_agent` | Excel export scripts, raw data mapping, specs | Excel / raw data export を扱う | accounting / privacy fields を無承認で増減しない | export column mapping, sample verification |
| `batch_rake_agent` | rake tasks, batch, schedule, side effects | task / batch / scheduled job を扱う | schedule、external state、production operation を無承認で変えない | batch behavior, idempotency and failure notes |
| `external_api_agent` | API clients, connectors, credentials handling, specs | 外部 API integration の内部処理を扱う | credentials を読まない。外部状態 mutation を無承認で行わない | API contract notes, mock/stub check evidence |
| `aws_infra_agent` | AWS config, EB, Docker, infra docs | infra / AWS / Docker の設計または限定変更を扱う | deploy、production、credential、network mutation を無承認で行わない | infra impact, command plan, human approval need |
| `dependency_agent` | Gemfile, package files, lockfiles, advisories | dependency update plan / limited update を扱う | lockfile churn を無視しない。major/security update を無承認で進めない | dependency risk, grouping, test plan |
| `config_agent` | config files, initializers, environment files | config 変更案を整理する。承認済み限定変更を行う | config は原則 deny。route 追加以外を無承認で編集しない | config impact, human gate decision |

## Test And Quality Agents

| agent_type | Reads | Does | Does not | Output |
| --- | --- | --- | --- | --- |
| `controller_test_agent` | controller changes, routes, params, auth | controller spec を追加 / 更新する | assertion を弱めない。auth negative case を省略しない | controller test evidence |
| `model_test_agent` | model changes, validations, factories | model spec / factory を追加 / 更新する | validation bypass を許さない。factory だけで green にしない | model test evidence |
| `service_test_agent` | service changes, inputs/outputs, stubs | service spec を追加 / 更新する | external API 実呼び出しをしない。重要 branch を未検証にしない | service test matrix |
| `view_test_agent` | views, helpers, rendered output | view spec / helper spec を追加 / 更新する | business meaning のある表示変更を snapshot 的に流さない | view check evidence |
| `system_test_agent` | UI flow, JS behavior, permissions | system/browser flow の検証を追加 / 設計する | brittle selector だけに依存しない。human gate 対象 JS を隠さない | system check plan/results |
| `qa_agent` | acceptance criteria, required checks, test evidence, residual risk | 試験計画と証跡妥当性を確認し、coverage gap と not_run 妥当性を判定する | 未実行試験を passed 扱いしない。自己判定だけで完了にしない | `qa_agent_result` with traceability and verdict |
| `tester_agent` | target behavior, runnable app/API, Playwright/API/manual steps | 実際に試験を実行し、command、環境、fixture、pass/fail/not_run、artifactを記録する | クリックだけで内部挙動確認済みにしない。失敗を隠さない | `tester_agent_result` with commands and artifacts |
| `task_test_agent` | rake tasks, scripts, batch inputs | task/script spec または dry-run check を作る | destructive task を実行しない。本番データ前提にしない | task test / dry-run evidence |
| `regression_test_agent` | related specs, changed behavior, risk areas | 退行確認範囲を選び、必要な checks を実行 / 提案する | unrelated full-suite failure を隠さない | regression summary |
| `manual_verification_agent` | acceptance criteria, UI/PDF/manual-only flows | 手動確認手順を作る。L1 では手順案だけ作る | 自動 test の代わりに曖昧な「見た」だけで済ませない | manual checklist, evidence requirement |

## Review, Coordination, And Verification Agents

| agent_type | Reads | Does | Does not | Output |
| --- | --- | --- | --- | --- |
| `adversarial_review_agent` | ticket, scope, diff, tests, constraints | scope creep、仕様漏れ、危険変更を探す | 修正しない。好意的に解釈して見逃さない | findings with severity and evidence |
| `security_review_agent` | auth, permissions, PII, upload, external API, diff | security / privacy risk を確認する | 実装しない。secret を読まない | security findings, required fixes |
| `human_gate_review_agent` | `loop-human-gates.md`, diff/proposed plan, risk | human gate 要否を機能影響で判定する | path だけで機械判定しない。迷う場合に許可側へ倒さない | gate required/ not_required with reason |
| `performance_review_agent` | query, batch, export, aggregation, logs/specs | N+1、重い query、batch performance risk を見る | evidence なしに性能安全と断定しない | performance findings, measurement plan |
| `compatibility_review_agent` | JS, views, CSS, vendor assets, browser flows | legacy jQuery / UI / browser compatibility を見る | visual-only と behavior change を混同しない | compatibility findings, manual/system check needs |
| `behavior_contract_review_agent` | registry, behavior contracts, runtime `.toml`, loop contracts, target agent plan | agent type の存在、責務境界、read order、mutation 条件、L1/L2/L3 差分、output、stop condition の整合性を確認する | 実装、修正、branch 作成、ticket canonical update をしない。曖昧な契約を安全扱いしない | `APPROVE` / `REJECT` / `ESCALATE_HUMAN`, contract findings, required contract fixes |
| `purple_coordination_agent` | coding result, review findings, constraints, attempts | 再実装、human escalation、Kiro 戻しを整理する | 自分で scope を広げない。原則 code edit しない | coordination decision, next owner |
| `verifier` | final diff, checks, agent outputs, constraints | 最終判定を返す。L1 では report-only finding を返す | 実装修正、merge、approve、deploy、close をしない | `APPROVE` / `REJECT` / `ESCALATE_HUMAN` or L1 finding |

## Repository Action Agents

| agent_type | Reads | Does | Does not | Output |
| --- | --- | --- | --- | --- |
| `codecommit_pr_agent` | CodeCommit contract, verifier result, PR package, Activation Record | L3 明示許可時に CodeCommit PR 作成 command を扱う | merge、approve、ready 化、close をしない。L2 では command 実行しない | PR id/url or command draft |
| `codecommit_comment_agent` | reviewer comment permission, PR metadata, findings | L3 明示許可時に reviewer comment を投稿する | approve、resolve、merge、status change をしない | posted comment id or comment draft |
| `changelog_agent` | commits, PR package, ticket summary | changelog / release note draft を作る | release、tag、deploy をしない | changelog draft, release risk notes |
| `pr_package_agent` | diff, checks, verifier output, ticket | PR title / description / evidence package を作る | PR command を L2 で実行しない。merge 判断をしない | PR package, known risk, reviewer notes |

## Handoff Rules

Agent 間の handoff は次を含む。

```yaml
handoff:
  from_agent:
  to_agent:
  ticket_id:
  reason:
  scope:
  evidence:
  remaining_questions:
  blocked_by:
  allowed_next_actions:
```

coding agent から review / verifier へ渡す場合は、diff summary、changed files、checks、human gate analysis、known risk を必ず含める。

review agent から coding agent へ戻す場合は、修正が scope 内か、human gate か、Kiro / Ticket Builder に戻すべきかを明記する。

## Completion Gate Handoff

実装を `done` に進める handoff には、次を必ず含める。

```yaml
completion_gate_handoff:
  ticket_id:
  red_team_review:
    agent_type: adversarial_review_agent
    verdict: APPROVE | REJECT | ESCALATE_HUMAN
    evidence:
  qa_agent_result:
    status: passed | failed
    traceability_matrix:
    evidence:
  tester_agent_result:
    status: passed | failed
    commands:
    environment:
    artifacts:
    not_run:
  purple_coordination:
    required: true | false
    decision:
    evidence:
  verifier_verdict:
    verdict: APPROVE | REJECT | ESCALATE_HUMAN
    evidence:
```

この handoff が欠ける場合、Orchestrator Agent は `done` ではなく `under_verification`、`ready_for_implementation`、`human_gate_pending`、または `blocked_by_constraints` のいずれかに戻す。

## Stop Conditions

各 agent は次の場合に停止し、Orchestrator Agent へ返す。

- `loop-pause-all` がある。
- L2 / L3、または `execution_mode` が `implementation`, `verification`, `repo_action` なのに Activation Record がない、期限切れ、または最新の人間指示と矛盾する。
- L1 read-only / report-only agent なのに、`agent_plan` がない、対象 ticket / docs が特定できない、または mutation が必要である。
- human gate が必要だが未承認である。
- deny list に触れる必要がある。
- scope 外作業が必要である。
- required docs または target ticket row が読めない。
- test failure / verifier rejection が `max_fix_attempts` を超えた。
