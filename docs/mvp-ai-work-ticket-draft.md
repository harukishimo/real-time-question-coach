# Realtime Question Coach MVP AI Work Ticket Draft

作成日: 2026-07-08

このファイルは、`docs/mvp-build-agent-prompt.md` のW01-W20をGoogle Sheets上のAI Work Ticketへ起票するための下書きである。正式なsource of truthはAI Work Ticket spreadsheetであり、このファイルはレビューと起票証跡のために置く。

## Ticket Builder Policy

- 1 ticket = 1 work unit。
- `status` は初期起票時点では `ready_for_triage`。
- `allowed_autonomy` は本PJ上限として `L3` を記載するが、実装開始にはチケット単位のActivation Recordが別途必要。
- `risk_level = medium/high` のチケットは `human_gate_required = true` にする。human gate不要ならriskをlowと説明できるscopeへ絞る。
- deploy、production操作、secret作成/閲覧/投入、merge、pushは全チケットで禁止。
- `.env.example` はsecret実値を含まないplaceholder documentationとしてのみ扱う。`.env` やproduction settingsを読んで作らない。
- 会話本文、音声、AIカード本文、LLM入力、LLM出力、レポート本文をserver DBへ保存しない。
- `implementation_agent_type` はprimary coding agentだけを書く。review agentやverification agentは `handoff_notes` / `triage_notes` に書く。
- 3体のreview agentが `APPROVE` または `APPROVE_WITH_MINOR_NOTES` の場合だけ起票する。
- 3体のreview agent通過後は、人間の追加許可なしでAI Work Ticket spreadsheetへ起票してよい。ただし、これはL2/L3実装承認ではない。

## Review Agents

| Reviewer | Result | Notes |
| --- | --- | --- |
| Requirements Ticket Reviewer | pending revision review | ProjectGoal、最新指示、W01-W20責務、scope分割を確認する |
| Implementation Readiness Reviewer | pending revision review | AIが実装へ移れる粒度、依存関係、required checksを確認する |
| Risk And Verification Reviewer | pending revision review | human gate、禁止操作、security、verification観点を確認する |

## Common Field Defaults

| Field | Value |
| --- | --- |
| `created_at` | `2026-07-08` |
| `updated_at` | `2026-07-08` |
| `source_type` | `project_goal` |
| `source_link` | `docs/mvp-build-agent-prompt.md` |
| `evidence_links` | `docs/mvp-build-agent-prompt.md`, `docs/system-requirements-definition.md`, `TODO.md`, `docs/deploy-ready-mvp-agent-execution-prompt.md`, `loop-constraints.md`, `loop-human-gates.md` |
| `target_users` | `authenticated user` for UI/API work, `internal` for infra/docs/testing work |
| `forbidden_actions` | `deploy, production operation, secret creation/view/insertion, merge, push, server DB persistence of conversation data, transcript/LLM/card/report body logging, reading .env or production settings to generate .env.example` |
| `verification_result` | `not_started` |
| `cc_sdd_required` | `false` |
| `kiro_required` | `false` |
| `allowed_autonomy` | `L3` |
| `branch_required` | `true` |
| `verifier_required` | `true` |
| `loop_policy` | `Ticket is implementation-readable, but L2/L3 execution requires a valid ticket-level Activation Record. No merge/deploy/secret/push.` |

起票時の列写像:

- `depends_on` はSpreadsheet正式列ではないため、各行の `handoff_notes` と `triage_notes` に転記する。
- `evidence_to_collect` はSpreadsheet正式列ではないため、各行の `test_plan` と `triage_notes` に転記する。
- draft tableの `required_checks` はSpreadsheetの `required_checks` に転記する。
- UI統合前に単票で完結しないPlaywright確認は、そのチケットの `test_plan` に「UI統合後にW13またはW20で最終確認」と明記する。

## Tickets

| ticket_id | title | priority | depends_on | overview | scope_in | scope_out | affected_areas | human_gate_required | risk_level | implementation_agent_type | acceptance_criteria | required_checks | evidence_to_collect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RQC-W01 | Project foundationを作成する | P0 | none | Next.js/React/TypeScriptのMVP基盤を作る | Next.js app, TypeScript, package scripts, src/tests基本構成, README起動前提 | auth/STT/LLM実接続, deploy, secret実値 | project foundation, tooling, local dev | true | medium | general_implementer_agent | local appが起動し、lint/typecheck/test/build/e2e script方針が存在する | npm run lint; npm run typecheck; npm test; npm run test:e2e またはplaywright placeholder; npm run build | package scripts一覧, 起動URL, 初期画面screenshot |
| RQC-W02 | 技術前提と環境変数validation基盤を作成する | P0 | RQC-W01 | envとprovider設定を安全に扱う基盤を作る | env schema, mock/real provider flags, `.env.example` placeholder, server/client env分離 | secret実値作成, `.env` 読取, production env投入 | env validation, provider config, README | true | high | general_implementer_agent | server-only secretがclientへ露出せず、env不足時のmock/dev動作と設定エラーが明確 | env schema unit; client bundle canary; npm run build; no secret fixture scan | `.env.example` placeholder内容, env validation test result, bundle canary result |
| RQC-W03 | DESIGN.mdと基本アプリレイアウトを作成する | P1 | RQC-W01 | awesome-design-md方針を反映した画面土台を作る | DESIGN.md, app shell, responsive layout, navigation states | marketing landing page, decorative-only UI | UI layout, design rules | false | low | general_implementer_agent | Login/Setup/Realtime/Reportの配置方針があり、desktop/tabletで破綻しない | Playwright responsive; visual/manual screenshot; npm run lint | DESIGN.md, desktop/tablet screenshot |
| RQC-W04 | Auth shellと権限モデルを実装する | P0 | RQC-W01,RQC-W02 | Google OAuth via Supabase Authとdev mock authの境界を作る | auth adapter, role `owner/user/dev_mock_user`, route/API guard, unauth handling | custom password auth, service role client exposure, real Supabase project setup | auth, permission, API guard | true | high | auth_permission_agent | guestは保護画面/APIに入れず、user/owner roleが解決される | auth unit/API tests; Playwright `tests/e2e/auth-guards.spec.ts`; no service role client exposure test | auth guard test result, guest 401/403 evidence, dev auth local-only note |
| RQC-W05 | `/api/session/init` を実装する | P0 | RQC-W04 | Session Setup開始時の認証guardとsession初期化APIを作る | POST `/api/session/init`, request/response schema, no body log, no server conversation storage | server DB persistence, report generation | API, session init, validation | true | medium | general_implementer_agent | 認証済みのみsession init可能で、invalid payloadはvalidation error | API tests 200/401/validation; log redaction sentinel; no DB write mock | `/api/session/init` test result, request schema evidence |
| RQC-W06 | Session Setup画面を実装する | P0 | RQC-W03,RQC-W05,RQC-W07 | 会話タイプ、業界、目的、音声ソース、同意確認から開始できる画面を作る | form UI, validation, dummy/audio source selection, start transition | counterpart role input, playbook direct selection | Session Setup UI, form validation | false | low | form_validation_agent | 必須項目が通るとRealtime Sessionへ遷移し、未入力時は進めない | sessionProfile schema unit; `tests/e2e/session-setup.spec.ts`; responsive check | setup validation result, transition screenshot |
| RQC-W07 | KnowledgeSetとsessionProfileを実装する | P0 | RQC-W02 | conversationType + industryから質問支援ナレッジとsessionProfileを生成する | static knowledge sets, generic fallback, mustCheckItems, important/ambiguous rules, browser memory profile | LLM丸投げknowledge, server DB保存 | knowledge, session state, browser memory | false | low | general_implementer_agent | sessionProfileに必須fieldが入り、fallbackとrules生成がtestできる | resolver unit; schema unit; fallback unit; setup E2E assertion | knowledgeSet IDs, generated rules, fallback evidence |
| RQC-W08 | ダミー文字起こしfixtureとengineを実装する | P0 | RQC-W07 | 外部STTなしでpartial -> finalの中核体験を再現する | fixtures per conversationType, >=5 final segments, partial/final timing, speaker fixture/unknown | real STT connection, audio recording | dummy transcript, transcript engine | false | low | general_implementer_agent | dummy開始後にpartial/finalが時系列表示できる | fixture unit; partial/final unit; `tests/e2e/realtime-session.spec.ts` partial/final assertion | fixture names, >=5 final segments, partial/final screenshot |
| RQC-W09 | Transcript storeとspeakerInfo/conversation bufferを実装する | P0 | RQC-W08 | final transcriptをAI判定へ渡せる状態管理を作る | transcript store, segment model, speakerInfo, recent buffer, browser memory only | server transcript DB, speaker推測の過剰実装 | state management, transcript model | false | low | general_implementer_agent | partial/final、unknown speaker、recent windowが安定して扱える | transcript store unit; speakerInfo fixture/unknown unit; no server storage mock | store state snapshots, no DB write evidence |
| RQC-W10 | Local Rule Gateを実装する | P0 | RQC-W07,RQC-W09 | LLM常時呼び出しを避け、必要なfinal segmentだけ候補化する | important term, ambiguous expression, mustCheck gap, cooldown, done/dismiss suppression, reasons | partial LLM calls, provider-specific prompt tuning | rule engine, LLM trigger policy | false | low | general_implementer_agent | partialでは呼ばず、final条件で候補化し、call countが制御される | rule gate unit; cooldown unit; adapter call count unit; reason rule id test | trigger matrix, adapter call count evidence |
| RQC-W11 | Coach Card Engineを実装する | P0 | RQC-W10 | active最大3件のAI補助カード制御を作る | card states, score, dedupe, active/queued/later/done/dismissed/pinned, actions | unlimited cards, voice interruption | card state machine, UX logic | false | low | general_implementer_agent | 5件投入でもactive最大3、pinned保護、done/dismissed再表示抑制が動く | card engine unit; 5+ candidate unit; pinned protection unit; Playwright active max assertion | card state transition evidence, active<=3 screenshot |
| RQC-W12 | Mock LLMと `/api/coach` を実装する | P1 | RQC-W10,RQC-W11,RQC-W04 | mock-firstでAIカード生成APIとLLM adapter境界を作る | mock/openai/anthropic adapter boundary, response schema, bounded candidates, no body log | real credential requirement, unvalidated JSON, API key client exposure | LLM adapter, API coach | true | high | general_implementer_agent | mockでカード候補を返し、schema不正時に破棄/エラー処理する。active最大3制御はW11/W13の責務として維持する | API 200/401/validation tests; adapter unit; invalid JSON test; log redaction sentinel; bounded candidates | `/api/coach` test result, schema failure evidence, no-log evidence |
| RQC-W13 | Realtime Session UIを接続する | P0 | RQC-W06,RQC-W08,RQC-W09,RQC-W10,RQC-W11,RQC-W12 | transcript、rule gate、coach cards、card actionsを画面で統合する | two-pane UI, streaming state, card actions, counts, end/setup navigation | report internals, real STT precision work | Realtime Session UI, state wiring | false | low | general_implementer_agent | dummy transcriptからcards表示まで動き、全時点でactive最大3 | `tests/e2e/realtime-session.spec.ts`; responsive check; card actions assertion | realtime desktop/tablet screenshots, active card count trace |
| RQC-W14 | Audio Source Managerと `/api/stt-token` を実装する | P1 | RQC-W04,RQC-W05,RQC-W08 | マイク/Webタブ/システム音声選択とSTT token API境界を作る | getUserMedia, getDisplayMedia fallback, POST `/api/stt-token`, mock token, permission states | long-running audio relay via Next API, real provider credential setup | audio permissions, STT token API | true | high | general_implementer_agent | dummy/mockで検証でき、実音声権限エラーとfallbackが明確 | API 200/401/validation tests; permission fallback E2E/manual; token/audio/transcript no-log sentinel | permission state evidence, `/api/stt-token` no-log evidence |
| RQC-W15 | STT adapter boundaryを実装する | P1 | RQC-W14,RQC-W09 | real STTへ差し替え可能なadapter interfaceを用意する | mock STT adapter, real adapter interface, partial/final event contract, provider config | specific provider full production integration, audio storage | STT adapter, transcript event model | true | high | general_implementer_agent | mock adapterでpartial/final eventsを出し、real provider差し替え点が明確 | adapter unit; typecheck; provider boundary README; token/audio/transcript no-log sentinel | adapter interface docs, mock event test result |
| RQC-W16 | Session Report UIを実装する | P1 | RQC-W13 | セッション終了後の聞けた/聞けなかった/次回確認事項画面を作る | report UI, in-memory summary input, navigation, empty states | server persistence, full minutes generator | Session Report UI | false | low | general_implementer_agent | 終了後にreport画面へ遷移し、必要セクションが表示される | `tests/e2e/session-report-export.spec.ts` report view assertion; responsive check | report screen screenshot, empty state evidence |
| RQC-W17 | `/api/report` を実装する | P1 | RQC-W12,RQC-W16,RQC-W04 | mock/LLM adapter経由でreport生成APIを作る | request/response schema, mock/openai/anthropic adapter boundary, no body log | server report storage, real credential requirement | report API, LLM adapter | true | high | general_implementer_agent | 認証済みのみ使え、mockでreport構造を返し、本文ログ/保存をしない | API 200/401/validation tests; log redaction sentinel; no DB write mock; schema unit | `/api/report` test result, no-log/no-storage evidence |
| RQC-W18 | export/local save/discardを実装する | P1 | RQC-W16,RQC-W17 | ユーザー明示操作でMarkdown/JSON export、任意local save、discardを行う | Markdown export, JSON export, discard memory clear, optional IndexedDB boundary | automatic server save, background upload | export, local storage, retention | true | medium | general_implementer_agent | exportが生成され、discardでin-memory session dataと任意local persistenceが消える | formatter unit; `tests/e2e/session-report-export.spec.ts`; local persistence clear test; no server save mock | exported Markdown/JSON sample, discard storage evidence |
| RQC-W19 | Security/logging/storage guardrailsを実装する | P0 | RQC-W02,RQC-W04,RQC-W05,RQC-W12,RQC-W14,RQC-W17,RQC-W18 | 保存禁止、ログ禁止、secret非露出を機械的に検証する | redacted logger, no body log, no server DB conversation storage tests, client bundle canary | production monitoring setup, secret handling | security, logging, storage | true | high | general_implementer_agent | transcript/card/report/secret/audio/STT token/LLM input/output sentinelがlog/client/server DB mockへ出ない | security unit/API; bundle scan; no DB write mock; audio/STT token/LLM input-output no-log sentinel; npm run build | sentinel test output, bundle canary result, security review handoff |
| RQC-W20 | Tests/build/README/deploy readinessを完了する | P0 | RQC-W01-RQC-W19 | 全体検証とREADMEを整え、deploy直前状態で止める | lint/typecheck/unit/e2e/build, README, `.env.example` placeholder, known limitations, local URL evidence | deploy, production operation, push/merge, secret投入, `.env` 読取 | QA, docs, deploy readiness | true | high | general_implementer_agent | 全W01-W20 evidenceが揃い、品質コマンドが通り、deployは未実施 | npm run lint; npm run typecheck; npm test; npm run test:e2e; npm run build; README/manual local flow | command outputs, Playwright trace/screenshot, README and `.env.example` placeholder verification |

## Per Ticket Structured Notes

全チケットに以下を展開して起票する。

- `background_purpose`: Realtime Question Coach MVPを、ローカルで動作しデプロイ直前まで進められる状態へ段階的に構築するため。
- `problem`: raw requestのまま実装するとscope、権限、保存禁止、LLM/STT境界、テスト完了条件が曖昧になる。
- `current_state`: ProjectGoalと要件資料は存在するが、W01-W20単位の実装可能なAI Work Ticketが不足している。
- `desired_state`: 各チケットがAIに実装可能な粒度で、scope、non-goals、acceptance、verification、human gateが明示されている。
- `unknowns`: secret実値、production設定、real provider credential、deploy先設定は未投入。mock-firstで実装する。
- `non_goals`: 各チケットの `scope_out` を正とし、隣接W番号の実装を広げない。
- `assumptions`: mock-first、browser memory primary、server DBに会話データを保存しない。
- `decisions_already_made`: Google OAuth via Supabase Auth、active AI cards最大3、Session Setup項目は会話タイプ/業界/今回の目的/音声ソース/同意確認。
- `expected_agent_behavior`: 必読資料を読み、Activation Recordを確認し、scope内だけ実装し、required checksとverification evidenceを残す。
- `handoff_notes`: Ticket creation is approved by latest human instruction without extra permission. Implementation still requires a valid ticket-level Activation Record. Dependencies are listed in `depends_on` and must be completed or explicitly waived before implementation.
- `triage_notes`: Created by Ticket Builder for W01-W20 MVP slices after three review-agent approval. Review agents: Requirements Ticket Reviewer, Implementation Readiness Reviewer, Risk And Verification Reviewer.
