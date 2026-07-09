# Loop Engineering TODO

このファイルは、Realtime Question Coach リポジトリで Loop Engineering を運用するために必要なファイル群、現在の整備状況、次に作るべきものをまとめる。

## Current Status

- 現在の運用対象は Daily Orchestration Loop。
- 実行頻度は 1日1回。
- 最大許可自律度は L3。scheduled daily-triage は L1 report-only。
- active scaffold 済みの Loop Pattern は `daily-triage` のみ。
- Orchestrator Agent は `docs/pattern-picker.md` を読み、起動する Loop Pattern を判断する。
- AI Work Ticket 一覧は外部 issue / repository issue ではなく、1ページのスプレッドシートで管理する。
- AI Work Ticket spreadsheet source は `https://docs.google.com/spreadsheets/d/1y7UEjCTejSJXgLWmvA0SEKOHurl8C5QvtfxMf87ruqc/edit`。
- Google Sheets connector の Editor 権限は確認済み。2026-07-03 時点で metadata / header read と `triage_notes` column への write-and-clear test が成功している。
- Realtime Question Coach の実運用 ticket に対する Loop 実行はまだ行っていない。過去の First Loop manual test は scaffold / demo 文脈の実績として扱う。
- Editor 権限は技術的な接続権限であり、Loop が自由に書き込む許可ではない。L1 では Human Communication columns と L1 Proposed Updates columns だけを更新対象にする。canonical status や ticket 本体は更新しない。
- 本PJでは最大L3まで許可済み。ただし実装、branch 作成、PR 作成、canonical status 更新、ticket 本体更新は、対象 AI Work Ticket ごとの Activation Record がある場合だけ許可する。PR 作成 command は L3 かつ `codecommit_pr_creation_allowed: true` の場合だけ、`codecommit_pr_agent` が `docs/codecommit-pr-contract.md` に従って実行できる。
- `pr-babysitter`, `ci-sweeper`, `dependency-sweeper`, `post-merge-cleanup` は scaffold 済みだが、必要な repository / dependency / CI / post-merge evidence access、budget、human approval が揃うまで直接起動しない。
- `changelog-drafter` は Pattern document 作成済みだが、専用 skill / state / connector が未整備のため直接起動しない。

## File Existence And Readiness

ここでの `Exists` は「スキャフォルディングまたは手動作成でファイルが存在する」という意味であり、`Ready` とは分けて扱う。`Ready: yes` のファイルは、現時点の情報をもとに Loop が読める状態まで整形済みである。

### Root Loop Files

| File | Exists | Ready | Current state |
|------|--------|-------|---------------|
| `LOOP.md` | yes | yes | Loop Engineering 全体の運用方針、Orchestrator Agent、AI Work Ticket、Pattern Decision、自律度、human gate、Kiro 連携を整理済み |
| `STATE.md` | yes | yes | セッションをまたぐ Loop 状態ログとして整形済み。Realtime Question Coach の実運用 ticket は未実行、Phase 0 完了、最大L3許可済みとして更新済み |
| `loop-constraints.md` | yes | yes | Realtime Question Coach 固有の deny list、禁止操作、L1-L3 制限へ更新済み。human gate 詳細は `loop-human-gates.md` に分離済み |
| `loop-human-gates.md` | yes | yes | L2 / L3 実装前後に読み返す human gate 正本として作成済み。機能影響ベース、厳格 gate、例外、fallback を定義済み |
| `loop-budget.md` | yes | yes | Realtime Question Coach 向けに更新済み。1日1回、L1 report-only、read-only / report-only sub-agent 上限、未検証外部 command は人間承認扱い |
| `loop-run-log.md` | yes | yes | Realtime Question Coach 向けに更新済み。daily-triage L1 と L2 / L3 execution_run の証跡を記録できる形式 |

### Decision Documents

| File | Exists | Ready | Current state |
|------|--------|-------|---------------|
| `docs/pattern-picker.md` | yes | yes | daily-triage Pattern 詳細 doc、loop-triage skill、budget / run-log と照合済み。Pattern 選択責務に限定されている |
| `docs/loop-system-flow.md` | yes | yes | Loop Engineering 全体の入口、Pattern 選択、daily-triage L1、L2 / L3 activation_required、safety gate、read / write boundary を図示済み |
| `docs/loop-autonomy-contract.md` | yes | yes | L0-L3 の権限境界、L2 / L3 Activation Record、status 遷移、Spreadsheet 更新権限、失効条件を定義済み |
| `docs/loop-execution-contract.md` | yes | yes | L2 / L3 実行時の read order、branch、実装、verification、CodeCommit PR、run-log、abort 条件を定義済み |
| `docs/loop-agent-registry.md` | yes | yes | L1-L3 で起動できる planning / coding / domain / data / review / verification / repo action agent profile、選択基準、agent plan、Spreadsheet 連携を定義済み |
| `docs/loop-agent-behavior-contracts.md` | yes | yes | 共通ルール、共通 output、agent summary、詳細 contract index を定義済み。summary table だけでは実行しない方針に変更済み |
| `docs/loop-agent-contracts/planning.md` | yes | yes | Planning Agents の phase state、必須入力、手順、停止条件、output schema、human handoff を定義済み |
| `docs/loop-agent-contracts/general-coding.md` | yes | yes | General Coding Agents の preflight、agent別注意点、停止条件、verifier handoff schema を定義済み |
| `docs/loop-agent-contracts/domain-coding.md` | yes | yes | Realtime Question Coach Domain Coding Agents の domain invariant、impact matrix、human gate、agent別高リスク手順を定義済み |
| `docs/loop-agent-contracts/data-batch-integration.md` | yes | yes | Data / Batch / Integration Agents の dry-run、affected rows、rollback、idempotency、環境・credential 禁止、handoff を定義済み |
| `docs/loop-agent-contracts/test-quality.md` | yes | yes | Test / Quality Agents の risk-based selection、test evidence schema、manual verification artifact を定義済み |
| `docs/loop-agent-contracts/review-verification.md` | yes | yes | Review / Verification Agents の severity rubric、verdict ルール、review handoff、agent別観点を定義済み |
| `docs/loop-agent-contracts/repository-action.md` | yes | yes | Repository Action Agents の PR package schema、changelog draft schema、CodeCommit action handoff を定義済み |
| `docs/codecommit-pr-contract.md` | yes | yes | CodeCommit PR 作成経路、repository / region / AWS profile、draft-equivalent、PR title / description、reviewer comment 条件を定義済み |
| `docs/ai-work-ticket-contract.md` | yes | yes | AI Work Ticket の必須 field、agent_alignment、AI comment、status、pending / no_action_required、差し戻し形式、human management 理由、L1 proposed update 運用を定義済み |
| `docs/ticket-builder-intake.md` | yes | yes | Human-origin input を AI-readable な AI Work Ticket に変換する責務、後続 agent の認識ズレ防止、人間向け AI comment、差し戻し、pending / no-action、Kiro handoff を定義済み |
| `docs/ai-work-ticket-spreadsheet-schema.md` | yes | yes | AI Work Ticket spreadsheet の列定義、dropdown、更新権限、L1 proposed column、L2 / L3 execution columns 運用を定義済み |
| `docs/patterns/daily-triage.md` | yes | yes | daily-triage Pattern の起動条件、構造検査、cc-sdd / Kiro 判断、status 更新案、L1 report-only output を定義済み |
| `docs/patterns/pr-babysitter.md` | yes | yes | PR の review comment、conflict、approval、merge readiness、human gate、handoff、state 更新形式を定義済み。現時点では inactive |
| `docs/patterns/ci-sweeper.md` | yes | yes | CI failure の原因分類、risk、human gate、handoff、state 更新形式を定義済み。現時点では inactive |
| `docs/patterns/dependency-sweeper.md` | yes | yes | dependency update、security alert、lockfile churn、dependency noise、human gate、handoff、state 更新形式を定義済み。現時点では inactive |
| `docs/patterns/post-merge-cleanup.md` | yes | yes | merge 後 follow-up、不要 branch 候補、残作業、技術的負債、human gate、handoff、state 更新形式を定義済み。現時点では inactive |
| `docs/patterns/changelog-drafter.md` | yes | yes | release note、変更履歴、changelog draft、release range、変更分類、human gate、handoff、L1 output を定義済み。runtime skill / state は未整備 |
| `docs/loop-engineering-todo.md` | yes | draft | 現在状況と TODO の管理用。本ファイル自体も運用に合わせて更新する |

### Codex Runtime Files

| File | Exists | Ready | Current state |
|------|--------|-------|---------------|
| `.codex/skills/loop-constraints/SKILL.md` | yes | yes | `loop-constraints.md` と `loop-human-gates.md` を開始時に読む guardrail skill として更新済み |
| `.codex/skills/loop-budget/SKILL.md` | yes | yes | root の `loop-budget.md` / `loop-run-log.md` と整合済み。L1 report-only、read-only / report-only sub-agent 上限、外部 cost command は人間承認扱い |
| `.codex/skills/loop-triage/SKILL.md` | yes | yes | current design に合わせて更新済み。daily-triage Pattern、AI Work Ticket Contract、Spreadsheet Schema、Ticket Builder / Intake を読む L1 report-only skill として整備済み |
| `.codex/skills/loop-execute/SKILL.md` | yes | yes | L2 / L3 Activation Record がある AI Work Ticket の実装、branch、test、verifier handoff、CodeCommit PR / reviewer comment 条件を扱う execution skill として作成済み |
| `.codex/agents/implementer.toml` | yes | yes | L2 / L3 Activation Record と `docs/loop-agent-registry.md` の agent profile に基づき、承認 scope 内だけ実装する agent runtime として作成済み。merge / deploy / secrets / scope expansion は禁止 |
| `.codex/agents/script_processing_agent.toml` | yes | yes | 汎用 script、運用補助 script、local automation、dry-run / idempotency / side-effect / rollback 分析に特化した agent として作成済み |
| `.codex/agents/behavior_contract_review_agent.toml` | yes | yes | agent registry / behavior contract / runtime `.toml` の整合性を確認する read-only review agent として作成済み |
| `.codex/agents/codecommit_pr_agent.toml` | yes | yes | L3 repo_action 承認時のみ CodeCommit PR 作成 command を扱う repository action agent として作成済み |
| `.codex/agents/codecommit_comment_agent.toml` | yes | yes | L3 repo_action 承認時のみ CodeCommit reviewer comment command を扱う repository action agent として作成済み |
| `.codex/skills/pr-babysitter/SKILL.md` | yes | yes | pr-babysitter Pattern に合わせて作成済み。PR 状態分類、human gate、handoff、state 更新を L1 report-only で扱う |
| `loop-state/pr-babysitter.md` | yes | yes | pr-babysitter の last run、active PRs、watch list、review follow-up、blocked、merge ready candidates、handoff queue を保持する state file として作成済み |
| `.codex/skills/ci-sweeper/SKILL.md` | yes | yes | ci-sweeper Pattern に合わせて作成済み。CI failure 分類、human gate、handoff、state 更新を L1 report-only で扱う |
| `loop-state/ci-sweeper.md` | yes | yes | ci-sweeper の last run、active failures、watch list、known flaky、blocked、handoff queue を保持する state file として作成済み |
| `.codex/skills/dependency-sweeper/SKILL.md` | yes | yes | dependency-sweeper Pattern に合わせて作成済み。dependency 分類、noise group、human gate、handoff、state 更新を L1 report-only で扱う |
| `loop-state/dependency-sweeper.md` | yes | yes | dependency-sweeper の last run、active dependency items、watch list、noise groups、security / major / runtime watch、blocked、handoff queue を保持する state file として作成済み |
| `.codex/skills/post-merge-cleanup/SKILL.md` | yes | yes | post-merge-cleanup Pattern に合わせて作成済み。cleanup 分類、技術的負債、human gate、handoff、state 更新を L1 report-only で扱う |
| `loop-state/post-merge-cleanup.md` | yes | yes | post-merge-cleanup の last run、active cleanup items、watch list、cleanup groups、debt register、blocked、handoff queue を保持する state file として作成済み |
| `.codex/agents/verifier.toml` | yes | yes | Realtime Question Coach 固有の scope、test、risk、deny list、jQuery、KPI / management、config / route、外部連携、{{ACCOUNTING_SYSTEM}} / accounting master、DB、PDF、{{MONEY_DOMAIN}}処理、CodeCommit reviewer comment draft / handoff 条件を追加済み |

## Scaffold Placeholders Found

- root の `loop-budget.md` と `loop-run-log.md` の `YOUR_PROJECT` placeholder は解消済み。
- `.codex/skills/loop-budget/SKILL.md` は root file と整合済み。

## Missing Files And TODO

### Phase 1: L1 Daily Triage を安定させる

- [x] `docs/ai-work-ticket-contract.md` を作成する。
  - AI Work Ticket の必須 field を定義する。
  - daily-triage と coding agent の認識ズレを防ぐ `agent_alignment` block を定義する。
  - 人間へ伝える `ai_comment` と L1 の `proposed_ticket_comments` 運用を定義する。
  - `status` 一覧を定義する。
  - `pending` と `no_action_required` を区別し、再確認対象と対応不要を分ける。
  - 構造不足時にどこへ差し戻すかを定義する。
  - `needs_human_management` の理由文フォーマットを定義する。
  - L1 report-only では canonical status を直接書き戻さず、Human Communication columns と L1 Proposed Updates columns、および `loop-run-log.md` に記録する方針を定義する。
- [x] `docs/ticket-builder-intake.md` を作成する。
  - scaffold 由来のファイルではない。会話の設計上、Ticket Builder / Intake 層を明文化するために追加予定の document。
  - Human-origin input を AI-readable な AI Work Ticket に変換する責務を定義する。
  - raw human request を AI が読むチケット一覧に混ぜないルールを定義する。
  - daily-triage と coding agent が同じ intent、scope、non-goals、完了条件を読めるようにする。
  - human-facing message と agent-facing payload を分け、チケットに AI comment を残す運用を定義する。
  - Ticket Builder へ差し戻す条件を定義する。
  - Intake clarification の質問を `decision_needed` / `field_to_complete` / `blocking_level` 付きの構造化形式で定義する。
  - `pending` / `no_action_required`、Intake clarification、Kiro handoff の扱いを定義する。
- [x] `docs/ai-work-ticket-spreadsheet-schema.md` を作成する。
  - AI Work Ticket 一覧は外部 issue / repository issue ではなくスプレッドシートで管理することを正として定義する。
  - 1ページ運用の列、dropdown、必須列、AI 更新列、人間確認列を定義する。
  - 外部 issue、PR、repository service 上の情報は source / evidence として扱い、AI Work Ticket の正本一覧として扱わないことを明記する。
- [x] `docs/patterns/daily-triage.md` を作成する。
  - `daily-triage` Pattern 内で行う処理を詳細化する。
  - AI Work Ticket の棚卸し、構造検査、status 更新、Kiro 呼び出し判断、実装 agent 振り分け判断を定義する。
- [x] `.codex/skills/loop-triage/SKILL.md` を current design に合わせて更新する。
  - AI Work Ticket Contract を読むことを追加する。
  - Pattern Picker ではなく `daily-triage` 側で status 更新を扱うことを明記する。
  - L1 では `STATE.md` と `loop-run-log.md` の更新までに制限する。

### Phase 2: First Loop を実行できる状態にする

- [x] `STATE.md` の初期内容を Realtime Question Coach 向けに更新する。
  - セッションをまたぐ Loop 状態ログとして整形済み。
  - 現在作業中の TODO や readiness 表は持たせず、Loop 実行結果だけを追記する方針に変更済み。
  - inactive / 未 scaffold Pattern、draft agent / skill、既存 noise のような Loop が次回参照すべき永続情報だけを残した。
- [x] `loop-constraints.md` を Realtime Question Coach 向けに更新する。
  - scaffold default の英語ルールを見直し済み。
  - DB schema、認可、{{RESERVATION_DOMAIN}}、{{BILLING_DOMAIN}}、{{REPORT_DOCUMENT_DOMAIN}}、{{DAILY_LOCK_DOMAIN}}、production deploy、secrets などの human gate 条件を具体化済み。
  - 外部 API service / connector file と `config/**` の自律編集禁止を追加済み。
  - {{MONEY_DOMAIN}}変更と PDF 表示変更は、path 単位ではなく機能影響で判定する方針へ調整済み。
  - `loop-pause-all` の確認方法と停止条件を明記済み。
- [x] `loop-run-log.md` の project placeholder を Realtime Question Coach 向けに更新する。
  - `YOUR_PROJECT` を Realtime Question Coach に合わせる。
  - first loop の実行結果を追記できる状態にする。
- [x] `loop-budget.md` の project placeholder を Realtime Question Coach 向けに更新する。
  - Daily Triage の上限が現在の運用に合っているか確認する。
  - L1 では read-only / report-only sub-agent だけを budget 内で許可する。
  - 未検証の外部 command を運用手順に残すか、人間承認つき手順にするかを決める。
- [x] `docs/pattern-picker.md` を関連 doc 作成後に再確認する。
  - AI Work Ticket Contract、Ticket Builder / Intake は作成済み。
  - daily-triage Pattern の詳細 doc は作成済み。
  - Pattern 選択責務と daily-triage 実行責務が矛盾しないか確認する。
- [x] First Loop を `daily-triage`, `report_only`, `L1` で実行する。
  - AI Work Ticket spreadsheet の URL は決定済み。
  - Google Sheets connector Editor access は確認済み。
  - Human Communication columns と L1 Proposed Updates columns の write-back が成功済み。
  - 実装や branch 作成には進まない。
  - 成果物は `STATE.md` と `loop-run-log.md` の更新、未整備 Pattern の棚卸しに限定した。
  - Run ID: `2026-07-03T17:09:39+09:00-daily-triage-l1-test`

### Phase 3: Pattern ごとの scaffold を追加する

- [x] `docs/patterns/ci-sweeper.md` を作成する。
  - CI failure の原因調査、再現、log 読み取り、human gate 条件を定義する。
- [x] `.codex/skills/ci-sweeper/SKILL.md` を作成する。
- [x] `loop-state/ci-sweeper.md` または同等の CI state file を作成する。
- [x] `docs/patterns/pr-babysitter.md` を作成する。
  - review comment、conflict、approval、merge readiness の監視を定義する。
  - CI failure の原因調査は `ci-sweeper` に委譲する。
- [x] `.codex/skills/pr-babysitter/SKILL.md` を作成する。
- [x] `loop-state/pr-babysitter.md` または同等の PR state file を作成する。
- [x] `docs/patterns/dependency-sweeper.md` を作成する。
  - dependency update、security alert、lockfile change、dependency noise の判断基準を定義する。
- [x] `.codex/skills/dependency-sweeper/SKILL.md` を作成する。
- [x] `loop-state/dependency-sweeper.md` または同等の dependency state file を作成する。
- [x] `docs/patterns/post-merge-cleanup.md` を作成する。
  - merge 後 follow-up、不要 branch、残作業、技術的負債の棚卸しを定義する。
- [x] `.codex/skills/post-merge-cleanup/SKILL.md` を作成する。
- [x] `loop-state/post-merge-cleanup.md` または同等の post-merge state file を作成する。
- [x] `docs/patterns/changelog-drafter.md` を作成する。
  - release note、変更履歴、changelog draft の対象範囲を定義する。

### Phase 4: L2 へ進む前の gate

- [ ] AI Work Ticket Contract が安定している。
- [ ] Ticket Builder / Intake の差し戻し先と理由フォーマットが明確である。
- [x] `daily-triage` が L1 で `STATE.md` と `loop-run-log.md` を正しく更新できる形式になっている。
  - Realtime Question Coach の実運用 ticket では未実行。過去の manual test は scaffold / demo 文脈の検証実績として扱う。
- [x] `loop-constraints.md` の deny list と human gate 条件が Realtime Question Coach のリスク領域に合っている。
- [x] `docs/loop-autonomy-contract.md` を作成する。
  - 本PJでは最大L3まで許可済みだが、L2 / L3 実行には ticket ごとの Activation Record が必要であることを定義する。
  - L2 / L3 の許可操作、禁止操作、Spreadsheet 更新範囲、失効条件を定義する。
- [x] `docs/loop-execution-contract.md` を作成する。
  - L2 / L3 の read order、branch 作成、実装、verification、CodeCommit PR、run-log、abort 条件を定義する。
- [x] `docs/loop-agent-registry.md` を作成する。
  - L1-L3 で立てる planning、coding、domain coding、data ops、review、coordination、verification、repository action agent profile を定義する。
  - `implementation_agent_type` に使う canonical agent_type と selection matrix を定義する。
  - Activation Record の agent plan を定義し、汎用 `implementer.toml` がどの profile として動くかを明確にする。
- [x] `docs/loop-agent-contracts/*.md` を作成する。
  - summary table だけでは sub-agent の実行定義として不十分なため、agent group ごとの詳細 contract を追加する。
  - 起動条件、必須入力、実行手順、判断ルール、停止条件、output schema、handoff、human escalation 条件を定義する。
  - `implementer.toml` と `loop-execute` skill に、詳細 contract が読めない場合は停止する rule を追加する。
- [x] `script_processing_agent` を追加する。
  - data backfill 特化ではない汎用 script / operational helper / local automation の責務、dry-run、idempotency、side-effect、rollback 条件を定義する。
- [x] `behavior_contract_review_agent` を追加する。
  - agent 定義書が sub-agent の振る舞いを正しく縛れるか確認する read-only reviewer として定義する。
- [x] `.codex/agents/implementer.toml` を作成する。
  - L2 / L3 Activation Record に基づき、承認 scope 内だけ実装する実行 agent を定義する。
  - branch 作成、編集範囲、test、Spreadsheet 更新、verifier handoff、CodeCommit PR / reviewer comment 条件を定義する。
- [x] `.codex/skills/loop-execute/SKILL.md` を作成する。
  - L2 / L3 実行時に読むファイル、branch 作成条件、編集範囲、deny list / human gate、abort 条件、test、verifier handoff、Spreadsheet 更新、run-log 記録を定義する。
- [x] Spreadsheet Execution Columns を追加する。
  - `approved_autonomy`, `approved_by`, `approved_at`, `approval_scope`, `approval_expires_at`, `branch_name`, `base_branch`, `commit_sha`, `pr_id`, `pr_url`, `implementation_started_at`, `implementation_completed_at`, `verifier_verdict`, `verifier_notes`, `human_gate_status`, `merge_approval_status` などを schema と実 Sheet に追加する。
- [x] L2 / L3 Run Log Template を補強する。
  - activation、branch、commit、implementation timestamps、pre/post human gate、checks、verifier verdict、spreadsheet updates、CodeCommit PR、reviewer comment、merge approval status を記録する。
- [x] `loop-human-gates.md` または同等の human gate 分岐ファイルを作成する。
  - `loop-constraints.md` から human gate 判定条件を分離する。
  - 実装開始前と終了前に Orchestrator / 実装 agent が読み直す運用を定義する。
  - daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master、DB / infrastructure は厳格な gate として維持する。
- [x] `docs/codecommit-pr-contract.md` を作成する。
  - CodeCommit PR 作成経路、repository name、region、base / source branch、AWS profile / credential 扱い、PR title / description、draft-equivalent 方針を定義する。
  - L3 での `aws codecommit create-pull-request` と reviewer comment command 実行条件を定義する。
- [x] verifier agent が scope、test、risk、deny list を検査できる。
  - Realtime Question Coach 固有の jQuery、KPI / management、config / route、外部連携、{{ACCOUNTING_SYSTEM}} / accounting master、DB、PDF、{{MONEY_DOMAIN}}処理の確認条件を追加済み。
- [x] L2 で branch 作成や実装 agent 起動を許可する条件が `LOOP.md` に明記されている。
  - 詳細条件は `docs/loop-autonomy-contract.md` と `docs/loop-execution-contract.md` を正とする。

## Recommended Next Order

1. 環境構築作成用の AI Work Ticket を作成する。
2. `RQC-0001` Next.jsアプリ基盤作成 ticket を具体化する。
3. `daily-triage` を L1 report-only で通し、構造不足を確認する。
4. Activation Record が揃った ticket から L2 / L3 on-demand 実行に進む。

## Current Realtime Question Coach Loop State

```yaml
current_loop_state:
  last_run_id: none_for_realtime_question_coach_tickets
  first_loop_status: not_started
  selected_pattern: daily-triage
  startup_mode: report_only
  autonomy_level: L1
  max_approved_autonomy: L3
  primary_result: "Phase 0 complete; environment setup tickets pending"
  next_action:
    - RQC-0001 environment setup ticket を作成する
    - RQC-0002 routing / layout ticket を作成する
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
  next_entrypoint: "create environment setup tickets"
  missing_prerequisites: []
```

この状態は、現在 active scaffold 済み Pattern が `daily-triage` であり、scheduled run は L1 report-only、on-demand 実行は最大L3まで許可済みという前提に基づく。

## Notes

- Pattern Picker は Pattern 選択の責務だけを持つ。
- AI Work Ticket の schema / status / 差し戻し文面は `daily-triage` と Ticket Builder / Intake 側で定義する。
- Kiro は Loop Pattern ではなく、`daily-triage` から呼び出される仕様精緻化 tool として扱う。
- 自動 merge は行わない。merge は人間の明示承認後のみ。
