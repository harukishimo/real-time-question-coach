# Loop State - Realtime Question Coach Loop Engineering

Last loop run: RQC-W21..RQC-W33 L3 batch completed
Last state update: 2026-07-09

このファイルは、Loop がセッションをまたいで読む状態ログである。現在の設計作業の TODO や作成予定ファイル一覧は `TODO.md` と `docs/loop-engineering-todo.md` を参照する。

## Loop Run State

- `RQC-W01` から `RQC-W20` まで、ローカル実装と厳格化した完了ゲートを通過済み。
- 2026-07-09 の最新人間指示により、外部サービスの環境変数を設定すれば real provider 動作確認へ進める一歩手前まで持っていく後続チケットとして、`RQC-W21` から `RQC-W33` までを Google Sheets `シート1!A23:CY35` に起票済み。
- `RQC-W21` から `RQC-W33` はすべて実装・検証完了。Google Sheets `シート1!A23:CY35` は `status=done`、`done_criteria_met=TRUE`、`verifier_verdict=APPROVE` へ書き戻し済み。
- 2026-07-09 の人間指摘「Web音声はどのように取得するのか / 次の実装対象ではない」により、STT接続の不足を修正した。現在は browser `MediaStream` を保持し、mock時は停止、`RQC_STT_PROVIDER=openai` 時は短命tokenで OpenAI Realtime WebRTC へ直接接続する client 境界がある。Next API は音声bodyを受け取らない。
- 上記STT修正の確認として、`npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build` が通過。unit/API は 18 files / 120 tests、Playwright は 16 / 16。
- `RQC-W21` から `RQC-W33` は、`allowed_autonomy=L3`、`approved_autonomy=L3`、`approved_by=human`、`approval_source=current_thread`、`human_gate_status=approved` の範囲で実行した。
- `RQC-W21` から `RQC-W33` の approval_scope は code/docs/tests only。real provider execution、secret作成・閲覧・投入、deploy、production operation、push、merge は明示的に除外する。
- `RQC-W21` から `RQC-W33` は、Requirements Ticket Reviewer、Implementation Readiness Reviewer、Risk And Verification Reviewer の3体から `APPROVE_WITH_MINOR_NOTES` を取得し、minor notes を反映して起票済み。
- `RQC-W21` から `RQC-W33` のローカル起票証跡は `docs/real-provider-readiness-ai-work-tickets.md` に作成済み。
- `RQC-W21` から `RQC-W33` の完了証跡は `docs/real-provider-verification-pack.md`、`docs/real-provider-readiness-ticket-completion-matrix.md`、`loop-run-log.md` に記録済み。
- 最終確認コマンドは `npm run typecheck`、`npm test`、`npm run lint`、`npm run test:e2e`、`npm run build` がすべて通過。unit/API は 18 files / 120 tests、Playwright は 16 / 16。
- Security/Privacy Red Team、Provider Failure Red Team、QA/E2E/UX Red Team は `RQC-W21` から `RQC-W33` まで全件 `APPROVE`。QA、Tester、Verifier gate も通過済み。
- 2026-07-09 の人間指摘により、`RQC-W28` と `RQC-W30` は OpenAI 固定ではなく provider-neutral な `LLM coach/report adapter` として扱う。初期real候補はOpenAI、代替候補はAnthropic Claude。`RQC_LLM_PROVIDER=mock|openai|anthropic`、`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`LLM_MODEL_REALTIME`、`LLM_MODEL_REPORT` の境界を前提にする。
- 2026-07-08T21:42:36+0900 の strict verification rerun で、Red Team `APPROVE`、QA `QA_PASS`、Tester `TEST_PASS`、Purple `PURPLE_PASS`、Verifier `VERIFY_PASS` を取得済み。
- 2026-07-08 の `RQC-W02` から `RQC-W20` strict verification run では、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e` が通過。unit は 8 files / 43 tests、Playwright は 10 / 10。
- Google Sheets への `RQC-W02` から `RQC-W20` の done 書き戻しは本runでは行っていない。同期する場合は `verification_evidence` / `done_evidence` に `loop-run-log.md` の構造化証跡を転記する。
- Google Sheets connector で AI Work Ticket spreadsheet の metadata / header read / ticket write / read-back は確認済み。
- 対象 spreadsheet は、1行目がheader、2行目が説明、`シート1!A3:CY35` に `RQC-W01` から `RQC-W33` までの33件を起票済み。
- `RQC-W21` から `RQC-W33` は `done`。`RQC-W02` から `RQC-W20` のGoogle Sheets書き戻しは過去runの未同期事項として残る。
- `RQC-W01` から `RQC-W20` まで、ticket-level Activation Record を作成済み。
- Activation Record は `approved_autonomy=L3`, `approved_by=human`, `approved_at=2026-07-08T17:15:10+09:00`, `approval_source=current_thread`, `human_gate_status=approved`。
- 各ticketの `approval_scope` は、当該ticketの `scope_in` / `acceptance_criteria` に限定し、`scope_out` / `non_goals` の遵守を要求する。
- 全ticketで `codecommit_pr_creation_allowed=false`, `codecommit_reviewer_comment_allowed=false`, `merge_approval_status=not_requested`。
- `work_type`, `suggested_next_action`, `cc_sdd_required`, `kiro_required`, `implementation_agent_type`, `allowed_autonomy`, `branch_required`, `verifier_required`, `loop_policy`, `triage_notes` は列定義に合わせて整合済み。
- Activation Record の共通 `agent_plan`, `allowed_actions`, `explicitly_forbidden_actions` は `loop-run-log.md` の `2026-07-08T17:15:10+09:00-activation-records-l3-all-tickets` に記録済み。
- Phase 0 は完了扱い。現シートをそのまま正として使う。
- Project name は `Realtime Question Coach` とする。
- 本PJでは最大L3までのエージェント自律度を許可済み。
- 2026-07-08T17:44:48+09:00 の人間指示により、`RQC-W02` から `RQC-W20` までを同一 on-demand L3 execution series で逐次実行する budget override を許可し、2026-07-08T18:00:17+09:00 にローカル実装と基本品質コマンド実行まで完了した。
- 2026-07-08 の追加指示により、完了条件を厳格化した。以後、実装agentの自己判定やhappy path E2E 1本では `done` にできない。今回のrunでは Red / QA / Tester / Purple / Verifier の構造化ゲートを通過済み。

## Persistent Context

- Primary loop: Daily Orchestration Loop
- Cadence: 1回/日
- Max approved autonomy: L3
- Scheduled default autonomy: L1 report-only
- Active scaffolded pattern: `daily-triage`
- Orchestrator entrypoint: `docs/pattern-picker.md`
- Run log: `loop-run-log.md`
- AI Work Ticket spreadsheet source: `https://docs.google.com/spreadsheets/d/1y7UEjCTejSJXgLWmvA0SEKOHurl8C5QvtfxMf87ruqc/edit`
- AI Work Ticket spreadsheet sheet: `シート1`
- AI Work Ticket spreadsheet mode: 現シートをそのまま使用する

## Autonomy Notes

- L1 scheduled daily-triage は Human Communication columns と L1 Proposed Updates columns までを扱う。
- L2 / L3 は、対象 AI Work Ticket ごとの Activation Record がある場合だけ on-demand で実行する。
- L3 でも自動 merge、deploy、release、production 操作、secret 読み取り、承認範囲外の追加実装は行わない。
- CodeCommit PR 作成や reviewer comment 投稿は、L3 かつ該当 permission が Activation Record に明記されている場合だけ扱う。現Activation Recordではどちらも許可していない。

## High Priority

- Google Sheets へ `RQC-W02` から `RQC-W20` の `verification_evidence` / `done_evidence` を同期するか判断する。
  - 2026-07-09T11:03:02+0900 の再開確認では Google Sheets connector が metadata / range read ともに HTTP 504 で失敗したため、同期作業は未完了。
  - 後続の再試行では Google Drive connector が `token_expired` / HTTP 401 を返したため、再ログイン後に再開が必要。
- repository action が必要な場合は、人間が明示するまで push / PR / merge / deploy は行わない。

## Watch List

- `loop-constraints.md` と `loop-human-gates.md` は 2026-07-09T11:03:02+0900 の再開runで Realtime Question Coach 固有の認証、Supabase、STT/LLM、会話データ、ログ、暗号化、deploy 制約へ置き換え済み。
- `docs/daily-triage-runbook.md` は 2026-07-09T11:03:02+0900 の再開runで追加済み。scheduled `daily-triage` の初回実行手順、読み順、L1 write boundary、停止条件を定義している。
- `docs/ai-work-ticket-operating-rules.md` は 2026-07-09T11:03:02+0900 の再開runで追加済み。priority/status、Ticket Builder template、AI Work Ticket template、DoR/DoD、Human Communication、L1 Proposed Updates、source/evidence、ticket splitting rules を定義している。
- `docs/data-contracts.md` は 2026-07-09T11:03:02+0900 の再開runで追加済み。Session Setup input、sessionProfile、transcriptSegment、coachCard、local rule gate、sessionReport、storage/provider schema boundary を現在の実装に合わせて定義している。
- `docs/provider-privacy-and-browser-audio.md` は 2026-07-09T11:03:02+0900 の再開runで追加済み。OpenAI / Anthropic のno-training・retention・ZDR境界、OpenAI STT境界、microphone / display audioのMVP対応範囲を公式資料ベースで整理している。
- L3許可と `RQC-W01` から `RQC-W20` までの個別 ticket Activation Record は反映済み。承認期限は `2026-07-15T23:59:59+09:00`。
- `loop-budget.md` の Human-Approved MVP Completion Batch はローカル実装完了により通常limitへ戻した。今後の再検証は厳格ゲートの対象であり、単純なGoogle Sheets write-backだけではない。
- `RQC-W21` から `RQC-W33` はGoogle Sheetsへ `done` / `passed` / `APPROVE` を書き戻し、読み戻し確認済み。
- `agent_plan`, `allowed_actions`, `allowed_mutations` は spreadsheet列として追加しない。必要な場合は最新の人間指示、`approval_scope`, `handoff_notes`, `triage_notes`, `loop-run-log.md` に残す。
- TODO内の旧 `RQC-0001` から `RQC-0015` の候補は履歴扱い。実行対象はGoogle Sheets上の `RQC-W01` から `RQC-W33`。

## Recent Noise

- なし。
