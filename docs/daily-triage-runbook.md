# Daily Triage Runbook

このRunbookは、Realtime Question Coach の scheduled `daily-triage` を初回または手動で実行するための手順である。

`daily-triage` は agent ではなく Loop Pattern である。実装、branch作成、PR作成、merge、deploy は行わない。通常運用は L1 report-only とし、AI Work Ticket の状態を読み、次actionの提案と証跡を残す。

## Preconditions

開始前に次を満たすこと。

- `loop-pause-all` が最新指示、`STATE.md`、`loop-constraints.md`、チケットに存在しない。
- `loop-constraints.md` と `loop-human-gates.md` を読める。
- `loop-budget.md` 上、scheduled `daily-triage` の実行回数とtoken budgetが残っている。
- AI Work Ticket spreadsheet のURL、sheet名、対象範囲が `STATE.md` または `LOOP.md` から確認できる。
- Google Sheets connector が読めない場合は、実装やcanonical status更新へ進まず、`blocked_by_connector` として `loop-run-log.md` に残す。

## Read Order

必ず次の順で読む。

1. `loop-constraints.md`
2. `loop-human-gates.md`
3. `loop-budget.md`
4. `STATE.md`
5. `loop-run-log.md`
6. `LOOP.md`
7. `docs/pattern-picker.md`
8. `docs/patterns/daily-triage.md`
9. `docs/ai-work-ticket-contract.md`
10. `docs/ai-work-ticket-spreadsheet-schema.md`
11. `docs/ticket-builder-intake.md`
12. AI Work Ticket spreadsheet metadata
13. 対象ticketの bounded range

L2 / L3 実装へ進む場合は、このRunbookではなく `docs/loop-execution-contract.md` と対象ticketのActivation Recordを読む。

## Execution Steps

1. Constraints loaded の一行確認を出す。
2. `STATE.md` の High Priority / Watch List / Recent Noise を確認する。
3. `loop-budget.md` の scheduled daily-triage budget を確認する。
4. `docs/pattern-picker.md` に従い、今回のPatternが `daily-triage` でよいか判断する。
5. AI Work Ticket spreadsheet のmetadataを読む。
6. 対象ticket範囲をbounded rangeで読む。全grid検索や空query検索をしない。
7. 各ticketについて、構造、scope、risk、human gate、required checks、next ownerを確認する。
8. L1で書ける範囲に限定し、Human Communication columns / L1 Proposed Updates columns の更新案を作る。
9. 直接canonical statusを書き換えない。L2 / L3 Activation Recordがない限り、`status=done` などは提案に留める。
10. `loop-run-log.md` に、入力、判断、提案、未実行操作、blockerを記録する。
11. `STATE.md` に、次回引き継ぐHigh Priority / Watch List / Recent Noiseだけを更新する。

## Output Requirements

run終了時に次を残す。

- run id
- selected pattern
- autonomy level
- read sources
- tickets inspected
- proposed status / next owner / human comment
- human gate判定
- blocked理由
- not performed list
- next recommended action

## Done Criteria

`daily-triage` は次を満たしたとき完了扱いにする。

- required read orderを満たしている。
- AI Work Ticket spreadsheetを読めた、または読めなかった理由を記録している。
- 対象ticketごとの next owner / proposed action / blocker が明確である。
- L1の書き込み範囲を超えていない。
- `STATE.md` と `loop-run-log.md` が次回再開できる粒度で更新されている。

## Stop Conditions

次の場合は停止し、実装へ進まない。

- `loop-pause-all` が有効。
- secret、production、deploy、merge、push、real provider execution が必要。
- Google Sheets connector が継続的に失敗し、対象ticketを確認できない。
- AI Work Ticket が構造不足で、Ticket Builder / Intakeへ戻す必要がある。
- human gate対象だが、承認scopeが存在しない。
- budgetを超過している。

## Spreadsheet Write Boundary

L1で許可されるのは、Human Communication columns と L1 Proposed Updates columns のみである。

L2 / L3 Activation Record がある場合だけ、次のcanonical execution fieldsを更新できる。

- `status`
- `verification_result`
- `done_criteria_met`
- `done_evidence`
- `verifier_verdict`
- `verifier_notes`
- `last_loop_run_id`

ticket本文、source、scope、risk、acceptance criteriaは原則更新しない。構造不足を見つけた場合は Ticket Builder / Intake に戻す。
