# Realtime Question Coach Deploy-Ready MVP Agent Execution Prompt

作成日: 2026-07-08

このファイルは、Realtime Question Coach MVPをローカルで動作確認でき、必要な環境変数を設定すればデプロイ直前まで進められる状態へ構築するために、実装エージェントへ渡す実行プロンプトである。

このファイル単体は L2 / L3 Activation Record ではない。実際にコード変更、branch作成、PR準備、repository actionを行う場合は、対象AI Work TicketとActivation Recordが別途必要である。

---

## Agent Prompt

あなたは Realtime Question Coach のMVPを、デプロイ直前状態まで構築するシニアソフトウェアエンジニア兼実装オーケストレーターです。

最初に必ず `docs/mvp-build-agent-prompt.md` を読んでください。このファイルは現行ProjectGoalです。以降の実装判断、完了条件、停止条件は `docs/mvp-build-agent-prompt.md` を正とします。

## 実行目的

Realtime Question Coach MVPを、次の状態まで構築してください。

- ローカルで起動できる。
- Login -> Session Setup -> Realtime Session -> Session Report -> export/discard の主要フローが動く。
- ダミー文字起こしだけで中核体験を確認できる。
- Google OAuth via Supabase Auth、STT、LLMはreal providerへ差し替え可能なadapter境界を持つ。
- 会話本文、音声、AIカード本文、LLM入出力、レポート本文をserver DBへ保存しない。
- lint / typecheck / unit test / Playwright E2E / build が通る。
- `.env.example` と README が整備され、secret実値を投入すればデプロイ準備に進める。
- deploy、production操作、secret作成/閲覧/投入、merge、pushは行わない。

## 実行前ゲート

実装を始める前に、次を確認してください。

```yaml
execution_preflight:
  project_goal_read: docs/mvp-build-agent-prompt.md
  required_docs_read:
    - README.md
    - TODO.md
    - docs/business-requirements-definition.md
    - docs/system-requirements-definition.md
    - realtime-question-coach-mvp-mock.html
    - loop-constraints.md
    - loop-human-gates.md
    - docs/loop-autonomy-contract.md
    - docs/loop-execution-contract.md
  git_remote_expected:
    origin: git@github.com:harukishimo/real-time-question-coach.git
  ai_work_ticket_spreadsheet:
    url: https://docs.google.com/spreadsheets/d/1y7UEjCTejSJXgLWmvA0SEKOHurl8C5QvtfxMf87ruqc/edit
    role: AI Work Ticket source of truth
  ticket_creation_allowed: true
  human_permission_required_for_ticket_creation: false
  deploy_allowed: false
  production_allowed: false
  secret_handling_allowed: false
  merge_allowed: false
  push_allowed: false
```

AI Work Ticketがまだ存在しない、またはW01-W20を実装できる粒度になっていない場合は、実装へ進む前に必ず `Ticket Builder Stage` を実行してください。Ticket Builder Stageでのチケット下書き、レビュー、AI Work Ticket spreadsheetへの起票は、人間の追加許可なしで実行して構いません。

L2/L3 Loop実行としてコード変更、branch作成、PR準備、repository actionを進める場合は、AI Work TicketとActivation Recordを確認してください。Activation Recordがない場合は、チケット起票までは行い、実装開始はせず、必要なActivation Record案を提示してください。

## Ticket Builder Stage

この段階は、AIがチケット未作成を理由に停止しないようにするための前処理です。raw requestを直接実装せず、ProjectGoalをAI-readableなAI Work Ticketへ変換します。

実行条件:

- AI Work Ticket spreadsheetに対象W01-W20のチケットが存在しない。
- 既存チケットが古いRQC-0001〜0015の粒度で、現行ProjectGoalのW01-W20と対応していない。
- 既存チケットに `scope_in`, `scope_out`, `non_goals`, `acceptance_criteria`, `required_checks`, `human_gate_required`, `loop_policy` が不足している。

作成するチケット:

- `docs/mvp-build-agent-prompt.md` のW01-W20を1作業単位1チケットに変換する。
- `ticket_id` は既存IDと衝突しない連番にする。新規投入時の推奨は `RQC-W01` から `RQC-W20`。
- `status` は `ready_for_triage` を基本にする。実装承認済みでないチケットを `done` や `in_progress` にしない。
- `allowed_autonomy` は本PJの上限として `L3` を記載してよい。ただし、これは実装開始許可ではなく、Activation Recordが別途必要であることを `loop_policy` と `handoff_notes` に明記する。
- `human_gate_required` は、認証、権限、外部provider、secret、deploy、保存/ログ/security、依存関係、環境変数、production相当操作が関係する場合は `true` にする。
- `risk_level` が `medium` または `high` の場合は、原則として `human_gate_required = true` にする。`human_gate_required = false` にするなら、risk_levelも `low` と説明できるscopeへ絞る。
- `.env.example` はsecret実値を含まないplaceholder documentationとしてのみ扱う。`.env` やproduction settingsを読んで作らない。
- `human_gate_required = true` の場合でも、チケット起票自体は止めない。実装開始時にActivation Recordとhuman gate statusを確認する。

3体のチケットレビューエージェント:

| Reviewer | Loop mapping候補 | レビュー観点 | OK条件 |
| --- | --- | --- | --- |
| Requirements Ticket Reviewer | `kiro_requirements_agent`, `scope_guard_agent` | 各チケットがProjectGoal、最新人間指示、W01-W20の責務に一致しているか | scope_in/out、non_goals、acceptance_criteriaが実装可能な粒度 |
| Implementation Readiness Reviewer | `kiro_tasks_agent`, `agent_planner_agent` | AIがそのまま実装計画へ移れる粒度か | required_checks、affected_areas、implementation_agent_type、依存関係が明確 |
| Risk And Verification Reviewer | `security_review_agent`, `human_gate_review_agent`, `verifier` | human gate、禁止操作、保存禁止、ログ禁止、テスト観点が漏れていないか | risk_level、human_gate_required、forbidden_actions、verification項目が妥当 |

レビュー手順:

1. Ticket BuilderがW01-W20のチケット下書きを作る。
2. 上記3体のreview agentへ同じ下書きを渡す。
3. 各review agentは `APPROVE`, `APPROVE_WITH_MINOR_NOTES`, `REJECT` のいずれかを返す。
4. `REJECT` が1つでもある場合、Ticket Builderは指摘を反映して1回以上修正し、再レビューする。
5. 3体すべてが `APPROVE` または `APPROVE_WITH_MINOR_NOTES` になった場合、AI Work Ticket spreadsheetへ起票する。
6. 起票後、起票範囲、ticket_id、review結果、未実装であること、Activation Record要否を報告する。

起票時の必須列:

```text
ticket_id, title, status, priority, created_at, updated_at, next_owner,
source_type, source_summary, evidence_links,
overview, background_purpose, problem, current_state, desired_state, target_users, unknowns,
scope_in, scope_out, affected_areas, screen_scope, functional_scope, data_scope,
screen_requirements, functional_requirements, data_requirements, validation_requirements, permission_requirements, implementation_notes, reference_info,
intent_summary, success_boundary, non_goals, assumptions, decisions_already_made, expected_agent_behavior, handoff_notes,
risk_level, risk_reasons, human_gate_required, human_gate_reason, deny_list_checked, forbidden_actions, blocked_reason,
acceptance_criteria, required_checks, test_perspectives, test_plan, verification_result, verification_evidence,
requested_outcome,
work_type, suggested_next_action, cc_sdd_required, cc_sdd_reason, kiro_required, implementation_agent_type, allowed_autonomy, branch_required, verifier_required, loop_policy, triage_notes
```

チケット起票では、`approved_autonomy`, `approved_by`, `approved_at`, `approval_source`, `approval_scope`, `approval_expires_at`, `branch_name`, `commit_sha`, `pr_url`, `merge_approval_status`, `done_criteria_met`, `closed_at` などの実装承認・実行・完了列を捏造しないでください。

## 構築方針

`docs/mvp-build-agent-prompt.md` の W01-W20 をそのまま実装単位として扱ってください。

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

各作業単位は、実装、検証、証跡記録まで終えて `done` にしてください。`blocked` は完了ではありません。

`done` に進めるには、実装agentの自己判定だけでは不十分です。各W01-W20について、次の gate をすべて満たしてください。

```yaml
mandatory_completion_gates:
  red_team_review:
    agent_type: adversarial_review_agent
    required_verdict: APPROVE
    note: APPROVE_WITH_MINOR_NOTES is not enough for done.
  qa_agent:
    agent_type: qa_agent
    required_status: passed
    required_output:
      - acceptance_criteria_traceability
      - required_checks_coverage
      - negative_cases
      - security_storage_logging_review
      - not_run_review
  tester_agent:
    agent_type: tester_agent
    required_status: passed
    required_output:
      - commands_run
      - test_files
      - fixture
      - browser_and_viewport_when_applicable
      - pass_fail_not_run
      - trace_or_screenshot_status
  purple_team:
    agent_type: purple_coordination_agent
    required_when_findings_exist: true
    only_pass_result: fixed_and_retested
  verifier:
    required_verdict: APPROVE
```

Red Team、QA Agent、Tester Agent、Verifier のいずれかが未実施、未記載、または不合格の場合、Loop結果は `complete` ではなく `under_verification`、`ready_for_implementation`、`human_gate_pending`、または `blocked` として報告してください。

## 技術指定

基本構成:

- Next.js
- React
- TypeScript
- Zod等のruntime validation
- Playwright
- Supabase Auth Google OAuth
- Browser memory primary storage
- mock STT / mock LLM first
- provider adapter for real STT / LLM provider
- LLM real-provider initial candidate is OpenAI; Anthropic Claude must remain supported through the same adapter contract

LLM初期値:

```text
RQC_LLM_PROVIDER=mock
LLM_MODEL_REALTIME=
LLM_MODEL_REPORT=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

モデル名とproviderはenvで差し替え可能にしてください。`RQC_LLM_PROVIDER=openai` の場合はOpenAI adapter、`RQC_LLM_PROVIDER=anthropic` の場合はAnthropic Claude adapterを使い、どちらも同じ内部schemaへ正規化してください。

## 実装上の必須制約

- 独自APIでpasswordを受け取らない。
- Supabase service role key、LLM API key、STT API keyをclientへ出さない。
- 会話本文、音声、AIカード本文、LLM入出力、レポート本文をserver DBへ保存しない。
- transcript本文、LLM入出力、AIカード本文、report本文、secretをログへ出さない。
- `DEV_AUTH_ENABLED=true` のmock authはlocal dev限定にする。
- real STT/real LLM未接続を、接続完了と表現しない。
- `.env` 実ファイルやsecret実値を作らない。
- deploy、production操作、merge、pushは行わない。

## 必須画面

Login:

- Google OAuth via Supabase Authを使う設計。
- env未設定時はlocal dev mock authを明示して入れる。
- guestはSession Setup以降とAPIへ進めない。

Session Setup:

- 入力は会話タイプ、業界、今回の目的、音声ソース、同意確認。
- 相手役職は入力項目にしない。
- `conversationType + industry` から `knowledgeSet` を解決する。
- `sessionProfile` をbrowser memoryへ作る。

Realtime Session:

- 左にpartial/final transcript。
- 右にAI coach cards。
- active cardsは常に最大3件。
- card actions: `聞いた`, `あとで`, `不要`, `固定`, `再判定`。
- dummy transcriptでpartial -> finalを再現する。

Session Report:

- 聞けたこと、聞けなかったこと、次回確認事項を表示する。
- Markdown export、JSON export、discardができる。

## 必須ロジック

KnowledgeSet:

- 会話タイプ別の静的ナレッジを持つ。
- 業界別がない場合はgenericへfallbackする。
- `mustCheckItems`, 重要語条件, 曖昧表現条件, LLM context instructionを生成する。

Dummy transcript:

- 会話タイプ別fixtureを持つ。
- 最低5 final segmentsを含む。
- partial -> finalの順に流れる。
- speakerInfo fixtureとunknownの両方を扱う。
- 重要語、曖昧表現、mustCheck gapを含む。

Local Rule Gate:

- partialではLLMを呼ばない。
- final + 重要語 / 曖昧表現 / mustCheck gapでLLM呼び出し候補にする。
- cooldown、done/dismissed抑制、reason rule id、adapter call countをテストできるようにする。

Coach Card Engine:

- active最大3件を常時守る。
- 5件以上の候補投入でもactiveは3件以下。
- 高scoreカードで低scoreカードをqueued/laterへ移す。
- pinnedは自動降格しない。
- 3件すべてpinnedの場合、新規カードはqueued/laterへ入る。
- done/dismissedは同一論点の再表示を抑制する。

## API

最低限、次を実装してください。

```text
POST /api/session/init
POST /api/stt-token
POST /api/coach
POST /api/report
```

各APIは以下を満たしてください。

- 認証guard。
- request/response schema validation。
- secret非露出。
- no body log。
- server DBへ会話本文を保存しない。
- mock providerでローカル検証可能。

## 必須テスト

unit:

- KnowledgeSet resolver。
- sessionProfile schema。
- dummy transcript partial/final。
- transcript store。
- Local Rule Gate。
- Coach Card Engine。
- LLM/STT adapters。
- export formatter。
- log redaction。

API:

- `/api/session/init`
- `/api/stt-token`
- `/api/coach`
- `/api/report`
- unauthenticated 401/403。
- invalid payload validation error。
- no body log / no DB write。

Playwright:

- `tests/e2e/auth-guards.spec.ts`
- `tests/e2e/session-setup.spec.ts`
- `tests/e2e/realtime-session.spec.ts`
- `tests/e2e/session-report-export.spec.ts`
- `tests/e2e/responsive.spec.ts`

Security mechanical checks:

- sentinel入りtranscript/card/report/secretがlogger mockへ渡らない。
- server-only env canaryがclient bundleに含まれない。
- server DB/storage mockが会話本文系データで呼ばれない。

## 必須コマンド

既存scriptsがある場合は既存に合わせてください。なければ整備してください。

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

dev server確認:

```bash
npm run dev
```

## 完了条件

完了にするには、次をすべて満たしてください。

- W01-W20がすべて `done`。
- required evidenceが残っている。
- lint/typecheck/unit/e2e/buildが成功している。
- local devで主要フローが確認できる。
- READMEに起動方法、env、mock mode、provider差し替え、deploy前確認、未実施事項がある。
- `.env.example` がある。
- secret実値を作っていない。
- deploy、production操作、merge、pushをしていない。

1つでも `blocked`, `not_started`, `human_gate_pending` がある場合、完了ではなくBlockedとして報告してください。

## 停止条件

次に該当したら推測で進まず停止してください。

- AI Work Ticket作成に必要なProjectGoal、W01-W20、Spreadsheet schemaを読めない。
- AI Work Ticket spreadsheetへ書き込む権限がなく、ローカル下書き以外に起票できない。
- Ticket Builder Stageで3体のreview agentのいずれかが再修正後も `REJECT` を返した。
- Activation Recordが必要だが存在しない。
- secret実値が必要。
- production操作が必要。
- deployが必要。
- mergeまたはpushが必要。
- Supabase project実値が必要。
- Google OAuth provider設定を実プロジェクトへ投入する必要がある。
- STT/LLM credentialがないとmock以外の検証ができない。
- 会話本文をserver DBへ保存したくなる設計になった。
- no body log / no server storage / no secret leakを守れない。
- required checksが `max_fix_attempts` 内で解消できない。
- scope拡大が必要。

停止時は次の形式で報告してください。

```text
Blocked:
  reason:
  stop_status: blocked_by_constraints | human_gate_pending | ticket_builder_required | needs_human_management
  affected_work_unit:
  attempted_actions:
  required_human_decision:
  recommended_next_action:
```

## 最終報告形式

```text
Summary:
Changed files:
W01-W20 status:
Commands run:
Verification evidence:
Local URL:
Known limitations:
Deploy readiness:
Not performed:
  - deploy
  - production operation
  - secret creation/view/insertion
  - merge
  - push
Human decisions still needed:
```

以上を満たすまで、作業を完了にしないでください。
