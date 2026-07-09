# Realtime Question Coach MVP Build Prompt

作成日: 2026-07-08

このファイルは、Realtime Question Coach のMVPを「あとは環境変数設定とデプロイだけ」の状態まで実装させるための、実装エージェント向け親プロンプトである。

MVP実装においては、このファイルを現行のProjectGoalとして扱う。既存の `ProjectGoal.md` は過去の目標や背景を確認するための参照資料であり、最新のプロダクト判断はこのファイルと最新の人間指示を優先する。

ただし、このファイルは L2 / L3 実装を許可する Activation Record ではない。コード変更、branch作成、PR準備、repository action を行うには、対象 AI Work Ticket と `docs/loop-autonomy-contract.md` に従う Activation Record が別途必要である。この文書だけを根拠に raw human request を直接実装してはいけない。

以下をそのまま実装エージェントに渡す。

---

## Prompt

あなたは Realtime Question Coach のMVPを実装する、シニアソフトウェアエンジニア兼実装オーケストレーターです。

いきなり実装を始めてはいけません。まず、このアプリケーションが何を解決するためのものかを理解してください。

Realtime Question Coach は、会議、商談、採用面接、要件定義、ユーザーインタビュー中に、リアルタイム文字起こしと少数のAI補助カードを表示し、利用者が重要な質問や確認論点を聞き漏らさないようにするWebアプリケーションです。

主目的は、会議後の議事録作成ではありません。会話中に「今聞くべきこと」「曖昧なまま流れそうなこと」「あとで回収すべきこと」を利用者へ短く提示し、会話品質を上げることです。

AIは音声で会話に割り込みません。右ペインに表示される質問カードを、利用者が必要に応じて会話へ取り込む設計です。

## 最初に行う理解確認

この節は、必読資料の代替ではありません。

目的は、全資料を読んだあとに、実装エージェントが「何を作るアプリなのか」を取り違えていないか確認するための基準です。各資料を読む前にこの短い基準だけで実装してはいけません。必ず後述の「必ず読む資料」を読んだうえで、この基準と矛盾しないことを確認してください。

この基準に対して矛盾がある場合は、次のどちらかとして扱ってください。

- 資料の古い記述または補助的な記述であり、最新指示とこのファイルを優先する。
- 最新指示とも矛盾しており、人間判断が必要なblockerとして停止する。

作業開始時に、必ず次を内部的に確認してから実装へ進んでください。

```text
Application Understanding Check:
  product:
    - Realtime Question Coach is a real-time meeting/question support tool.
    - It is not primarily a meeting-minutes generator.
    - Its core value is reducing missed questions during live conversation.
  primary_flow:
    - Login
    - Session Setup
    - Realtime transcript + AI coach cards
    - Session Report
    - discard / local save / export
  core_constraints:
    - AI cards must not overwhelm the user.
    - Active AI cards are limited to 3.
    - Conversation text, audio, AI cards, LLM inputs, LLM outputs, and report body are not persisted to server DB.
    - Google OAuth login through Supabase Auth is expected.
    - Real STT/LLM providers must be replaceable through adapter boundaries.
```

この理解と矛盾する資料や実装状況がある場合は、推測で進めず、矛盾点を整理して停止してください。

### この理解確認と制約リストの使い方

`Application Understanding Check`、`core_constraints`、`optional_user_explicit_storage`、`prohibited_server_storage` は、実装前に資料読了を省略するためのショートカットではありません。

これらは、次の判断に使う基準です。

- 実装方針がRealtime Question Coachの目的からズレていないか。
- 画面動線が `Login -> Session Setup -> Realtime Session -> Session Report` から外れていないか。
- AIカードが出すぎる実装になっていないか。
- 会話データをサーバーDBへ保存する設計に寄っていないか。
- provider未確定部分をUIや業務ロジックに直結していないか。
- ある作業単位を完了としてよいか。
- 停止条件に該当するか。

`optional_user_explicit_storage` は、ユーザーが明示的に保存やexportを選んだ場合だけ許可される保存先です。通常のセッション進行中はbrowser memoryを基本にしてください。

`prohibited_server_storage` は、サーバーDBやサーバーログへ保存してはいけないデータです。LLM/STT providerへ処理目的で一時送信することとは区別してください。送信する場合も、必要最小限、HTTPS/WSS、no body log、env secret保護を前提にします。

## 技術前提

技術前提は次の通りです。既存の `package.json` やフレームワーク設定がある場合は、既存構成を優先し、矛盾があれば理由を記録してください。

```yaml
runtime:
  language:
    - TypeScript
  package_manager:
    - existing lockfile if present
    - otherwise npm

frontend:
  framework:
    - Next.js
    - React
  ui:
    - responsive Web UI
    - PC browser first
    - iPad/tablet usable

server_boundary:
  purpose:
    - hide LLM/STT/Auth secrets from browser
    - validate authenticated API requests
    - issue short-lived STT tokens when real STT is enabled
    - proxy LLM calls when real LLM is enabled
  runtime:
    - Next.js Route Handlers or API routes only when server-side secret handling is needed
  hosting_target:
    - Vercel
  non_goal:
    - no separate custom backend service
    - no server DB for conversation data

auth:
  provider:
    - Supabase Auth
  login_method:
    - Google OAuth
  auth_db:
    - Supabase Postgres
    - auth/profile/role metadata only

stt:
  default_local_provider:
    - mock
  real_provider_boundary:
    - adapter interface required
  candidate_provider_categories:
    - OpenAI transcription/realtime speech-to-text
    - Deepgram
    - Google Cloud Speech-to-Text
    - Azure Speech
    - other cloud STT providers

llm:
  default_provider:
    - mock
  real_provider_candidates:
    - OpenAI
    - Anthropic Claude
  api_style:
    - provider adapter
    - OpenAI Responses API when OpenAI is selected
    - Anthropic Messages API when Anthropic is selected
  openai_realtime_card_model_example:
    - gpt-5.4-mini
  openai_report_model_example:
    - gpt-5.4
  model_rule:
    - model names must be configurable by env
    - model replacement must not require UI/business logic rewrites

storage:
  primary_session_storage:
    - browser memory
  optional_user_explicit_storage:
    - IndexedDB
    - Markdown export
    - JSON export
  prohibited_server_storage:
    - audio
    - transcript body
    - AI card body
    - LLM input
    - LLM output
    - session report body

design:
  reference:
    - https://github.com/voltagent/awesome-design-md
  required_artifact:
    - DESIGN.md or equivalent design rules in the project
```

OpenAIモデル名は、OpenAIを選択した場合の例です。Anthropic Claudeを選択する場合はAnthropic側の利用可能model名を `LLM_MODEL_REALTIME` / `LLM_MODEL_REPORT` に設定してください。実装では必ず環境変数で差し替え可能にし、モデルが利用不可の場合は明確な設定エラーにしてください。

この文書で `server_boundary` と書く場合、業務ロジック用の大きなバックエンドや会話データ保存用DBを意味しません。現機能をmockとブラウザ内処理だけで確認する範囲では、フロントエンド中心で成立します。一方で、Google OAuthのsession検証、LLM API key、STT API key、短命token発行を安全に扱うには、ブラウザへsecretを出さない最小のserver boundaryが必要です。そのため、MVPでは「必要なときだけNext.js Route Handler/API routeを持つ」方針にします。

## 最終ゴール

Realtime Question Coach MVPを、ローカルで動作確認でき、必要な環境変数を設定すればデプロイ直前まで進められる状態にしてください。

デプロイそのもの、production操作、secretの作成、secretの閲覧、secretの投入、mergeは行いません。

```yaml
final_goal:
  application:
    name:
      - Realtime Question Coach MVP
    purpose:
      - live conversation support
      - reduce missed questions
      - show transcript and limited AI coach cards

  must_work_locally:
    auth:
      - Google OAuth via Supabase Auth when env is configured
      - explicit dev/mock auth only for local development when Supabase env is absent
    setup:
      - Session Setup collects conversationType, industry, objective, audioSource, and consent
      - Session Setup resolves a predefined knowledgeSet from conversationType and industry
      - Session Setup creates sessionProfile in browser memory with sessionId, conversationType, industry, objective, knowledgeSetId, mustCheckItems, importantTermRuleIds, ambiguousExpressionRuleIds, audioSource, language, consentChecked, and createdAtMs
      - Session Setup does not require counterpart role
    realtime_session:
      - dummy transcript can run without external STT credentials
      - transcript supports partial and final states
      - final transcript feeds local rule gate and AI card generation
    ai_cards:
      - active cards are limited to 3
      - higher priority cards can replace lower priority cards
      - pinned cards are protected from automatic demotion
    report:
      - Session Report can be generated from in-memory session state
      - Markdown export works
      - JSON export works

  provider_readiness:
    auth:
      - Supabase Auth Google OAuth adapter/config boundary
    stt:
      - mock STT adapter
      - real STT adapter interface
      - no browser exposure of server STT secrets
    llm:
      - mock LLM adapter
      - OpenAI adapter as the initial real-provider candidate
      - Anthropic Claude adapter compatibility through the same internal schema
      - model env configuration
      - schema validation for all LLM responses

  security:
    - no server DB persistence for conversation data
    - no plaintext HTTP for auth/audio/transcript/LLM payloads
    - no secrets in client bundle
    - no transcript/LLM body in logs

  quality:
    - lint passes
    - typecheck passes
    - tests pass
    - production build passes
    - README explains setup, env, mock mode, and deploy readiness
```

## 必ず読む資料

作業開始前に、次の資料を読んでください。各資料が何の判断材料になるかを理解してから実装してください。

| ファイル | 読む目的 | 実装で使う判断 |
| --- | --- | --- |
| `Project.md` | プロジェクトの背景、プロダクト像、初期構想を把握する | アプリの目的や価値判断が不明なときの補助資料 |
| `ProjectGoal.md` | 過去または上位の目標、完了イメージ、優先度を把握する | 参考資料として読む。MVP実装の現行ProjectGoalはこの `docs/mvp-build-agent-prompt.md` と最新人間指示 |
| `AI_BOOTSTRAP_CONTEXT.md` | AIエージェントが作業開始時に持つべき前提を把握する | 初期コンテキスト、制約、過去の合意 |
| `docs/business-requirements-definition.md` | 業務目的、対象利用シーン、MVP範囲を把握する | 何を実現すべきか、何をMVP外にするか |
| `docs/system-requirements-definition.md` | 画面、API、データ、状態管理、セキュリティ要件を把握する | 実装判断の主資料 |
| `cloud-stt-ai-system-flows.md` | STT/AI連携の処理フローを把握する | 音声、文字起こし、LLM呼び出しの責務分離 |
| `realtime-question-coach-mvp-mock.html` | 既存モックのUI体験と画面遷移を把握する | Session Setupから文字起こし画面への動線、画面密度、操作感 |
| `TODO.md` | フェーズ、チケット候補、作業分解方針を把握する | 実装単位と進捗管理 |
| `LOOP.md` | Loop運用、チケット処理、自律実行の全体像を把握する | エージェント実行時の報告粒度と安全運用 |
| `STATE.md` | 現在のプロジェクト状態、決定事項、残課題を把握する | 既存の合意や未決事項の確認 |
| `loop-constraints.md` | してよいこと、禁止事項、安全制約を把握する | 実装中の停止判断、禁止操作の回避 |
| `loop-human-gates.md` | 人間承認が必要な操作を把握する | L3でも実行してはいけない操作の判定 |
| `docs/ai-work-ticket-spreadsheet-schema.md` | AI作業チケットの項目、状態、記録方法を把握する | チケット化や作業記録の形式 |
| `docs/loop-autonomy-contract.md` | 自律度L0からL3の意味と境界を把握する | どこまで自律的に進めてよいか |
| `docs/loop-execution-contract.md` | L2/L3実行時の手順、検証、報告方法を把握する | 実装、検証、報告、停止条件 |
| `README.md` | 既存の起動方法やプロジェクト説明を把握する | README更新時の整合性 |

資料間で矛盾がある場合は、プロダクト要件判断とLoop実行安全制約を分けて扱ってください。

プロダクト要件判断の優先順位:

1. 最新の人間指示
2. この `docs/mvp-build-agent-prompt.md`
3. `docs/system-requirements-definition.md`
4. `docs/business-requirements-definition.md`
5. `TODO.md`
6. その他の補助資料

Loop実行安全制約の優先順位:

1. `loop-constraints.md`
2. `loop-human-gates.md`
3. `docs/loop-autonomy-contract.md`
4. `docs/loop-execution-contract.md`
5. `docs/codecommit-pr-contract.md`
6. 対象 AI Work Ticket / Activation Record

deny list、human gate、budget、secret、production、deploy、merge、server DB保存禁止、破壊的git操作の制約は、プロダクト要件より優先してください。人間指示があっても、deny listに該当する操作は自律実行しません。

## 自律度の説明

このプロジェクトでは、AIエージェントの自律度をL0からL3で扱います。自律度とは、AIが人間確認なしでどこまで判断、実装、検証、外部操作できるかを示す運用上の許可レベルです。

| レベル | 意味 | できること | できないこと |
| --- | --- | --- | --- |
| L0 | 読み取りと提案のみ | 資料確認、設計案、差分案、質問整理 | ファイル変更、外部状態変更 |
| L1 | レポートのみ | チケット整理、調査、実行計画、手動反映用コメント作成 | コード変更、PR作成、外部状態変更 |
| L2 | 限定実装 | 承認済みチケット範囲のコード変更、ローカル検証、README更新 | scope拡大、merge、deploy、secret操作 |
| L3 | 実装オーケストレーション | 承認済みscope内での実装分解、必要修正、検証、PR準備、許可済みrepository action | 自動merge、production deploy、release、secretの作成/閲覧/投入、承認外実装、会話データのサーバー保存 |

本PJでは最大L3まで許可されています。ただし、L3は「何でも自由にやってよい」許可ではありません。

L3で許可されるのは、対象AI Work TicketのActivation Recordで承認されたscope内の実装、検証、`max_fix_attempts` 内の必要修正、PR作成準備、明示許可済みrepository actionまでです。

この文書自体はActivation Recordではありません。L2/L3で実装を開始するには、対象AI Work Ticketごとに `approved_level`、`approval_scope`、`agent_plan`、`allowed_actions`、`branch_name`、`base_branch`、`max_fix_attempts`、`expires_at`、`human_gate_status` が必要です。

CodeCommit PR作成やreviewer comment投稿は、実装agentやverifierが実行してはいけません。`codecommit_pr_creation_allowed: true` または `codecommit_reviewer_comment_allowed: true` があり、かつ `agent_plan.execution_mode = repo_action` と専用 `codecommit_pr_agent` / `codecommit_comment_agent` が明示された場合だけ実行できます。条件が不足する場合は、PR packageまたはreviewer comment draftまでにしてください。

次は禁止です。

- 自動merge
- production deploy
- release
- production操作
- secretの閲覧
- secretの生成
- secretの投入
- `.env` 実値の作成
- API keyの表示
- 承認範囲外の追加実装
- `git reset --hard`, `git checkout --`, force push, 共有履歴を変えるrebase
- 会話データのサーバーDB保存
- 音声ファイルの自社クラウド保存
- ログへの会話本文出力
- 平文HTTPでの認証情報、音声、文字起こし、LLM入力、LLM応答の送信

## 実装までのおおまかなフロー

ゴールへ直接コーディングを始めず、次の順序で進めてください。

```text
1. Read and reconcile documents
   -> 必読資料を読み、このファイルを現行ProjectGoalとして扱う。

2. Restate application understanding
   -> 何を作るか、何を作らないか、保存してはいけないものを確認する。

3. Define implementation slices
   -> 画面、状態管理、カード制御、AI/STT境界、認証、テストに分ける。

4. Create AI Work Tickets and Activation Plan
   -> raw requestをAI Work Ticketへ変換する。
   -> scope_in, scope_out, non_goals, acceptance_criteria, required_checks, evidenceを定義する。
   -> human_gate_required, human_gate_status, risk_levelを判定する。
   -> AI Work Ticketが存在しない場合は、実装停止ではなくTicket Builder Stageを先に実行する。
   -> Ticket Builder Stageでは3体のreview agentでチケットをレビューし、OKならAI Work Ticket spreadsheetへ起票する。チケット起票に人間の追加許可は不要。
   -> L2/L3の場合はActivation Recordの有無と有効期限を確認する。
   -> 条件不足なら ticket_builder_required / human_gate_pending / needs_human_management / blocked_by_constraints のいずれかで停止する。

5. Assign sub-agents or internal roles
   -> 利用可能な場合はサブエージェントを立てる。
   -> 利用できない場合でも、同じ観点で自己レビューする。

6. Build mock-first vertical slice
   -> Login/dev auth
   -> Session Setup
   -> dummy transcript
   -> card engine
   -> report/export

7. Add provider boundaries
   -> Supabase Auth boundary
   -> STT adapter
   -> LLM adapter
   -> env validation

8. Harden security and storage
   -> no server conversation storage
   -> no body logs
   -> no secrets in client bundle

9. Verify with automated and browser tests
   -> unit
   -> integration/API
   -> Playwright E2E
   -> build

10. Prepare deploy-readiness only
   -> README
   -> .env.example
   -> known limitations
   -> no deploy, no production operations, no secret creation
```

Implementation Entry Gate:

- raw request を AI Work Ticket に変換済みである。AI Work Ticketが未作成なら、実装前にTicket Builder Stageで作成、3 review agent確認、起票まで行う。
- `scope_in`, `scope_out`, `non_goals`, `acceptance_criteria`, `required_checks`, `evidence` が明確である。
- `human_gate_required` と `human_gate_status` が判定済みである。
- L2/L3 の場合、Activation Record に `approved_level`, `approval_scope`, `agent_plan`, `allowed_actions`, `explicitly_forbidden_actions`, `branch_name`, `base_branch`, `max_fix_attempts`, `expires_at` がある。
- 実装前に `loop-constraints.md`, `loop-human-gates.md`, `loop-budget.md`, `docs/loop-autonomy-contract.md`, `docs/loop-execution-contract.md` を確認している。
- 条件不足なら実装せず、`ticket_builder_required`, `human_gate_pending`, `needs_human_management`, `blocked_by_constraints` のいずれかで停止する。

Ticket Builder Stage:

- `docs/mvp-build-agent-prompt.md` のW01-W20を1作業単位1チケットに変換する。
- チケットIDは既存IDと衝突しない安定IDにする。新規投入時は `RQC-W01` から `RQC-W20` を推奨する。
- `docs/ai-work-ticket-spreadsheet-schema.md` の必須列を埋める。
- `status` は初期値 `ready_for_triage` とする。実装承認済みではないチケットを `in_progress` や `done` にしない。
- `allowed_autonomy` は本PJ上限の `L3` を記載してよいが、実装開始にはチケット単位のActivation Recordが必要であることを `loop_policy` と `handoff_notes` に明記する。
- `risk_level` が `medium` または `high` の場合は、原則として `human_gate_required = true` にする。`human_gate_required = false` にするなら、risk_levelも `low` と説明できるscopeへ絞る。
- `.env.example` はsecret実値を含まないplaceholder documentationとしてのみ扱う。`.env` やproduction settingsを読んで作らない。
- 3体のreview agentを立てる。
  - Requirements Ticket Reviewer: ProjectGoal、最新人間指示、scope_in/out、non_goals、acceptance criteriaを確認する。
  - Implementation Readiness Reviewer: task分解、依存関係、required checks、implementation_agent_typeを確認する。
  - Risk And Verification Reviewer: human gate、deny list、保存禁止、ログ禁止、security、verification evidenceを確認する。
- 3体すべてが `APPROVE` または `APPROVE_WITH_MINOR_NOTES` なら、AI Work Ticket spreadsheetへ起票する。
- `REJECT` がある場合は修正して再レビューする。再修正後も `REJECT` が残る場合だけ `ticket_builder_required` として停止する。
- チケット起票では `approved_autonomy`, `approved_by`, `approved_at`, `approval_scope`, `approval_expires_at`, `branch_name`, `commit_sha`, `pr_url`, `done_criteria_met` などの実装承認・実行・完了列を捏造しない。

## サブエージェント構成

実装環境にサブエージェント機能がある場合は、次の役割を立てて指揮してください。サブエージェント機能がない場合でも、メインエージェントは役割、入力、出力、判断を分離し、各ロールの証跡を `loop-run-log.md` または `verification_evidence` に残してください。

サブエージェント名は説明用ロールであり、Loop上で実行する場合は `docs/loop-agent-registry.md` の canonical `agent_type` と `agent_plan` に写像してください。Red Team / QA Agent / Tester Agent / Purple Team は、MVP完了判定では必須ゲートです。

| 運用ロール | Loop mapping候補 | 目的 | 主な成果物 | 完了条件 |
| --- | --- | --- | --- | --- |
| Requirements Auditor | `scope_guard_agent`, `agent_planner_agent`, `kiro_requirements_agent` | 要件、必読資料、最新指示、AI Work Ticket readinessの確認 | 要件差分メモ、scope_in/out、unknowns、human_gate判定案 | 実装前にblocker、優先順位、ticket_builder_required要否が明確 |
| UX/UI Agent | `general_implementer_agent`, `frontend_asset_agent`, `system_test_agent` | 画面動線、Session Setup、Realtime Session、Report UI | UI components、responsive layout、Playwright specs | Playwrightで主要画面が確認済み |
| Domain Logic Agent | `general_implementer_agent`, `form_validation_agent`, `service_test_agent` | sessionProfile、knowledgeSet、card engine、state machine | schemas、domain logic、unit tests | card制御と状態遷移のunit testが通る |
| AI/STT Adapter Agent | `general_implementer_agent`, `service_test_agent`, `security_review_agent` | dummy transcript、STT adapter、LLM adapter、schema validation | mock/real adapter境界、API schemas | mockで動き、real provider差し替え点が明確 |
| Auth/Security Agent | `auth_permission_agent`, `security_review_agent` | Google OAuth via Supabase、role、API guard、ログ制御 | auth boundary、permission guards、redacted logger tests | guest/user/owner権限とsecret非露出が検証済み |
| QA Agent | `qa_agent`, `regression_test_agent` | acceptance criteria、required checks、negative case、証跡妥当性を確認 | QA traceability matrix、not_run review、coverage gap | QA result が `passed` |
| Tester Agent | `tester_agent`, `system_test_agent`, `manual_verification_agent` | unit、API、Playwright、responsive、音声権限、export/discardを実際に試験 | 実行command、test file、fixture、browser/viewport、trace/screenshot | Tester result が `passed` |
| Docs/Readiness Agent | `docs_agent`, `manual_verification_agent` | README、env、deploy前確認、既知制限 | README、`.env.example`、runbook | secretなしでローカル確認手順が再現可能 |
| Red Team Review | `adversarial_review_agent`, `security_review_agent`, `human_gate_review_agent` | scope creep、危険変更、security、human gate、弱い試験、完了主張を批評 | findings、reject/concern、修正提案 | verdict が `APPROVE` |
| Purple Coordination | `purple_coordination_agent` | Red/Blue/Verifierの差分を整理し、再実装か停止か判断 | 統合判断、next_owner、human escalation案 | 完了/blocked/human_gateの判断が分離されている |

サブエージェントを使う場合でも、最終責任はメイン実装エージェントが持ちます。ただし、メイン実装エージェントは Red Team、QA Agent、Tester Agent、Verifier の合格を捏造してはいけません。各サブエージェントの出力は、受入基準と停止条件に照らして統合してください。

L2/L3で実装を行う場合、上記ロールは必ずActivation Recordの `agent_plan` に落とし込んでください。`implementation_agent_type` にはprimary implementation agentだけを書き、review / verification / repo_action agentを混ぜないでください。

## アプリケーション全体フロー

システムフローは次の通りです。

```text
Unauthenticated user
  -> Login screen
  -> Google OAuth via Supabase Auth
  -> Authenticated app shell
  -> Session Setup
  -> collect conversationType, industry, objective, audioSource, consent
  -> validate setup inputs
  -> resolve predefined knowledgeSet from conversationType and industry
  -> create sessionProfile in browser memory
  -> request audio permission or choose dummy transcript
  -> Realtime Session
      -> transcript partial/final updates
      -> final transcript enters conversation buffer
      -> speaker is provider-derived or unknown; do not guess beyond evidence
      -> knowledgeSet rules detect important terms and ambiguous expressions
      -> local rule gate decides whether LLM should be called
      -> /api/coach returns candidate cards
      -> card engine validates, scores, dedupes, and limits active cards to 3
  -> End Session
  -> Session Report
      -> report generated from in-memory session state
      -> optional /api/report call through LLM adapter
      -> export Markdown / JSON
      -> discard or optional local save
```

各画面は、何をするための画面か、何ができたら次へ進めるかを明確に実装してください。

## 画面要件

### 1. Login

目的:

- 未ログインユーザーを認証し、認証済みユーザーだけがセッションを開始できる状態にする。
- MVPでは Google OAuth を Supabase Auth 経由で使用する。
- 独自APIでメールアドレス/パスワードを受け取らない。

できること:

- `Googleでログイン` を押せる。
- Supabase envが設定されている場合、Supabase Auth Google OAuthへ遷移できる。
- ローカル開発でSupabase envがない場合のみ、明示的に `DEV_AUTH_ENABLED=true` のmock/dev authで入れる。
- ログイン失敗、env不足、OAuth未設定を区別して表示できる。

次へ進める条件:

- Supabase sessionが取得できている。
- または、ローカル開発でdev/mock authが明示的に有効である。
- user profileのroleが `user` または `owner` として解決できている。

禁止:

- passwordを自前APIで受け取る。
- Supabase service role keyをブラウザへ出す。
- 未ログイン状態で `/api/coach`, `/api/report`, `/api/stt-token` を利用可能にする。

### 2. Session Setup

目的:

- 会話開始前に、AIが何を重要論点として見るべきかを設定する画面。
- ここで作る `sessionProfile` が、文字起こしの解釈、AIカード生成、レポート作成の前提になる。
- Session Setupを理解しないまま実装すると、AIカードが一般論になりやすいため、必ず入力値をAI処理へ接続する。

Session Setupでユーザーから収集する業務データ:

- 会話タイプ
  - 商談
  - 要件定義
  - 採用
  - ユーザー調査
- 業界
- 今回の目的

Session Setupでユーザーから収集する制御データ:

- 音声ソース
  - マイク
  - Webタブ音声
  - システム音声
  - ダミー文字起こし
- 文字起こし言語
  - 初期値 `ja-JP`
- 録音/文字起こし/AI処理に関する同意確認

Session Setupでシステムが内部生成するデータ:

- `sessionId`
- `knowledgeSetId`
- `knowledgeSetVersion`
- `mustCheckItems`
- `importantTermRules`
- `ambiguousExpressionRules`
- `localRuleGateConfig`
- `createdAtMs`

データ収集手順:

1. 会話タイプを選択する。
2. 業界を選択または入力する。
3. 今回の目的を1から3文で入力する。
4. 音声ソースを選択する。
5. 録音/文字起こし/AI処理に関する同意を確認する。
6. `conversationType + industry` から事前定義済み `knowledgeSet` を解決する。
7. `knowledgeSet` と今回の目的から `mustCheckItems`、重要語条件、曖昧表現条件を生成する。
8. 生成結果を `sessionProfile` としてbrowser memoryに保持する。
9. `セッション開始` でRealtime Sessionへ遷移する。

できること:

- 必須項目を入力できる。
- 入力された会話タイプ、業界、目的から `knowledgeSet` を解決できる。
- `knowledgeSet` から `mustCheckItems`、重要語条件、曖昧表現条件を作れる。
- 音声ソースを選択できる。
- ブラウザが許可する場合、マイク音声を取得できる。
- ブラウザが許可する場合、`getDisplayMedia` 等でWebタブ音声またはシステム音声を選択できる。
- ブラウザ/OSが非対応の場合、理由を表示してダミー文字起こしへfallbackできる。

次へ進める条件:

- 会話タイプ、業界、今回の目的、音声ソース、同意確認がvalidationを通る。
- `knowledgeSet` が解決できる。
- `mustCheckItems`、重要語条件、曖昧表現条件が空ではない。
- `sessionProfile` が作成される。
- 音声ソースが `dummy` の場合は、外部STT credentialなしで開始できる。
- 音声ソースが実音声の場合は、ブラウザ権限が許可されるか、明確にfallbackが選べる。

禁止:

- Session Setupと文字起こし画面を同時表示のまま開始状態にする。
- 相手役職をSession Setupの入力項目に含めない。
- ユーザーに `playbook` という内部用語を直接選ばせない。
- `mustCheckItems` を生成するだけでAI処理へ渡さない。
- 権限エラーを握りつぶす。

### 2.1 Knowledge Set

この文書で `knowledgeSet` と呼ぶものは、会話タイプと業界に応じて事前に用意しておく質問支援ナレッジです。過去文書で `playbook` と呼んでいたものは、MVPでは `knowledgeSet` の内部実装名または互換名として扱います。

ユーザーが `playbook` を直接選ぶUIにはしないでください。ユーザーは会話タイプ、業界、今回の目的を入力し、システムが適切な `knowledgeSet` を解決します。

`knowledgeSet` に含めるもの:

- 会話タイプ
- 業界
- 代表的な確認論点
- `mustCheckItems` の初期候補
- 重要語条件
- 曖昧表現条件
- Local Rule Gateの初期閾値
- LLMへ渡す短いsystem/context instructions
- ダミー文字起こしfixtureへの参照

最低限用意する `knowledgeSet`:

| conversationType | 初期対象 | 含めるべき論点例 |
| --- | --- | --- |
| `sales` | 商談 | 課題、影響範囲、予算、決裁者、導入時期、現行運用、成功条件 |
| `requirements` | 要件定義 | 目的、対象ユーザー、必須要件、例外、権限、運用制約、優先度 |
| `recruiting` | 採用 | 実績、本人の役割、転職理由、チーム経験、期待条件、意思決定軸 |
| `user-research` | ユーザー調査 | 行動背景、困りごと、頻度、代替手段、意思決定理由 |

実装上の期待:

- `src/lib/knowledge/` などに静的データとして定義する。
- `conversationType + industry` で解決できる。
- 業界別ナレッジがない場合は、会話タイプの汎用 `knowledgeSet` にfallbackする。
- fallbackしたことをUIまたはdebug stateで確認できる。
- `knowledgeSet` はLLMへ丸投げする長文ではなく、短いルールと確認論点として扱う。

### 3. Realtime Session

目的:

- 会話中に、左ペインで文字起こし、右ペインでAI補助カードを表示する。
- 利用者が会話に集中しながら、聞き漏れそうな論点だけを拾える状態にする。

文字起こし機能に期待すること:

- partial transcriptを即時表示し、会話が拾えていることを利用者へ示す。
- final transcriptを安定した発話単位として確定し、AIカード生成の対象にする。
- partialのみでLLMを呼ばない。
- final segmentには、id、timestamp、text、source、confidence相当のメタデータを持たせる。
- ダミー文字起こしでも、partialからfinalへ変わる挙動を再現する。
- 実STT接続時の精度を後回しにしてよい、という意味ではない。MVPではmockで体験を検証できるが、real adapterは精度評価やprovider差し替えができる境界を持つこと。

できること:

- transcriptを時系列に表示できる。
- partial/finalの見た目が区別できる。
- 音声ソース状態を表示できる。
- active/queued/doneなどAIカード数を表示できる。
- `聞いた`, `あとで`, `不要`, `固定`, `再判定` を操作できる。
- `設定へ戻る` でSession Setupへ戻れる。
- `終了` でSession Reportへ遷移できる。

次へ進める条件:

- `終了` が押される。
- セッション中のin-memory stateからレポート作成に必要な情報が組み立てられる。

禁止:

- active AIカードを4件以上表示する。
- partial transcriptだけでカード生成を連発する。
- 会話本文をサーバーログへ出す。
- 文字起こし本文をサーバーDBへ保存する。

### 3.1 Realtime SessionからAIカードまでのシステムフロー

Realtime Sessionでは、次の処理順序を実装してください。

```text
1. Transcript Source
   -> dummy STT or real STT adapter emits partial/final transcript segments.

2. Transcript Normalizer
   -> text trim
   -> timestamp付与
   -> source付与
   -> speaker情報があれば付与
   -> partial/finalを区別

3. Conversation Buffer
   -> all in-memory segmentsへ追加
   -> final segmentsだけrecentFinalWindowへ追加
   -> partialは画面表示のみに使い、LLM対象にしない

4. Knowledge Rule Matcher
   -> knowledgeSetの重要語条件を評価
   -> knowledgeSetの曖昧表現条件を評価
   -> mustCheckItemsの未確認/確認済みを更新

5. Local Rule Gate
   -> LLMを呼ぶべきか判定
   -> 呼ばない場合でもlocal candidateを作れるなら作る
   -> cooldown/rate limitを適用

6. LLM Adapter
   -> 必要な場合だけ /api/coach 経由でLLMへ送信
   -> bounded final transcript window + sessionProfile + knowledgeSet summaryを送る
   -> LLM responseをschema validationする

7. Card Engine
   -> candidatesをdedupe
   -> score計算
   -> done/dismissed抑制
   -> active最大3件へ配置
   -> queued/laterへ退避

8. UI State
   -> transcript paneを更新
   -> active cardsを更新
   -> queued/done countsを更新
   -> user actionsをstateへ反映
```

このフローにより、Realtime Sessionは単なる文字起こし画面ではなく、`final transcript -> knowledge rule -> local rule gate -> LLM候補 -> card engine -> UI` の処理として実装されます。

### 3.2 話者判定

MVPでは、誰が話しているかをブラウザ側だけで高精度に判定できる前提にしないでください。

話者判定の方針:

- ダミー文字起こしでは、fixtureに `speakerInfo` を持たせてよい。
- 実STT providerがspeaker diarizationを返す場合のみ、その結果を `speakerInfo` として使う。
- providerが話者情報を返さない場合は `unknown` とする。
- マイク入力だけで「自分」「相手」を推測して断定しない。
- UIではspeakerが不明でも破綻しない表示にする。
- AIカード生成では、speakerが不明でも成立するプロンプトにする。

`TranscriptSegment` には、話者情報の信頼度を表せるようにしてください。

```ts
type SpeakerSource = "fixture" | "provider-diarization" | "manual" | "unknown";

type SpeakerInfo = {
  label: string;
  source: SpeakerSource;
  confidence?: number;
};
```

### 4. AI Coach Cards

目的:

- 会話中に利用者が次に聞くべき質問、確認漏れ、あとで回収すべき論点を短く提示する。
- 議事録や長文アドバイスではなく、会話中に読める実行可能なカードにする。

カードの役割:

- `今聞くべき質問` を提示する。
- `mustCheckItems` に対する未確認論点を浮かび上がらせる。
- 曖昧な表現、決裁者、予算、時期、成功条件、例外、権限などの確認漏れを検出する。
- 既に聞いた論点を何度も出さない。
- 会話を邪魔しないように最大3件に抑える。

表示ルール:

- `active` は最大3件。
- `pinned` はactive枠に残し、自動降格しない。
- 新しい重要カードが来た場合、active内の最低scoreカードと比較し、必要なら入れ替える。
- 入れ替えたカードは破棄せず `queued` または `later` へ移す。
- `done` / `dismissed` は同一論点の再表示を抑制する。

状態の意味:

| 状態 | 意味 | ユーザー操作/自動処理 |
| --- | --- | --- |
| `active` | いま画面に表示するカード | 最大3件。利用者がすぐ見られる |
| `queued` | 次に表示候補となる高優先カード | active枠が空いたら昇格候補 |
| `later` | 優先度は低いが後で回収可能なカード | 話題転換や再判定で昇格可能 |
| `done` | 利用者が聞いた、または確認済みにしたカード | 同一論点の再表示を抑制 |
| `dismissed` | 利用者が不要と判断したカード | 同一論点の再表示を強く抑制 |
| `pinned` | 固定されたカード | 自動降格しない。stateではなくflagとして扱ってよい |

### 5. Session Report

目的:

- セッション終了後に、聞けたこと、聞けなかったこと、次回確認事項を確認する。
- 会話中の支援結果を、次アクションへつなげる。

できること:

- 聞けたことを表示する。
- 聞けなかったことを表示する。
- 次回確認事項を表示する。
- AIカードのdone/dismissed/later/queued状態を反映する。
- Markdown exportができる。
- JSON exportができる。
- 保存しない場合はBrowser memory上のセッションデータを破棄できる。
- ユーザーが明示した場合のみIndexedDB等のローカル保存を使える。

次へ進める条件:

- export、local save、discardのいずれかを選べる。
- セッションを破棄した場合、会話本文、カード本文、レポート本文がメモリから消える。

禁止:

- レポート本文をサーバーDBへ保存する。
- レポート生成のために無条件で会話全文をLLMへ送る。

## ダミー文字起こしとは何か

ダミー文字起こしは、カードではありません。STT providerなしで、文字起こしとAIカード生成体験を検証するための、決定論的な擬似transcript generatorです。

必要な理由:

- STT credentialなしでもMVPの中核体験を確認するため。
- UI、カード制御、Local Rule Gate、LLM schema validationをSTT精度問題から分離して検証するため。
- CIやローカルテストで、毎回同じtranscript入力を使ってカード生成ロジックを再現するため。
- マイクやWebタブ音声権限が使えない環境でも、Session SetupからRealtime Sessionへの動線を確認するため。

必須挙動:

- scripted transcriptを複数segmentで流す。
- partial segmentを表示した後、同じ内容をfinal segmentとして確定する。
- 会話タイプ別に最低1つのfixtureを持つ。
- mustCheckItemsの未確認、確認済み、曖昧表現、話題転換が発生するfixtureを含める。
- ダミーであることをUIに明示する。

## ProviderとAdapter境界

このプロンプトでのProviderとは、外部サービスや置換可能な実装元を指します。

| Provider種別 | 初期/default | real接続候補 | Adapterが吸収する差分 |
| --- | --- | --- | --- |
| Auth provider | Supabase Auth | Supabase Auth Google OAuth | session取得、user profile取得、role解決 |
| STT provider | mock | OpenAI, Deepgram, Google Cloud, Azure等 | 音声入力、短命token、partial/final transcript形式 |
| LLM provider | mock | OpenAI, Anthropic Claude, 将来別LLM | request形式、model名、response schema、rate limit |
| Storage provider | browser memory | IndexedDB, file export | 保存先、削除方法、永続化可否 |
| Design source | local DESIGN.md | awesome-design-md | design token、component rule、layout rule |

Provider未確定部分は、必ずadapter境界とmock fallbackを持たせてください。

例:

```ts
type LlmProvider = {
  generateCoachCards(input: CoachCardRequest): Promise<CoachCardResponse>;
  generateSessionReport(input: ReportRequest): Promise<ReportResponse>;
};

type SttProvider = {
  start(input: SttStartInput): Promise<SttSession>;
};
```

mockで動くことを、real provider接続完了と偽ってはいけません。

## 認証・権限

ログインは Supabase Auth の Google OAuth を使用する想定です。

MVPでは、会話データはサーバーDBへ保存しません。ただし、ログイン、認証、権限管理に必要な最小限のDB利用は許可します。

保存してよい認証/権限メタデータ:

- `userId`
- `email`
- `authProvider`
- `role`
- `createdAt`
- `updatedAt`
- 最小限のuser preference
  - UI theme
  - default language
  - default conversation type

保存してはいけないもの:

- 音声ファイル
- transcript本文
- AIカード本文
- LLM入力本文
- LLM応答本文
- Session Report本文
- API key
- OAuth token本文

ロール:

| Role | 目的 | できること | できないこと |
| --- | --- | --- | --- |
| `guest` | 未ログイン状態 | Login画面を見る。Google OAuthを開始する | セッション開始、STT token発行、LLM API利用、export |
| `user` | 通常利用者 | 自分のセッションをブラウザ内で開始/終了する。文字起こしを見る。AIカードを操作する。report/exportする | 他ユーザーの情報閲覧、role変更、provider設定変更、server保存 |
| `owner` | 個人利用または管理者相当 | `user` の操作に加え、ローカル設定画面でprovider設定状態を確認する。knowledgeSet初期値を編集する | secret閲覧、secret投入、production操作、他人の会話データ閲覧 |
| `dev_mock_user` | local development専用 | `DEV_AUTH_ENABLED=true` のときだけmock loginできる | production利用、real providerの代替として扱うこと |

最小権限の具体:

- API routeは認証済みuser/ownerのみ許可する。
- `POST /api/stt-token` は `user` または `owner` のみ許可する。
- `POST /api/coach` は `user` または `owner` のみ許可する。
- `POST /api/report` は `user` または `owner` のみ許可する。
- `POST /api/session/init` は `user` または `owner` のみ許可する。
- `guest` はOAuth開始以外できない。
- `owner` でもsecret値は見られない。
- `owner` でも会話本文のサーバー保存はできない。
- Supabase service role keyはserver onlyに限定する。

Supabase未設定時:

- local devでは `DEV_AUTH_ENABLED=true` の場合のみdev/mock authを許可する。
- dev/mock authはUI上でもREADMEでも明示する。
- production buildまたはproduction runtimeではdev/mock authを無効化する。

## 保存方針

会話データはBrowser memoryを基本にしてください。

理由:

- 会話、商談、採用面接、要件定義には機密情報や個人情報が含まれる可能性がある。
- MVPでは、会話データをサーバーDBに永続保存しない方が漏洩時の影響範囲を小さくできる。
- ブラウザ内メモリで完結すれば、セッション終了/破棄時にデータを消しやすい。
- STT/LLM providerへ送るデータは処理上必要な最小範囲に限定できる。
- 将来の永続保存は、同意、暗号化、削除、監査、保持期間の設計が固まってから追加すべきである。

サーバーDBへ保存しないもの:

- 音声
- transcript本文
- AIカード本文
- LLM入力
- LLM応答
- session report本文

ユーザー明示操作がある場合のみ許可:

- IndexedDB保存
- Markdown export
- JSON export

IndexedDBを使う場合:

- 保存する前にユーザー操作を要求する。
- 保存済みセッション一覧を表示する。
- 削除操作を実装する。
- READMEに保存先と削除方法を記載する。

## 暗号化・通信・ログ

通信:

- Browser -> Next.js/Vercel API はHTTPS前提。
- Browser -> Cloud STT はHTTPS/WSS前提。
- Next.js/Vercel API -> Cloud LLM はHTTPS前提。
- Browser/API -> Supabase Auth はHTTPS前提。
- 平文HTTPで認証情報、音声、transcript、LLM入力、LLM応答を送信しない。

サーバー送信時:

- LLMやSTTへ送るデータはTLS上で送る。
- API keyはserver side envに閉じる。
- STT短命tokenを使う場合、有効期限を短くする。
- ブラウザへ出してよい値と出してはいけない値を明確に分ける。

ログ:

- transcript本文をログに出さない。
- LLM入力本文をログに出さない。
- LLM応答本文をログに出さない。
- AIカード本文をログに出さない。
- report本文をログに出さない。
- 音声データをログに出さない。
- API key、OAuth token、STT短命tokenをログに出さない。

許可されるログ:

- request id
- route name
- status code
- latency
- provider type
- model name
- transcript segment count
- card candidate count
- schema validation success/failure
- redacted error code

## LLMを呼ぶ意味と呼びすぎてはいけない理由

LLMを呼ぶ意味:

- final transcriptとSession Setup文脈を使い、今聞くべき質問候補を作るため。
- `mustCheckItems` の未確認項目を検出するため。
- 会話中の曖昧表現、決裁者、予算、時期、成功条件、例外、権限などの聞き漏れを見つけるため。
- セッション終了後に、聞けたこと、聞けなかったこと、次回確認事項を整理するため。

LLMを常時呼んではいけない理由:

- 会話本文を外部AI providerへ送る回数を最小化するため。
- latencyが増えると会話中の支援価値が下がるため。
- costが増えるため。
- partial transcriptは誤認識や未確定内容が多く、カード品質が落ちるため。
- カードが増えすぎると利用者の集中を妨げるため。
- provider rate limitや障害時にアプリ全体が不安定になるため。

LLMを呼ぶ条件:

- final transcript が追加された。
- 重要語が出た。
- 曖昧表現が出た。
- `mustCheckItems` の未確認項目に関連する発話が出た。
- 話題が切り替わった。
- 同じ論点が繰り返された。
- ユーザーが `再判定` を押した。

LLMを呼ばない条件:

- partial transcriptのみ。
- 相槌のみ。
- 雑談のみ。
- 短すぎる発話。
- 既に処理済みの論点。
- クールダウン中で重要度が閾値未満。
- activeカードが十分で、未処理の高重要トリガーがない。

頻度:

- 通常は15から30秒に1回以下。
- 高重要度は10秒程度のクールダウン後に許可。
- 手動再判定は即時。ただし短時間連打はrate limitする。

## LLMモデル・送受信・加工

初期モデル:

```text
RQC_LLM_PROVIDER=mock
LLM_MODEL_REALTIME=
LLM_MODEL_REPORT=
LLM_REALTIME_REASONING=low
LLM_REPORT_REASONING=medium
```

ルール:

- モデル名はenvで変更可能にする。
- provider差し替えはadapter差し替えで対応する。
- UIやカード制御ロジックへprovider固有実装を漏らさない。
- model unavailableの場合は、設定エラーとしてREADMEに従って修正できるメッセージを出す。

`/api/coach` の目的:

- 直近のfinal transcriptとsessionProfileをもとに、AIカード候補を生成する。

送信先:

- `RQC_LLM_PROVIDER=mock` の場合は mock adapter。
- `RQC_LLM_PROVIDER=openai` の場合は OpenAI adapter。
- `RQC_LLM_PROVIDER=anthropic` の場合は Anthropic Claude adapter。
- real provider adapterはserver sideで各provider APIへ送信する。
- OpenAI / Claude / mock のresponse差分はadapter内で吸収し、下流には同じ内部schemaだけを渡す。

送ってよいデータ:

- 直近1から3分のfinal transcript
- `sessionProfile`
- knowledgeSet要約
- 既に聞けた項目
- 未確認項目
- 既出カードの `dedupeKey`
- active/queued/later/done/dismissedのカード状態メタデータ
- transcript本文そのものではなく、可能な範囲で短いwindowまたは要約

送ってはいけないデータ:

- 会話全文の無制限送信
- 音声データ
- 不要な個人情報
- API key
- secret
- OAuth token

受け取るデータ:

```ts
type CoachCardCandidate = {
  dedupeKey: string;
  priority: "now" | "soon" | "later";
  title: string;
  question: string;
  reason: string;
  urgency: number;
  impact: number;
  confidence: number;
  topicFreshness: number;
  mustCheckGap: number;
};
```

加工:

1. JSON schemaで検証する。
2. 不正な候補は破棄する。
3. `dedupeKey` で重複排除する。
4. scoreを計算する。
5. `done` / `dismissed` と衝突する候補を抑制する。
6. active最大3件ルールで `active` / `queued` / `later` へ振り分ける。
7. UIへ反映する。

`/api/report` の目的:

- セッション終了後に、聞けたこと、聞けなかったこと、次回確認事項を整理する。

送ってよいデータ:

- sessionProfile
- mustCheckItems
- card states
- done/dismissed/later/queuedの要約
- transcriptからローカルで作ったbounded digest
- ユーザーが明示的にreport生成を押した場合の必要最小限のfinal transcript抜粋

受け取るデータ:

```ts
type SessionReport = {
  summary: string;
  confirmedItems: string[];
  missedItems: string[];
  nextActions: string[];
  risks: string[];
  generatedAtMs: number;
};
```

加工:

1. JSON schemaで検証する。
2. report本文をserver logに出さない。
3. browser memoryへ格納する。
4. Markdown/JSON export用に整形する。

## STT

MVPでは実STT接続できる設計にしてください。ただし、最初の動作確認はダミー文字起こしで成立させてください。

必須:

- `navigator.mediaDevices.getUserMedia` によるマイク取得UI
- `navigator.mediaDevices.getDisplayMedia` 等によるWebタブ音声候補
- ブラウザ/OSが許可する場合のシステム音声候補
- 非対応時のfallback
- `/api/stt-token` interface
- STT provider adapter
- mock STT adapter
- partial/final transcript model

禁止:

- Vercel/Next APIで長時間音声ストリームを中継する。
- 音声ファイルを自社クラウドへ保存する。
- STT API keyをブラウザへ出す。
- 実STT未接続なのに本番STT完了と書く。

## AIカード制御

AIカード制御は、会話中の認知負荷を下げるために作ります。AIが多く提案するほど良いわけではありません。利用者が会話中に読める数へ絞ることがMVP価値です。

必須状態:

- `active`
- `queued`
- `later`
- `done`
- `dismissed`
- `pinned`

必須ルール:

1. `active` は最大3件。
2. 新規候補はscoreと `dedupeKey` で判定する。
3. active枠が空いていれば高score順に表示する。
4. active枠が満杯の場合、新規候補がactive内の最低scoreを上回る時だけ入れ替える。
5. 入れ替えられたカードは破棄せず `queued` または `later` に移す。
6. `pinned` は自動降格しない。
7. `done` / `dismissed` は同一論点の再表示を抑制する。
8. `再判定` では active / queued / later を再スコアリングする。
9. 新しく非常に重要なカードが来た場合、既存3件を固定表示し続けるのではなく、最低scoreカードと比較して入れ替えを検討する。

Coach Cardの最小モデル:

```ts
type CoachCardState = "active" | "queued" | "later" | "done" | "dismissed";

type CoachCard = {
  id: string;
  sessionId: string;
  dedupeKey: string;
  state: CoachCardState;
  priority: "now" | "soon" | "later";
  title: string;
  question: string;
  reason: string;
  urgency: number;
  impact: number;
  confidence: number;
  topicFreshness: number;
  mustCheckGap: number;
  score: number;
  pinned: boolean;
  source: "local-rule" | "llm" | "mock";
  relatedTranscriptSegmentIds: string[];
  createdAtMs: number;
  updatedAtMs: number;
};
```

scoreの初期案:

```text
score =
  urgency * 1.2
  + impact * 1.2
  + confidence * 0.8
  + topicFreshness * 0.8
  + mustCheckGap * 1.5
```

重みを変更する場合は、理由をコメントまたはREADMEに残してください。

## Local Rule Gate

Local Rule Gateは、LLMを呼ぶ前にブラウザまたは軽量ロジックで「今AIに聞く価値があるか」を判定する機能です。

目的:

- LLM呼び出し回数を抑える。
- partialや雑談でカードを乱発しない。
- mustCheckItemsや重要語に関係するタイミングだけAIを使う。
- provider障害時も最低限のローカルカード候補を出せるようにする。

入力:

- final transcript segment
- sessionProfile
- knowledgeSet keyword rules
- last LLM call time
- current card states
- covered/missing mustCheckItems

出力:

```ts
type LocalRuleGateResult = {
  shouldCallLlm: boolean;
  reasons: string[];
  importance: number;
  suggestedLocalCards: CoachCardCandidate[];
  cooldownMs: number;
};
```

## 重要語条件・曖昧表現条件

実装時に、AIエージェントは `knowledgeSet` ごとに重要語条件と曖昧表現条件を定義してください。

目的:

- LLMを常時呼ばず、呼ぶべきタイミングをローカルで絞る。
- 会話タイプごとに聞き漏れやすい論点を検出する。
- 「曖昧なまま合意したように見える発話」を拾う。

定義場所:

- `src/lib/knowledge/important-terms.ts`
- `src/lib/knowledge/ambiguous-expressions.ts`
- または同等のknowledge module

重要語条件の初期seed:

| conversationType | 重要語例 |
| --- | --- |
| `sales` | 予算、決裁者、導入時期、課題、影響範囲、現行運用、比較対象、成功条件、稟議、契約 |
| `requirements` | 必須、例外、権限、承認、運用、対象ユーザー、期限、優先度、非機能、データ移行 |
| `recruiting` | 実績、役割、転職理由、評価、チーム、期待条件、意思決定、年収、入社時期 |
| `user-research` | 困っている、頻度、代替手段、判断理由、きっかけ、課題、行動、継続、離脱 |

曖昧表現条件の初期seed:

- たぶん
- おそらく
- いい感じ
- 適宜
- なるべく
- 必要なら
- 後で
- 要相談
- 大丈夫だと思う
- 普通は
- そのうち
- できれば
- ざっくり
- いったん
- いいと思います

実装ルール:

- seedをそのまま固定せず、knowledgeSetごとに拡張可能にする。
- 完全一致だけでなく、表記ゆれを扱えるようにする。
- 誤検知が多い語は重要度を低くする。
- 重要語または曖昧表現にhitしても、cooldownと既出論点を見てLLM呼び出しを抑制できるようにする。
- 重要語/曖昧表現のhit理由を `LocalRuleGateResult.reasons` に残す。

テスト条件:

- 重要語を含むfinal transcriptでは `shouldCallLlm=true` になるケースがある。
- 曖昧表現を含むfinal transcriptでは確認カード候補が生成される。
- partial transcriptでは重要語があってもLLMを呼ばない。
- cooldown中は低重要度hitでLLMを呼ばない。
- `done` または `dismissed` 済みの同一論点は再表示しない。

## API

このAPIは、独立した大きなバックエンドを作るためのものではありません。ブラウザへsecretを出さずに、認証確認、STT短命token発行、LLM呼び出しを行うための最小server boundaryです。

mock-onlyのローカル体験では、UIとdomain logicだけで中核体験を検証できるようにしてください。一方で、real STT/real LLM/Google OAuth session検証を安全に扱うため、次のinterfaceを設計してください。

```text
POST /api/session/init
POST /api/stt-token
POST /api/coach
POST /api/report
```

各APIは、入出力schemaを定義し、validationしてください。

| API | 目的 | 認証 | AI/外部送信 | 保存方針 |
| --- | --- | --- | --- | --- |
| `POST /api/session/init` | sessionProfileの検証、初期化補助 | required | なし | DB保存しない |
| `POST /api/stt-token` | STT provider用の短命token取得 | required | STT provider | DB保存しない。secretをclientへ出さない |
| `POST /api/coach` | AIカード候補生成 | required | LLM provider | 入出力本文をログ保存しない。DB保存しない |
| `POST /api/report` | セッションレポート生成 | required | LLM provider | 入出力本文をログ保存しない。DB保存しない |

Supabase Authのログイン処理はSupabase SDKまたはAuth helperで扱ってください。

独自APIでpasswordを受け取らないでください。

## データモデル定義方針

データモデルは曖昧な型コメントではなく、実装で共有できるschemaとして定義してください。

必須:

- Zod等でruntime validation schemaを定義する。
- TypeScript型はschemaから推論する。
- UI、API、testで同じschemaを使う。
- request/responseもschema化する。
- schemaには必須/任意、enum、文字数、配列上限を含める。

推奨配置:

```text
src/lib/schemas/session.ts
src/lib/schemas/transcript.ts
src/lib/schemas/coach-card.ts
src/lib/schemas/report.ts
src/lib/schemas/api.ts
src/lib/types.ts
```

最低限定義:

```ts
type SessionProfile = {
  sessionId: string;
  ownerUserId: string;
  conversationType: "sales" | "requirements" | "recruiting" | "user-research";
  industry: string;
  objective: string;
  knowledgeSetId: string;
  knowledgeSetVersion: string;
  mustCheckItems: string[];
  importantTermRuleIds: string[];
  ambiguousExpressionRuleIds: string[];
  audioSource: "mic" | "browser-tab" | "system" | "dummy";
  language: "ja-JP" | "en-US";
  consentChecked: boolean;
  createdAtMs: number;
};

type TranscriptSegment = {
  id: string;
  sessionId: string;
  source: "mic" | "browser-tab" | "system" | "dummy";
  text: string;
  isFinal: boolean;
  startMs: number;
  endMs?: number;
  speaker?: SpeakerInfo;
  confidence?: number;
  createdAtMs: number;
};

type ConversationState = {
  sessionProfile: SessionProfile;
  transcriptSegments: TranscriptSegment[];
  recentFinalWindow: TranscriptSegment[];
  cards: CoachCard[];
  coveredMustCheckItems: string[];
  missingMustCheckItems: string[];
  lastLlmCallAtMs?: number;
  llmCooldownUntilMs?: number;
};

type KnowledgeSet = {
  id: string;
  version: string;
  conversationType: SessionProfile["conversationType"];
  industry: string | "generic";
  name: string;
  mustCheckItems: string[];
  importantTerms: string[];
  ambiguousExpressions: string[];
  localRuleGateConfig: {
    defaultCooldownMs: number;
    highImportanceCooldownMs: number;
    minImportanceToCallLlm: number;
  };
  llmContextInstruction: string;
  dummyTranscriptFixtureId: string;
};
```

## デザイン方針

デザインは `voltagent/awesome-design-md` を使用することを明示してください。

実装手順:

1. `https://github.com/voltagent/awesome-design-md` を参照する。
2. 可能であれば、業務用ツールに合う `DESIGN.md` を選ぶ。
3. プロジェクトルートまたは `docs/` に `DESIGN.md` 相当のデザインルールを置く。
4. 既存モック `realtime-question-coach-mvp-mock.html` の体験を尊重する。
5. UI実装時は `DESIGN.md` と既存モックの両方に従う。

UIは業務用ツールとして、静かで実用的にしてください。

避けるもの:

- ランディングページ化
- マーケティング風hero
- 装飾過多
- カードの出しすぎ
- 操作説明の過剰表示
- 1画面内の情報過多
- UIカードの入れ子
- 文字はみ出し
- レイアウトシフト
- 1色の濃淡だけで構成された単調な配色

## 実装分解の条件

大きなゴールをそのまま雑に実装してはいけません。

作業単位は、次の条件で分けてください。

- 1作業単位が1つの主要責務に閉じている。
- UI、API、認証、AI、STT、保存、テストを無理に1タスクへ混ぜない。
- 1作業単位の完了条件をローカルで確認できる。
- 失敗時にどの層が原因か切り分けられる。
- 変更ファイル数が過剰にならない。
- 外部provider未設定でもmockで検証できる。
- セキュリティ制約をまたぐ場合は別タスクにする。
- 永続化、secret、production、deployに触れそうな作業は停止条件を確認する。

Canonical 20 implementation slices:

| ID | Work unit |
| --- | --- |
| W01 | Project foundation |
| W02 | Technical/env validation foundation |
| W03 | DESIGN.md and base app layout |
| W04 | Auth shell and permission model |
| W05 | `/api/session/init` |
| W06 | Session Setup |
| W07 | KnowledgeSet and sessionProfile |
| W08 | Dummy transcript fixtures and engine |
| W09 | Transcript store, speakerInfo, conversation buffer |
| W10 | Local Rule Gate |
| W11 | Coach Card Engine |
| W12 | Mock LLM and `/api/coach` |
| W13 | Realtime Session UI wiring |
| W14 | Audio Source Manager and `/api/stt-token` |
| W15 | STT adapter boundary |
| W16 | Session Report UI |
| W17 | `/api/report` |
| W18 | Export, local save, discard |
| W19 | Security, logging, storage guardrails |
| W20 | Tests, build, README, deploy readiness |

## 各作業単位の終了条件

各作業単位は、下表の終了条件を満たし、証跡を残すまで完了にしないでください。

Verification Evidence Contract:

- `done` には、該当するtest file名、実行コマンド、成功結果、確認fixture名、Playwright trace/screenshotの有無を残す。
- 実装agent本人の自己判定だけで `done` にしてはいけない。
- `done` には、Red Team、QA Agent、Tester Agent、Verifier の各結果を必ず残す。
- Red Team は `APPROVE` でなければならない。`APPROVE_WITH_MINOR_NOTES`、`REJECT`、`ESCALATE_HUMAN`、未実施、記載なしの場合は `done` 不可。
- QA Agent は acceptance criteria と required checks の対応表を作り、必要な自動試験が存在し、実行結果が正しく記録されていることを確認しなければならない。
- Tester Agent は Playwright E2E、API、手動確認が必要なブラウザ操作を実際に試験し、pass/fail/not_run、実行コマンド、対象環境、証跡を記録しなければならない。
- QA Agent と Tester Agent の結果が `passed` でない場合、または試験結果に未説明の `not_run` がある場合は `done` 不可。
- `blocked` は有効な停止状態だが、完了ではない。
- security項目はコード確認メモ単独で `done` にしてはいけない。unit/API/E2E/bundle確認のいずれかを証跡に含める。
- 実行不能なcheckは、理由、残リスク、次owner、人間判断が必要な内容を記録する。
- dummy fixture以外の実会話本文やsecretを証跡に含めない。

Strict Completion Gate:

```yaml
completion_gate:
  implementation_self_check:
    required: true
    status: passed | failed
    evidence:
  red_team_review:
    required: true
    agent_type: adversarial_review_agent
    verdict_required: APPROVE
    must_check:
      - scope_creep
      - missing_acceptance_criteria
      - weak_or_missing_tests
      - risky_implicit_behavior
      - unauthorized_storage_or_logging
      - unsupported_completion_claim
  qa_agent_review:
    required: true
    agent_type: qa_agent
    status_required: passed
    must_check:
      - acceptance_criteria_traceability
      - required_checks_coverage
      - negative_cases
      - security_and_storage_checks
      - not_run_justification
  tester_agent_execution:
    required: true
    agent_type: tester_agent
    status_required: passed
    must_execute_or_justify:
      - lint
      - typecheck
      - unit
      - api
      - playwright_e2e
      - responsive
      - audio_permission_mock_or_real_browser_flow
      - export_discard
  purple_team_resolution:
    required_when:
      - red_team_has_findings
      - qa_agent_has_findings
      - tester_agent_has_failures
      - implementation_and_review_disagree
    agent_type: purple_coordination_agent
    allowed_results:
      - fixed_and_retested
      - human_gate_pending
      - blocked
  verifier_final:
    required: true
    verdict_required: APPROVE
```

上記のうち1つでも欠ける場合、Loop結果は `complete` ではなく `blocked` または `under_verification` として報告してください。

| ID | 作業単位 | 具体的な終了条件 | 必須証跡 |
| --- | --- | --- | --- |
| W01 | Project foundation | Next.js/React/TypeScriptの最小構成があり、`npm run dev` で起動できる。`lint`、`typecheck`、`test`、`build`、`test:e2e` のscript方針が決まっている | `package.json` scripts、起動URL、READMEの起動手順 |
| W02 | Technical/env validation foundation | `.env.example` とenv schemaがあり、client公開env/server-only env/mock mode不足時の挙動が定義されている | env schema test、README env説明 |
| W03 | DESIGN.md and base app layout | `voltagent/awesome-design-md` を参照した `DESIGN.md` または同等UIルールがあり、主要画面の余白、密度、ボタン、カード、2ペイン設計に反映されている | `DESIGN.md`、desktop/tablet screenshot |
| W04 | Auth shell and permission model | Supabase Auth Google OAuthの設定境界がある。Supabase envなしでは `DEV_AUTH_ENABLED=true` のlocal dev authだけ許可。guest/user/owner/dev_mock_userのrole判定がある | auth guard test、`tests/e2e/auth-guards.spec.ts` |
| W05 | `/api/session/init` | 認証guard、request/response schema、sessionProfile初期化補助、DB非保存、no body logがある | API test、no DB write test |
| W06 | Session Setup | ユーザー入力は会話タイプ、業界、今回の目的、音声ソース、同意確認に限定。相手役職は入力項目に含めない。validation失敗時に開始できない | schema test、`tests/e2e/session-setup.spec.ts` |
| W07 | KnowledgeSet and sessionProfile | `conversationType + industry` から `knowledgeSet` を解決する。業界別がない場合はgenericへfallback。`mustCheckItems`、重要語条件、曖昧表現条件、LLM contextがsessionProfileへ接続される | knowledge resolver unit test、生成sessionProfile fixture |
| W08 | Dummy transcript fixtures and engine | 会話タイプ別fixtureがあり、partial -> finalの順に決定論的に流れる。最低5 final segments、speakerInfo fixture/unknown、重要語、曖昧表現、mustCheckItems未確認/確認済みを含む | dummy transcript unit test、fixture名 |
| W09 | Transcript store, speakerInfo, conversation buffer | partialは表示用、finalだけがrecentFinalWindowとLLM対象になる。segment id、timestamp、source、speakerInfo、confidenceを保持する。provider speakerなしはunknown | store unit test、speakerInfo matrix |
| W10 | Local Rule Gate | final transcript、knowledgeSet、cooldown、既出カード状態から `shouldCallLlm` を判定する。重要語/曖昧表現hit理由のrule idを残す。partialではLLMを呼ばない | local rule gate unit test、adapter call count |
| W11 | Coach Card Engine | active最大3件を常時守る。5候補投入時も3件以下。高scoreカードが来たら最低scoreカードをqueued/laterへ移す。pinnedは自動降格しない。done/dismissed同一論点は再表示抑制する | card engine unit test、pinned/5候補 matrix |
| W12 | Mock LLM and `/api/coach` | mock LLM adapter、認証guard、request/response schema、rate limit、no body log、mock/openai/anthropic adapter切替がある。LLM送受信と加工手順がREADMEに記載される | adapter/API test、README API説明 |
| W13 | Realtime Session UI wiring | Session SetupからRealtime Sessionへ遷移し、dummy transcript、transcript pane、active cards、counts、card actionsがUIでつながる | `tests/e2e/realtime-session.spec.ts`、trace/screenshot |
| W14 | Audio Source Manager and `/api/stt-token` | mic、browser-tab、system、dummyを選べる。非対応/拒否時に理由を表示しdummyへfallbackできる。`/api/stt-token` は認証guardとsecret非露出を持つ | Playwright dummy/fallback test、API schema test |
| W15 | STT adapter boundary | UIはSTT provider非依存。mock adapterとreal adapter interfaceが分離されている。provider diarizationがあればspeakerInfoへ入り、なければunknown | adapter type test、dummy/real boundary docs |
| W16 | Session Report UI | in-memory session stateから聞けたこと、聞けなかったこと、次回確認事項を表示する。report生成に必要以上の会話全文を送らない | report unit test、Playwright report表示 |
| W17 | `/api/report` | 認証guard、request/response schema、no body log、mock/openai/anthropic adapter切替、Markdown/JSON整形入力がある | API test、README API説明 |
| W18 | Export, local save, discard | Markdown exportとJSON exportが動く。IndexedDB保存を入れる場合は明示操作、一覧、削除がある。discardでmemoryが破棄される | `tests/e2e/session-report-export.spec.ts` |
| W19 | Security, logging, storage guardrails | transcript、AIカード、LLM input/output、report本文、音声、secretがlogger/API log/client bundle/server DBへ渡らない | redaction unit test、server-only env canary bundle check、no DB write test |
| W20 | Tests, build, README, deploy readiness | `npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build` が通る。README、mock mode、Google OAuth設定手順、provider差し替え、deploy前確認、未実施事項が明記される | 実行結果、README、`.env.example`, Known limitations |

## Loop処理の終了条件

Loop実行は、次のいずれかを満たすまで終了にしないでください。

1. 上記W01-W20すべての終了条件が満たされ、必須証跡が残っている。この場合だけ `complete` とする。
2. 停止条件に該当し、`Blocked` 形式で人間判断が必要な内容を報告している。この場合は有効な停止だが、MVP完了ではない。

Loop完了時は、作業単位ごとの状態を次の形式で報告してください。

```text
Loop Completion Checklist:
  W01 Project foundation:
    status: not_started | in_progress | under_verification | done | blocked | human_gate_pending
    required_checks:
    evidence:
    red_team_verdict:
    qa_agent_result:
    tester_agent_result:
    verifier_verdict:
    next_owner:
    blocker_reason:
  ...
  W20 Tests, build, README, deploy readiness:
    status:
    required_checks:
    evidence:
    red_team_verdict:
    qa_agent_result:
    tester_agent_result:
    verifier_verdict:
    next_owner:
    blocker_reason:

Loop result:
  complete | blocked
Completion rule:
  complete requires W01-W20 all done with Red Team APPROVE, QA passed, Tester passed, and Verifier APPROVE.
  blocked means work stopped correctly, but MVP is not complete.
```

## 実装順序

実装順序は絶対条件ではありませんが、依存関係を崩すと手戻りが増えるため、原則として次の順序で進めてください。

```text
W01 Project foundation
W02 Technical/env validation foundation
W03 DESIGN.md and base app layout
W04 Auth shell and permission model
W05 /api/session/init
W06 Session Setup
W07 KnowledgeSet and sessionProfile
W08 Dummy transcript fixtures and engine
W09 Transcript store, speakerInfo, conversation buffer
W10 Local Rule Gate
W11 Coach Card Engine
W12 Mock LLM and /api/coach
W13 Realtime Session UI wiring
W14 Audio Source Manager and /api/stt-token
W15 STT adapter boundary
W16 Session Report UI
W17 /api/report
W18 Export, local save, discard
W19 Security, logging, storage guardrails
W20 Tests, build, README, deploy readiness
```

この順序を変える場合:

- 変える理由を記録する。
- real STT/real LLM接続から始めない。
- UI体験、カード制御、保存方針を後回しにしすぎない。

## 環境変数

`.env.example` を作成または更新し、secret実値は入れないでください。

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

DEV_AUTH_ENABLED=false
OWNER_EMAILS=

STT_PROVIDER=mock
STT_API_KEY=
STT_REGION=
STT_MODEL=

RQC_LLM_PROVIDER=mock
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
LLM_MODEL_REALTIME=
LLM_MODEL_REPORT=
LLM_REALTIME_REASONING=low
LLM_REPORT_REASONING=medium

RETENTION_MODE=browser-memory
LOG_REDACTION_MODE=strict
```

ルール:

- secret実値を作らない。
- `.env` 実ファイルにsecretを書かない。
- `NEXT_PUBLIC_` で始まる値だけがclientへ出てもよい。
- server secretはclient bundleへ入れない。
- env不足時はmock/dev modeで動くか、明確なエラーを出す。
- production相当ではdev/mock authを無効化する。

## テスト観点

最低限、次を確認してください。

| 種別 | 確認観点 |
| --- | --- |
| TypeScript | schema由来型、API型、UI props型が破綻していない |
| lint | 未使用コード、危険な依存、基本的な品質問題がない |
| unit | Coach Card Engine、Local Rule Gate、schema validation、export formatter |
| auth | guestはAPI利用不可。user/ownerのみAPI利用可。dev authはlocal限定 |
| card control | active最大3件、重要カード入れ替え、pinned保護、done/dismissed再表示抑制 |
| transcript | dummy partial/final、finalだけがLLM対象、recent window更新 |
| LLM adapter | mock response validation、不正JSON破棄、provider error fallback |
| API | `/api/session/init`, `/api/coach`, `/api/report`, `/api/stt-token` のrequest/response validation |
| security | secretがclient bundleに出ない。本文がloggerに渡らない |
| UI flow | Login -> Session Setup -> Realtime Session -> Session Report -> export/discard |
| Playwright E2E | dev/mock auth、Session Setup、dummy transcript、AIカード最大3件、Report、export/discard |
| responsive | desktopとtablet幅で文字やカードが破綻しない |
| build | production buildが成功する |

UIを実装したら、Playwright E2Eテストで以下を必ず確認してください。

Required Playwright specs:

- `tests/e2e/auth-guards.spec.ts`
- `tests/e2e/session-setup.spec.ts`
- `tests/e2e/realtime-session.spec.ts`
- `tests/e2e/audio-source-permissions.spec.ts`
- `tests/e2e/session-report-export.spec.ts`
- `tests/e2e/responsive.spec.ts`

Required Playwright assertions:

- desktop viewportでSession Setup初期表示が崩れない。
- tablet viewportでRealtime Sessionの2ペインまたはレスポンシブ表示が崩れない。
- guest は主要画面と `/api/coach`, `/api/report`, `/api/stt-token` を使えない。
- dummy transcript開始後にfinal transcriptが表示される。
- マイク選択時に `navigator.mediaDevices.getUserMedia` が呼ばれ、許可/拒否/fallback が確認できる。
- Webタブ音声またはシステム音声選択時に `navigator.mediaDevices.getDisplayMedia` が呼ばれ、許可/拒否/fallback が確認できる。
- `/api/stt-token` のtoken境界確認だけで、音声権限確認を完了扱いにしない。
- streaming中のすべての時点でactive AIカードが3件以下である。
- 5件以上の候補投入時にactiveは最大3件、残りはqueued/laterへ移る。
- 高scoreカードが来た時に低scoreカードがqueued/laterへ移る。
- `固定` したカードが自動降格しない。
- 3件すべてpinnedの場合、新規カードはactiveを押し出さずqueued/laterへ入る。
- `終了` でSession Reportが表示される。
- Markdown export、JSON export、discardが確認できる。

Trace / screenshot:

- Playwright traceは `retain-on-failure` を基本にする。
- screenshotはfailure時必須。UI変更時はdesktop/tabletの主要画面を保存する。
- screenshotやtraceにはdummy fixture以外の実会話本文やsecretを含めない。

Security mechanical checks:

- sentinel文字列入りのtranscript/card/report/secretを使い、logger mockに本文やsecretが渡らないことを確認する。
- build後のclient bundleにserver-only env canaryが含まれないことを確認する。
- `/api/session/init`, `/api/coach`, `/api/report`, `/api/stt-token` は未認証で401または403を返す。
- server DB/storage mockがaudio、transcript本文、AIカード本文、LLM input/output、report本文で呼ばれないことを確認する。

Unit matrix:

- dummy transcript: conversationType別fixture、partial/final順序、speakerInfo fixture、speaker unknown、重要語、曖昧表現、mustCheck gap。
- Local Rule Gate: partialではLLM不可、final重要語で候補、曖昧表現で確認カード、cooldown、done/dismissed抑制、adapter call count。
- Card Engine: active最大3件、高score入替、pinned保護、3件pinned時のqueued/later退避、dedupe、done/dismissed再表示抑制。

## ローカル確認手順

完了前に、READMEにも同等の手順を記載してください。

想定コマンド:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run dev
```

既存scriptsが異なる場合は、既存scriptsに合わせてください。

ローカルUI確認:

1. `npm run dev` でdev serverを起動する。
2. `http://localhost:3000` を開く。
3. Supabase envがない場合、`DEV_AUTH_ENABLED=true` でdev/mock authとして入れることを確認する。
4. Login後、Session Setupが表示されることを確認する。
5. 会話タイプ、業界、今回の目的、音声ソース、同意確認を入力する。
6. 音声ソースに `ダミー文字起こし` を選ぶ。
7. `セッション開始` でRealtime Sessionへ遷移する。
8. 左ペインにpartial/final transcriptが流れることを確認する。
9. final transcriptを契機にAIカード候補が出ることを確認する。
10. activeカードが4件以上にならないことを確認する。
11. 重要度の高いカードが来たとき、低優先カードがqueued/laterへ移ることを確認する。
12. `固定` したカードが自動降格しないことを確認する。
13. `聞いた`, `あとで`, `不要`, `再判定` が状態に反映されることを確認する。
14. `終了` でSession Reportへ遷移する。
15. 聞けたこと、聞けなかったこと、次回確認事項が表示されることを確認する。
16. Markdown exportとJSON exportができることを確認する。
17. discard後、in-memory session dataが破棄されることを確認する。

## 完了条件

すべて満たすまで完了にしないでください。曖昧な自己判断ではなく、各項目に証跡を残してください。

| ID | 完了条件 | OK判定 |
| --- | --- | --- |
| A1 | 全20作業単位の終了条件が完了している | Loop Completion ChecklistのW01-W20がすべて `done` でrequired evidenceが残っている。`blocked` / `not_started` / `human_gate_pending` が1つでもあれば完了ではなくBlocked報告 |
| A2 | ローカル起動できる | `npm run dev` 後に `http://localhost:3000` でLoginまたはdev auth画面が見え、Playwright screenshotまたはtraceがある |
| A3 | 品質コマンドが通る | `npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build` が成功 |
| A4 | Google OAuth via Supabase Authの設定境界がある | Supabase envありのOAuth flowと、envなしlocal dev authが分離されている |
| A5 | 未ログイン制御がある | guest状態ではSession Setup、Realtime Session、Report、`/api/coach`、`/api/report`、`/api/stt-token` に進めない |
| A6 | role制御がある | `user` / `owner` / `dev_mock_user` が解決され、API guardで使われる。ownerでもsecret閲覧はできない |
| A7 | Session Setup入力が要件通り | 会話タイプ、業界、今回の目的、音声ソース、同意確認だけで開始できる。相手役職は入力項目に存在しない |
| A8 | sessionProfileが具体的 | `sessionProfile` に `conversationType`、`industry`、`objective`、`knowledgeSetId`、`mustCheckItems`、重要語条件、曖昧表現条件が含まれる |
| A9 | knowledgeSetが機能している | `conversationType + industry` でknowledgeSetが解決され、該当なしならgeneric fallbackする |
| A10 | dummy transcriptが動く | Playwrightでdummy開始後、partialとfinalが順に表示され、fixture名と最低5 final segmentsの証跡がある |
| A11 | speaker方針が実装されている | fixture/provider由来のspeakerは表示でき、取得不可なら `unknown` で破綻しないことをunit/E2Eで確認済み |
| A12 | Local Rule Gateが機能している | partialではLLMを呼ばず、final + 重要語/曖昧表現/mustCheck gapで呼び出し候補になり、reasonsとadapter call countがtestで固定されている |
| A13 | AIカード制御が機能している | activeは常に最大3件。5候補投入、高score入替、pinned保護、3件pinned時の退避がunit/E2Eで確認済み |
| A14 | カード操作が機能している | `聞いた`、`あとで`、`不要`、`固定`、`再判定` がstateとUIに反映される |
| A15 | `/api/coach` の責務が明確 | LLMへ送るデータ、受け取るデータ、schema validation、加工手順がコードとREADMEにある |
| A16 | `/api/report` の責務が明確 | report生成の送受信、schema validation、Markdown/JSON整形がコードとREADMEにある |
| A17 | provider境界がある | Auth/STT/LLMそれぞれmockとreal adapter境界があり、provider固有処理がUIへ漏れていない |
| A18 | 保存禁止が守られている | server DB/storage mockがaudio、transcript本文、AIカード本文、LLM input/output、report本文で呼ばれないtestがある |
| A19 | ログ禁止が守られている | sentinel入り本文/secretがlogger mock、API response、server log payload、client bundleに出ないtestまたはbundle scanがある |
| A20 | export/discardが動く | Markdown export、JSON export、discardによるmemory破棄がPlaywrightで確認済み |
| A21 | design方針が反映されている | `voltagent/awesome-design-md` 参照方針が `DESIGN.md` またはREADMEにあり、主要UIに反映されている |
| A22 | deploy直前状態で止めている | README、`.env.example`、Known limitationsがある。deploy、production操作、merge、secret作成/閲覧/投入はしていない |
| A23 | Red Team / QA / Tester / Verifier gate が通っている | 各W01-W20について Red Team verdict が `APPROVE`、QA Agent result が `passed`、Tester Agent result が `passed`、Verifier verdict が `APPROVE`。1つでも欠ける場合はMVP完了不可 |
| A24 | 試験結果が正しく記載されている | 各試験について command、test file、対象ブラウザ/viewport、fixture、実行日時、pass/fail/not_run、not_run理由、残リスク、trace/screenshot有無が記録されている |

## 停止条件

次に該当したら、推測で進まず停止し、判断が必要な内容を整理してください。

- secret実値が必要になった。
- production操作が必要になった。
- deployが必要になった。
- mergeが必要になった。
- `loop-pause-all` が有効になった。
- daily budget または run budget を超過した。
- Ticket Builder Stageを実行できず、AI Work Ticket が作成できない。またはraw requestのまま実装しようとしている。
- Activation Record が存在しない、期限切れ、または最新人間指示と矛盾している。
- `human_gate_required = unknown` または `human_gate_status = pending` のまま実装が必要になった。
- risk level が medium/high で、承認済みscopeまたはhuman gate承認が不足している。
- deny list に該当する領域を触る必要が出た。
- dirty worktreeに無関係変更があり、作業と衝突する。
- `max_fix_attempts` を超過した。
- `git reset --hard`, `git checkout --`, force push, 共有履歴を変えるrebaseが必要になった。
- Supabase project実値が必要になった。
- Supabase本番DBへschema適用が必要になった。
- Google OAuth provider設定を実プロジェクトへ投入する必要が出た。
- STT provider credentialがないとmock以外の検証ができない。
- LLM provider credentialがないとmock以外の検証ができない。
- model unavailableで、env変更以外の判断が必要になった。
- 要件にない保存方式が必要になった。
- 会話本文をサーバーDBへ保存したくなる設計になった。
- セキュリティ制約とUX要件が衝突した。
- `awesome-design-md` を参照できず、既存モックまたはローカル `DESIGN.md` でもデザイン方針を代替できない。
- 資料間に矛盾があり、優先順位だけでは判断できない。
- 同じtest failureをActivation Recordの `max_fix_attempts` 以内に解消できない。
- 受入基準を満たすためにscope拡大が必要になった。

停止時の報告形式:

```text
Blocked:
  reason:
  stop_status: blocked_by_constraints | human_gate_pending | ticket_builder_required | needs_human_management
  affected_requirement:
  attempted_actions:
  options:
  human_decision_needed:
```

## 実装中の報告形式

作業中は、各作業単位ごとに次を残してください。

```text
Step:
Scope:
Implemented:
Verification:
Result:
Remaining:
```

完了時は、次を出してください。

```text
Summary:
Changed files:
How to run:
Checks:
Known limitations:
Deploy readiness:
Human decisions still needed:
```

## 重要な判断

provider未確定でも、中核体験はmockで完成させてください。

ただし、mockで動くことを「実STT/実LLM接続完了」と偽ってはいけません。

実接続が未完了の場合は、明確に次のように分けてください。

```text
Implemented:
  - mock adapter
  - real adapter interface
  - env validation
  - API boundary

Not implemented:
  - actual provider credential configuration
  - production provider verification
  - production deploy
```

## 最重要制約

このMVPの価値は、リアルタイム会話中に、少数の高品質な質問カードを出すことです。

次のどれかを壊す実装は失敗です。

- 会話を邪魔しない。
- AIカードは最大3件。
- 重要なカードが来たら入れ替えられる。
- Session Setupの文脈をAIカードへ反映する。
- 会話データをむやみに保存しない。
- secretを漏らさない。
- Google OAuth via Supabase Authの前提を曖昧にしない。
- provider未確定部分を曖昧にしない。
- 「動く風」ではなく、検証可能な状態にする。

以上を満たすまで、作業を完了にしないでください。
