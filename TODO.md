# Realtime Question Coach TODO

作成日: 2026-07-08

## 目的

このTODOは、Realtime Question Coach を実装へ進めるための親タスクを整理する。

実装そのものより先に、次を成立させる。

- Loop処理の構造を、現プロジェクト向けに運用できる状態にする。
- チケット管理をGoogle Sheets上の AI Work Ticket として成立させる。
- 業務要件・システム要件・モックを、AIが実装できる具体チケットへ分解する。

## 現時点の入力資料

- [docs/business-requirements-definition.md](docs/business-requirements-definition.md)
- [docs/system-requirements-definition.md](docs/system-requirements-definition.md)
- [realtime-question-coach-mvp-mock.html](realtime-question-coach-mvp-mock.html)
- [Project.md](Project.md)
- [ProjectGoal.md](ProjectGoal.md)
- [AI_BOOTSTRAP_CONTEXT.md](AI_BOOTSTRAP_CONTEXT.md)
- [cloud-stt-ai-system-flows.md](cloud-stt-ai-system-flows.md)
- [LOOP.md](LOOP.md)
- [docs/ai-work-ticket-spreadsheet-schema.md](docs/ai-work-ticket-spreadsheet-schema.md)
- [docs/ticket-builder-intake.md](docs/ticket-builder-intake.md)

## Google Sheets確認メモ

対象スプレッドシート:

- URL: https://docs.google.com/spreadsheets/d/1y7UEjCTejSJXgLWmvA0SEKOHurl8C5QvtfxMf87ruqc/edit
- Title: `ai音声メモ`
- Sheet: `シート1`
- Sheet ID: `0`
- Grid: 1000 rows x 103 columns

確認結果:

- 1行目はAI Work Ticket用のヘッダー。
- 2行目は各列の説明。
- `シート1!A3:CY22` に `RQC-W01` から `RQC-W20` までの20件を起票済み。
- `シート1!A23:CY35` に real provider readiness 用の `RQC-W21` から `RQC-W33` までの13件を起票済み。
- 起票済みticketはすべて `ready_for_implementation`。
- `RQC-W01` から `RQC-W20` まで、L3のticket-level Activation Recordを作成済み。
- `RQC-W21` から `RQC-W33` まで、L3のticket-level Activation Recordを作成済み。
  - `approved_by=human`
  - `approval_source=current_thread`
  - `human_gate_status=approved`
  - `approval_expires_at=2026-07-16T23:59:59+09:00`
  - approval_scope は code/docs/tests only
  - real provider execution、secret作成・閲覧・投入、deploy、production operation、push、merge は対象外
- Activation Record は `approved_by=human`, `approval_source=current_thread`, `human_gate_status=approved`, `approval_expires_at=2026-07-15T23:59:59+09:00` として管理する。
- CodeCommit PR作成、CodeCommit reviewer comment投稿、merge、deploy、secret作成・閲覧・投入、push、production操作は許可していない。
- 実装前提列の `work_type`, `suggested_next_action`, `cc_sdd_required`, `kiro_required`, `implementation_agent_type`, `allowed_autonomy`, `branch_required`, `verifier_required`, `loop_policy`, `triage_notes` は列定義に合わせて整合済み。
- 列構成は `ticket_id` から `merge_approval_status` まであり、identity、source、understanding、scope、requirements、risk、verification、human communication、L1 proposed updates、L2/L3 execution まで含まれている。

注意:

- Phase 0では、現シートをそのまま正として使う。
- `agent_plan`, `allowed_actions`, `allowed_mutations` はシート列として追加しない。
- L2/L3のActivation Record詳細は、既存列、`handoff_notes`, `triage_notes`, `loop-run-log.md`, または最新の人間指示で扱う。

## 運用方針

- AI Work Ticket の正本はGoogle Sheetsとする。
- rawな人間依頼をそのままチケット行にしない。
- Ticket Builder / Intake が要件を分解し、AI-readableなチケットにする。
- 初期ステータスは原則 `ready_for_triage` または `pending` とする。
- scheduled daily-triage はL1 report-onlyを基本とし、canonicalな `status` やチケット本文を直接変更しない。
- L1が書けるのは Human Communication columns と L1 Proposed Updates columns に限定する。
- 本PJでは最大L3まで許可済みとする。
- L2/L3実装は、チケット単位のActivation Recordがある場合だけ開始する。
- 2026-07-08時点で、`RQC-W01` から `RQC-W20` までのActivation Recordは作成済み。
- 2026-07-09時点で、`RQC-W21` から `RQC-W33` までのActivation Recordは作成済み。ただし scope は code/docs/tests only で、real provider execution は human-run only とする。
- merge、deploy、secrets、production、DB schema、認可、外部連携、STT/LLM provider設定は human gate 対象とする。

## Phase 0: 管理基盤の整合

- [x] Google Sheetsの正式運用名を決める。
  - 現状: `ai音声メモ`
  - 採用: 現シートをそのまま使用する
- [x] Sheet名を正式運用名に合わせるか決める。
  - 現状: `シート1`
  - 採用: 現シート名をそのまま使用する
- [x] 実シートと `docs/ai-work-ticket-spreadsheet-schema.md` の列差分を解消する。
  - [x] `agent_plan` はシート列へ追加しない。
  - [x] `allowed_actions` はシート列へ追加しない。
  - [x] `allowed_mutations` はシート列へ追加しない。
  - [x] ローカルschema側を現シート運用へ合わせる。
- [x] dropdown対象列にデータ検証を設定する。
  - Phase 0では現シートをそのまま使用するため、新規設定は行わない。
  - `status`
  - `priority`
  - `next_owner`
  - `source_type`
  - `risk_level`
  - `human_gate_required`
  - `deny_list_checked`
  - `work_type`
  - `suggested_next_action`
  - `cc_sdd_required`
  - `kiro_required`
  - `allowed_autonomy`
  - `branch_required`
  - `verifier_required`
  - `ai_comment_type`
  - `proposed_status`
  - `proposed_next_owner`
  - `approved_autonomy`
  - `human_gate_status`
  - `verifier_verdict`
  - `merge_approval_status`
- [x] 1行目と2行目を固定する。
  - Phase 0では現シートをそのまま使用するため、新規操作は行わない。
- [x] フィルタを有効化する。
  - Phase 0では現シートをそのまま使用するため、新規操作は行わない。
- [x] L1が直接更新してよい列と、触ってはいけない列をシート上でも明示する。
  - 現時点では `docs/ai-work-ticket-spreadsheet-schema.md` と `LOOP.md` を正とする。
- [x] シートURLを `LOOP.md`, `STATE.md`, `docs/loop-engineering-todo.md` の placeholder から実URLへ寄せるか決める。
  - 実URLへ置き換え済み。

## Phase 1: Loop処理の構造作成

- [x] `LOOP.md` のProject名を Realtime Question Coach に置き換える。
- [x] `loop-constraints.md` のドメイン例をこのプロダクト向けに置き換える。
  - 認証 / Supabase
  - STT Provider
  - LLM Provider
  - 会話データ保存禁止
  - 通信暗号化
  - ログ本文禁止
- [x] `loop-human-gates.md` の human gate 条件をこのプロダクト向けに更新する。
  - 認証・認可
  - DB / RLS
  - STT/LLM provider設定
  - 保存・保持・ログ
  - API key / env vars
  - deploy / production
- [x] `loop-budget.md` の日次実行回数とL1/L2/L3の運用範囲を決める。
  - scheduled daily-triage はL1。
  - 本PJの最大許可自律度はL3。
  - L2/L3はチケット単位のActivation Recordがある場合のみon-demandで実行する。
- [x] `STATE.md` を現状に合わせて更新する。
  - `RQC-W01` から `RQC-W20` まで起票済み
  - ticket status は `ready_for_implementation`
  - `RQC-W01` から `RQC-W20` まで ticket-level Activation Record 作成済み
- [x] `loop-run-log.md` の過去demo文脈が現プロジェクトと混ざらないように整理方針を決める。
  - 過去demo entryは履歴として残し、現在の対象は Realtime Question Coach 実運用 ticket として扱う。
- [x] `docs/pattern-picker.md` を現プロジェクトの初期運用に合わせる。
  - 当面は `daily-triage` のみ active
  - `pr-babysitter`, `ci-sweeper`, `dependency-sweeper`, `post-merge-cleanup` は必要になったら有効化
- [x] daily-triageの初回実行手順をREADME化する。
  - `docs/daily-triage-runbook.md` を追加。
- [x] Loop実行時の読み順を明確にする。
  - `docs/daily-triage-runbook.md` の Read Order に明記。
  - 正本: `loop-constraints.md` -> `loop-human-gates.md` -> `loop-budget.md` -> `STATE.md` -> `loop-run-log.md` -> `LOOP.md` -> `docs/pattern-picker.md` -> `docs/patterns/daily-triage.md` -> ticket contract / spreadsheet schema / intake -> AI Work Ticket spreadsheet。

## Phase 2: チケット管理作成

- [x] チケットIDルールを決める。
  - 採用: ProjectGoalのW01-W20に対応する `RQC-W01`, `RQC-W02`, ...
- [x] `RQC-W01` から `RQC-W20` までAI Work Ticketとして起票する。
- [x] `RQC-W01` から `RQC-W20` までActivation Recordを作成する。
  - `approved_autonomy`: `L3`
  - `human_gate_status`: `approved`
  - `base_branch`: `main`
  - `destination_branch`: `main`
  - `max_fix_attempts`: `1`
  - `merge_approval_status`: `not_requested`
- [x] `RQC-W01` から `RQC-W20` まで `ready_for_implementation` に進める。
- [x] `RQC-W01` から `RQC-W20` まで実装前提列を整合する。
  - `cc_sdd_required`: `FALSE`
  - `kiro_required`: `FALSE`
  - `allowed_autonomy`: `L3`
  - `branch_required`: `TRUE`
  - `verifier_required`: `TRUE`
- [x] `RQC-W02` から `RQC-W20` までローカル実装を作成する。
- [x] `RQC-W02` から `RQC-W20` まで基本品質コマンドを実行する。
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`
- [x] `RQC-W01` から `RQC-W20` まで Red Team review を実施し、各ticketで `APPROVE` を取得する。
  - 2026-07-08: 最終 Red Team `APPROVE`。active AI card cap の duplicate-id bypass / pinned demotion を修正し、unit/API regression を追加済み。
- [x] `RQC-W01` から `RQC-W20` まで QA Agent review を実施し、acceptance criteria / required checks / negative case / security-storage-logging の traceability を `passed` にする。
  - 2026-07-08: 最終 QA `QA_PASS`。Session Setup、再判定、mobile viewport、API no-store/no-log sentinel を確認済み。
- [x] `RQC-W01` から `RQC-W20` まで Tester Agent execution を実施し、Playwright/API/unit/manual の実行コマンド、環境、fixture、pass/fail/not_run、trace/screenshot有無を記録する。
  - 2026-07-08: 最終 Tester `TEST_PASS`。`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` の通過証跡を確認済み。
- [x] Red Team / QA / Tester finding がある場合は Purple Team で `fixed_and_retested`、`human_gate_pending`、`blocked` のいずれかに整理する。
  - 2026-07-08: Purple Team `PURPLE_PASS`。全findingを `fixed_and_retested` と整理済み。
- [x] 上記が揃ってから Verifier を再実行し、`APPROVE` を取得する。
  - 2026-07-08: Verifier `VERIFY_PASS`。ローカル厳格ゲート通過。
- [ ] 厳格ゲート完了後にのみ、`RQC-W02` から `RQC-W20` までGoogle Sheetsへ `done` / `passed` / `APPROVE` を書き戻す。
  - 2026-07-08時点では、ローカル厳格ゲートは通過済み。ただし本runではGoogle Sheetsへの `done` / `passed` / `APPROVE` 書き戻しは未実施。
  - 2026-07-09T11:03:02+0900 再開時に Google Sheets connector で metadata / `シート1!A1:C22` の読み取りを試行したが、どちらも HTTP 504 で失敗。書き戻しは未実施のまま。
  - 同run後続で `シート1!A3:C22` を再試行したが、Google Drive connector が `token_expired` / HTTP 401 を返したため未実施のまま。
- [x] real provider readiness の後続チケットを作成する。
  - 2026-07-09: `RQC-W21` から `RQC-W33` までを Google Sheets `シート1!A23:CY35` に起票済み。
  - Requirements Ticket Reviewer、Implementation Readiness Reviewer、Risk And Verification Reviewer の3体から `APPROVE_WITH_MINOR_NOTES` を取得し、minor notes を反映済み。
  - ローカル証跡: `docs/real-provider-readiness-ai-work-tickets.md`
  - 実装範囲: L3 code/docs/tests only。real provider execution、secret、deploy、production、push、merge は禁止。
- [x] `RQC-W21` から `RQC-W33` まで L3 code/docs/tests 範囲で実装する。
  - 2026-07-09: provider runtime/env/security/auth/STT/LLM/report/diagnostics/docs/verification pack を実装済み。
  - real provider execution、secret作成・閲覧・投入、deploy、production、push、merge は未実施。
- [x] `RQC-W21` から `RQC-W33` まで Red Team条件を網羅するテストを作成・成功させる。
  - `npm run typecheck`: passed
  - `npm test`: passed, 18 files / 120 tests
  - `npm run lint`: passed
  - `npm run test:e2e`: passed, 16 Playwright tests
  - `npm run build`: passed
  - Playwrightにはマイク許可とlive audio stream確認を含む。
  - 2026-07-09: token/permission-onlyだったSTT不足を修正。`src/lib/realtime-stt-client.ts` と `src/lib/realtime-stt-client.test.ts` を追加し、browser `MediaStream` -> OpenAI Realtime WebRTC client境界、SDP POST、data channel transcript event、cleanupを確認済み。
- [x] `RQC-W21` から `RQC-W33` まで Security/Privacy、Provider Failure、QA/E2E/UX Red Team の `APPROVE` を取得する。
  - 初回BLOCK: diagnostics raw env露出、sessionId rotation rate-limit bypass、`user_metadata.role` escalation、real-mode no-mock未検証、provider/model未検証、STT timeout未実装、UI dispatch未接続、report failure export可能性、verification pack stale counts。
  - 修正後、3系統すべて全ticket `APPROVE`。
- [x] `RQC-W21` から `RQC-W33` まで QA Agent `passed`、Tester Agent `passed`、Verifier `APPROVE` を取得する。
  - 完了証跡: `docs/real-provider-verification-pack.md`
  - 詳細マトリクス: `docs/real-provider-readiness-ticket-completion-matrix.md`
  - 実行ログ: `loop-run-log.md`
- [x] `RQC-W21` から `RQC-W33` まで Google Sheetsへ `done` / `passed` / `APPROVE` を書き戻す。
  - 2026-07-09: `シート1!A23:C35` を読み戻し、全13件が `done` であることを確認済み。
  - `BY23:CX35` を読み戻し、`done_criteria_met=TRUE`、`verifier_verdict=APPROVE` を確認済み。
- [x] 優先度ルールを決める。
  - `P0`: 実装開始前に必須
  - `P1`: MVP中核
  - `P2`: MVP補助
  - `P3`: 後回し
- [x] status運用を決める。
  - `ready_for_triage`
  - `ticket_builder_required`
  - `needs_human_management`
  - `pending`
  - `ready_for_kiro`
  - `ready_for_implementation`
  - `implementation_in_progress`
  - `under_verification`
  - `human_gate_pending`
  - `done`
- [x] Ticket Builder / Intakeの入力テンプレートを作る。
  - 正本: `docs/ai-work-ticket-operating-rules.md`
- [x] AI Work Ticketの作成テンプレートを作る。
  - 正本: `docs/ai-work-ticket-operating-rules.md`
- [x] feature ticketのDefinition of Readyを定義する。
  - 正本: `docs/ai-work-ticket-operating-rules.md`
- [x] implementation ticketのDefinition of Readyを定義する。
  - 正本: `docs/ai-work-ticket-operating-rules.md`
- [x] Definition of Doneを定義する。
  - 正本: `docs/ai-work-ticket-operating-rules.md`
- [x] Human Communication columnsの書き方を決める。
  - 正本: `docs/ai-work-ticket-operating-rules.md`
- [x] L1 Proposed Updates columnsの書き方を決める。
  - 正本: `docs/ai-work-ticket-operating-rules.md`
- [x] チケットに貼るsource/evidenceのルールを決める。
  - docs link
  - mock link
  - 要件ID
  - 受入基準
  - 関連未決事項
- [x] チケットが大きすぎる場合の分割ルールを決める。
  - 正本: `docs/ai-work-ticket-operating-rules.md`

## Phase 3: 要件の抽象から具体チケット化

抽象要件を、AIがそのまま実装に入れる粒度へ変換する。

分解ルール:

- 1チケットは1つの明確な成果物にする。
- UI、状態管理、API、セキュリティ、テストを混ぜすぎない。
- DB、認証、外部Provider、env varsが関係するものは human gate を明記する。
- 受入基準と必須チェックを必ず書く。
- `scope_out` と `non_goals` を必ず書く。
- 初期実装は STT から始めず、ダミー文字起こしでカード体験を成立させる。

## Phase 4: 初期投入するAI Work Ticket候補

このセクションの `RQC-0001` から `RQC-0015` は初期検討時の旧候補である。現在の実行対象は、Google Sheetsへ起票済みの `RQC-W01` から `RQC-W33` とする。

### RQC-0001: Next.jsアプリ基盤作成（旧候補、RQC-W01へ置換済み）

- `title`: Next.js / React アプリ基盤を作成する
- `work_type`: feature
- `priority`: P0
- `scope_in`
  - Next.jsアプリ作成
  - TypeScript設定
  - lint / format / testの最小構成
  - 基本ディレクトリ構成
- `scope_out`
  - STT接続
  - LLM接続
  - Supabase接続
  - 本番deploy
- `acceptance_criteria`
  - ローカルでアプリが起動する
  - 初期ページが表示される
  - lint / typecheck が通る

### RQC-0002: 画面ルーティングと基本レイアウト（旧候補、RQC-W03/RQC-W06/RQC-W13へ分割済み）

- `title`: ログイン後のSession Setupからセッション画面への動線を実装する
- `priority`: P0
- 対象画面
  - Login
  - Session Setup
  - Realtime Session
  - Session Report
- 受入基準
  - 初期表示はログインまたはSession Setupになる
  - `セッション開始` で文字起こし + AIカード画面へ遷移する
  - `設定へ戻る` でSession Setupへ戻る
  - `終了` でSession Reportへ遷移する

### RQC-0003: Supabase Authと最小権限

- `title`: Supabase Authでログインと最小ロールを実装する
- `priority`: P0
- `human_gate_required`: true
- 対象
  - Supabase Auth
  - `owner` / `user`
  - API routeの認証確認
  - RLS方針
- 禁止
  - 会話本文、音声、AIカード、レポート本文をAuth DBへ保存しない
  - service role keyをブラウザへ出さない
- 受入基準
  - ログインできる
  - 未ログイン時に保護画面へ入れない
  - API routeで認証状態を検証できる

### RQC-0004: Session SetupとsessionProfile生成

- `title`: Session Setup入力からsessionProfileを生成する
- `priority`: P0
- 対象
  - 会話タイプ
  - 業界
  - 相手役職
  - 目的
  - 必ず確認する論点
  - 音声ソース選択
- 受入基準
  - 入力値が `sessionProfile` として構造化される
  - 未入力時のバリデーションがある
  - セッション中はBrowser memoryで保持する

### RQC-0005: プレイブックschemaとresolver

- `title`: 会話タイプ別のplaybook schemaとresolverを作成する
- `priority`: P1
- 対象
  - 商談
  - 要件定義
  - 採用
  - ユーザー調査
- 受入基準
  - `sessionProfile` から適切なplaybookを選べる
  - mustCheck項目をAIカード生成に渡せる

### RQC-0006: ダミー文字起こしとTranscript Store

- `title`: ダミー文字起こしでリアルタイム表示を検証できる状態にする
- `priority`: P0
- 対象
  - partial transcript表示
  - final transcript確定
  - transcript segment model
  - conversation buffer
- 受入基準
  - ダミー発話が時系列で表示される
  - final transcriptだけがAI判定対象になる
  - 会話本文はサーバーDBへ保存されない

### RQC-0007: Coach Card Engine

- `title`: AIカードの状態管理と最大3件制御を実装する
- `priority`: P0
- 対象
  - `active`
  - `queued`
  - `later`
  - `done`
  - `dismissed`
  - `pinned`
  - `dedupeKey`
  - score計算
- 受入基準
  - activeカードは最大3件
  - 高重要度カードが来た場合、低優先カードをqueuedまたはlaterへ移す
  - pinnedは自動降格しない
  - done / dismissed の再表示を抑制する

### RQC-0008: Local Rule Gate

- `title`: LLM呼び出し前のlocal rule gateを実装する
- `priority`: P1
- 対象
  - final transcript追加
  - 重要語
  - 曖昧表現
  - mustCheck gap
  - 話題転換
  - cooldown
- 受入基準
  - partial transcriptではLLMを呼ばない
  - 短すぎる発話や相槌ではLLMを呼ばない
  - 通常は15-30秒に1回以下に抑制する

### RQC-0009: `/api/coach` LLM proxy

- `title`: AIカード生成用のLLM proxy APIを実装する
- `priority`: P1
- `human_gate_required`: true
- 対象
  - LLM API key秘匿
  - JSON schema validation
  - rate limit
  - no-store / no-log方針
- 受入基準
  - ブラウザにLLM API keyが出ない
  - 入出力本文をログに出さない
  - 返却カードがschema検証される
  - 1回の返却候補は最大3件を基本にする

### RQC-0010: Session Report

- `title`: 会議後レポートを生成・表示する
- `priority`: P1
- 対象
  - 聞けたこと
  - 聞けなかったこと
  - 次回確認事項
  - Markdown / JSON export
- 受入基準
  - セッション終了時にレポートが表示される
  - ユーザー明示操作でエクスポートできる
  - 保存しない場合はBrowser memoryを破棄できる

### RQC-0011: Audio Source Manager

- `title`: マイク、Webタブ音声、システム音声の取得UIと権限処理を実装する
- `priority`: P1
- `human_gate_required`: true
- 対象
  - `getUserMedia`
  - `getDisplayMedia`
  - ブラウザ/OS対応確認
  - 非対応時フォールバック
- 受入基準
  - マイク権限を取得できる
  - 対応環境ではWebタブ音声を選択できる
  - 非対応環境ではマイクへフォールバックできる

### RQC-0012: STT短命トークンとCloud STT接続

- `title`: STT短命トークン発行とCloud STTストリーミング接続を実装する
- `priority`: P1
- `human_gate_required`: true
- 対象
  - `/api/stt-token`
  - STT ephemeral token
  - Browser -> Cloud STT direct streaming
  - partial / final受信
- 禁止
  - Vercel / Next APIで長時間音声ストリームを中継しない
  - 音声ファイルを自社クラウドへ保存しない
- 受入基準
  - STT短命トークンを取得できる
  - ブラウザからSTT providerへWSS等で接続できる
  - partial / final transcriptを画面へ反映できる

### RQC-0013: 保存・暗号化・ログ制御

- `title`: 保存禁止対象と通信暗号化、ログ制御を実装・検証する
- `priority`: P0
- `human_gate_required`: true
- 対象
  - HTTPS / WSS / TLS
  - API key秘匿
  - 本文ログ禁止
  - Browser memory基本
  - IndexedDB / File export任意保存
- 受入基準
  - 平文HTTPで音声、文字起こし、LLM入力、認証情報を送らない
  - Vercel logsに本文が出ない
  - 認証DBに会話本文、音声、AIカード、レポート本文が保存されない

### RQC-0014: 評価データとAIカード品質評価

- `title`: AIカード品質評価用のサンプルとrubricを作る
- `priority`: P2
- 対象
  - transcript samples
  - expected cards
  - useful / bad case分類
  - mustCheck回収率
- 受入基準
  - ダミー文字起こしでカード品質を評価できる
  - 悪いカードの分類ができる
  - prompt / playbook改善に使える

### RQC-0015: Vercel環境変数とdeploy手順

- `title`: Vercel環境変数とdeploy手順を整備する
- `priority`: P2
- `human_gate_required`: true
- 対象
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STT_API_KEY`
  - `STT_REGION`
  - `RQC_LLM_PROVIDER`
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `LLM_MODEL_REALTIME`
  - `LLM_MODEL_REPORT`
  - `RETENTION_MODE`
- 受入基準
  - secretをリポジトリへコミットしない
  - ブラウザへ出してよいenvと出してはいけないenvが分かれている
  - deploy前の確認項目がある

## Phase 5: スプレッドシート投入順

- [x] `RQC-W01` から `RQC-W20` までを投入する。
- [x] `RQC-W01` から `RQC-W20` までを `ready_for_implementation` に進める。
- [x] `RQC-W01` から `RQC-W20` までにL3 Activation Recordを作成する。
- [x] 外部Provider、認証、保存/ログ/security、env/deploy readinessが関係するticketは `human_gate_required = true` にする。
- [x] STT/LLM provider未決定部分はmock-first、adapter境界、human gateで扱う。
- [x] まずダミー文字起こしでUI/カード体験を成立させる順序にする。
- [x] STT接続はCoach Card EngineとLocal Rule Gateが動いてから統合する順序にする。

## Phase 6: 初回Loop実行

- [x] シートへ初期チケットを投入する。
- [x] 全チケットのActivation Recordを作成する。
- [x] `STATE.md` に次回引き継ぎを残す。
- [x] `RQC-W01` をL2/L3 on-demand実装として開始する。
- [x] `RQC-W02` から `RQC-W20` までをhuman-approved batch overrideでローカル実装する。
- [x] 実装単位ごとに `required_checks`, `acceptance_criteria`, `approval_scope` を一次確認する。
- [x] 実装単位ごとに Red Team `APPROVE`、QA `passed`、Tester `passed`、Verifier `APPROVE` を取得する。
  - 2026-07-08 strict verification rerun で `RQC-W01` から `RQC-W20` は Red Team `APPROVE`、QA `QA_PASS`、Tester `TEST_PASS`、Purple `PURPLE_PASS`、Verifier `VERIFY_PASS` を取得済み。
  - 2026-07-09 real provider readiness run で `RQC-W21` から `RQC-W33` は Security/Privacy、Provider Failure、QA/E2E/UX Red Team が全件 `APPROVE`。QA、Tester、Verifier gateも通過済み。
- [x] `loop-run-log.md` に実行結果を残す。
- [ ] 厳格ゲート完了後、Google Sheets のcanonical statusをローカル実装結果へ同期する。
  - `RQC-W02` から `RQC-W20` の同期が Google Drive connector 認証期限切れで未完了。
- [ ] scheduled `daily-triage` は必要になった時点でL1 report-onlyとして実行する。

## Phase 7: 実装開始前の未決事項

- [x] Supabase Auth / Supabase Postgres を正式採用するか。
  - Google OAuth は Supabase Auth を採用。Supabase Postgres は認証・権限メタデータ用途に限定し、会話本文、音声、AIカード本文、LLM入出力、report本文は保存しない。
- [x] STT Providerを決める。
  - 初期real候補は OpenAI STT / Realtime transcription。実装は `RQC_STT_PROVIDER=mock|openai` のadapter境界を維持する。
- [x] LLM Providerとモデルを決める。
  - 初期real候補はOpenAI、代替候補はAnthropic Claude。実model名は `LLM_MODEL_REALTIME` / `LLM_MODEL_REPORT` で差し替える。provider/model family不一致は設定エラーにする。
- [x] STT/LLM providerの no-training / retention / no-store 設定を確認する。
  - 2026-07-09時点の公式情報を `docs/provider-privacy-and-browser-audio.md` に記録。標準で学習利用されないが、標準retentionはゼロではないため、ZDR/DPA等はhuman-owned確認。
- [x] Webタブ音声 / システム音声の対応ブラウザ範囲を確認する。
  - 2026-07-09時点のMDN/Chrome公式情報を `docs/provider-privacy-and-browser-audio.md` に記録。MVPはmicrophone primary、display audioはChrome/Chromium-first best-effort、fallback必須。
- [x] IndexedDB保存をMVPに含めるか、exportのみとするか。
  - MVPではIndexedDBを必須化しない。Browser memory基本、Markdown/JSON export、ユーザー明示操作によるbrowser local saveに限定する。正本: `docs/data-contracts.md`
- [x] local rule gate の初期閾値を決める。
  - cooldownは15秒。important / ambiguous / must-check gapの初期scoreと発火・抑制条件を `docs/data-contracts.md` に明記。
- [x] Coach Card score の計算式を決める。
  - local rule seed score、LLM score丸め、50未満破棄、active上限時のscore降順、pinned保護を `docs/data-contracts.md` に明記。
- [x] `coachCard`, `sessionProfile`, `sessionReport` のJSON schemaを確定する。
  - TypeScript型を正本とし、レビュー用データ契約を `docs/data-contracts.md` に明記。

## 直近の推奨順

1. Red Team / QA Agent / Tester Agent / Verifier の厳格ゲートで `RQC-W01` から `RQC-W20` を再検証する。
2. 不足している Playwright/API/unit/security/responsive/audio permission/export-discard の試験を追加または実行する。
3. Red Team `APPROVE`、QA `passed`、Tester `passed`、Verifier `APPROVE` が揃ったticketだけ、Google Sheets上で `done` / `passed` / `APPROVE` に同期する。
4. 同期後、`シート1!A3:C22` と execution columns を読み戻し確認する。
5. scheduled daily-triage は引き続きL1 report-onlyで扱う。
