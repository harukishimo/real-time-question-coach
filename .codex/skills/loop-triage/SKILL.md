---
name: loop-triage
description: >
  Execute the Realtime Question Coach daily-triage Loop Pattern for AI Work Ticket spreadsheets. Use when the Orchestrator starts daily-triage, needs L1 report-only ticket triage, checks AI Work Ticket structure, proposes status/comment updates, routes tickets to Ticket Builder, Human, Kiro, Implementation Agent, or records Pattern signals in STATE.md and loop-run-log.md.
---

# Loop Triage Skill

Realtime Question Coach の `daily-triage` Loop Pattern を実行する。`daily-triage` は agent 名ではなく Loop Pattern である。Pattern Picker が `daily-triage` を選んだ後、この skill は AI Work Ticket 一覧を棚卸しし、各 ticket の status 更新案、AI comment 案、次 owner、Pattern signal を作る。

現時点では L1 report-only として動く。実装、branch 作成、PR 作成、merge、AI Work Ticket spreadsheet の canonical status 更新、external issue / PR comment 投稿は行わない。

L1 は人間が判断できるように、AI Work Ticket spreadsheet の Human Communication columns と L1 Proposed Updates columns だけを書き込んでよい。許可列は `ai_comment_type`, `ai_comment_summary`, `decision_needed`, `questions_for_human`, `default_assumption`, `reply_format`, `proposed_*`, `last_loop_run_id`, `triage_notes` に限定する。

## Read Order

開始時に必ず次を読む。

1. `loop-constraints.md`
2. `loop-human-gates.md`
3. `loop-budget.md`
4. `loop-run-log.md`
5. `STATE.md`
6. `docs/patterns/daily-triage.md`
7. `docs/ai-work-ticket-contract.md`
8. `docs/ai-work-ticket-spreadsheet-schema.md`
9. `docs/ticket-builder-intake.md`
10. `docs/pattern-picker.md`
11. `docs/loop-autonomy-contract.md`
12. `docs/loop-execution-contract.md`
13. AI Work Ticket spreadsheet

必要に応じて `LOOP.md`, `.kiro/specs/`, `.kiro/steering/`, `.codex/agents/verifier.toml`, ticket の `source_link` / `evidence_links` を読む。

## Hard Boundaries

- Pattern Picker の代わりに Pattern 選択基準を変更しない。
- raw human request を AI Work Ticket として扱わない。
- AI Work Ticket の不足 field を推測だけで埋めない。
- L1 では spreadsheet の canonical `status`, `next_owner`, ticket 本体、scope、risk、acceptance criteria を更新しない。
- L1 では external issue comment や PR comment へ直接書き戻さない。
- L1 では `STATE.md`, `loop-run-log.md`, AI Work Ticket spreadsheet の許可列以外を更新しない。
- コード変更、branch 作成、commit、push、PR 作成、merge、deploy を行わない。
- secret、credential、production data、production console を読まない。
- deny list に該当する操作を実行しない。

## Guard Check

次に該当する場合は実行せず、可能な範囲で `loop-run-log.md` に no-op / blocked 理由を残す。

- `loop-pause-all` が有効。
- 当日の budget を超過している。
- `loop-constraints.md`, `STATE.md`, `loop-run-log.md` を読めない。
- AI Work Ticket spreadsheet にアクセスできない。
- Pattern 起動に必要な state file、skill、connector がない。
- 実行可能な作業が deny list に該当するものだけである。

## Workflow

### 1. Ticket Inventory

AI Work Ticket spreadsheet を 1 行 1 ticket として読む。外部 issue / repository issue 一覧を AI Work Ticket 一覧として扱わない。外部 issue、PR、repository service 上の情報は `source_link` または `evidence_links` の参照情報である。

対象 status:

- `ready_for_triage`
- `ticket_builder_required`
- `needs_human_management`
- `blocked_by_constraints`
- `pending`
- `ready_for_kiro`
- `ready_for_implementation`
- `human_gate_pending`

終端 status:

- `done`
- `no_action_required`

### 2. Structural Check

各 ticket について次を確認する。

- `docs/ai-work-ticket-spreadsheet-schema.md` の Required Completeness を満たしている。
- 新機能、仕様変更、責務境界がある場合は Feature Ticket Completeness を満たしている。
- `source_summary` が raw human request の丸貼りではない。
- `overview`, `background_purpose`, `problem`, `current_state`, `desired_state` が分かれている。
- `scope_in`, `scope_out`, `non_goals` がある。
- `acceptance_criteria`, `required_checks`, `test_perspectives` が検証可能である。
- `agent_alignment` があり、daily-triage、Kiro、実装 agent が同じ intent を読める。

構造不足の場合は実装や Kiro に進めない。`proposed_status = ticket_builder_required` とし、Ticket Builder / Intake への差し戻し理由を作る。

### 3. Constraint And Human Gate Check

各 ticket について `loop-constraints.md` を確認する。

deny list に該当する場合:

- `proposed_status = blocked_by_constraints`
- `proposed_next_owner = Human` または `Orchestrator`
- `constraint_block` 相当の理由を作る
- 安全な次 step を明記する

human gate に該当する場合:

- `proposed_status = needs_human_management` または `human_gate_pending`
- `human_management` 相当の理由を作る
- `decision_needed`, `affected_scope`, `options`, `recommended_next_owner` を明記する

{{MONEY_DOMAIN}}、PDF は path だけで判定しない。{{MONEY_DOMAIN}}計算、承認、保存、外部出力、PDF 生成物、宛先、法務・{{ACCOUNTING_DOMAIN}}上の意味に影響する場合に human gate とする。単純な文言追加や表示ラベル変更のみの場合は、この条件だけでは停止しない。

daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master、DB / infrastructure は厳格に扱う。

### 4. Work Type And Next Action

`work_type` を次のいずれかに分類する。

- `feature`
- `bug_fix`
- `spec_refinement`
- `docs`
- `test`
- `ops`
- `cleanup`
- `dependency`
- `unknown`

`suggested_next_action` を次のいずれかにする。

- `return_to_builder`
- `needs_human`
- `refine_spec`
- `ready_to_implement`
- `mark_pending`
- `mark_no_action_required`
- `block_by_constraints`
- `no_op`

### 5. cc-sdd / Kiro Decision

次に該当する場合は `cc_sdd_required = true` または `kiro_required = true` と扱う。

- 新機能である。
- 仕様変更である。
- 責務境界、権限、DB、外部連携、画面要件、テスト方針に影響する。
- requirements / design / tasks に分解した方が認識ズレを減らせる。
- AI Work Ticket はあるが、仕様判断が未確定である。

`ready_for_kiro` を提案できる条件:

- `overview`, `background_purpose`, `problem`, `current_state`, `desired_state` が明確。
- `scope_in`, `scope_out`, `non_goals` がある。
- Kiro で詰めるべき unknown が明示されている。
- human review が必要な phase が分かる。
- 実装ではなく requirements / design / tasks の作成または更新が requested outcome として扱える。

`ready_for_implementation` を提案できる条件:

- `docs/ai-work-ticket-contract.md` の Ready For Implementation を満たす。
- blocking unknown がない。
- `cc_sdd_required = false`、または Kiro spec / human approval が完了している。
- constraints と human gate が確認済み。
- L2 以上が許可されている。

L1 では `ready_for_kiro` や `ready_for_implementation` を直接書き戻さず、`proposed_ticket_updates` に記録する。

### 6. Status Proposal

各 ticket について、次のいずれかの `proposed_status` を作る。

- `ticket_builder_required`
- `needs_human_management`
- `blocked_by_constraints`
- `out_of_scope`
- `pending`
- `no_action_required`
- `ready_for_kiro`
- `ready_for_implementation`
- `human_gate_pending`

status だけを提案してはいけない。必ず理由、次 owner、AI comment 案、根拠を残す。

### 7. Human-Facing Comment

人間に伝える必要がある場合は、AI Work Ticket spreadsheet の Human Communication columns を更新する。あわせて `proposed_ticket_comments` を作り、`loop-run-log.md` に同じ判断を残す。

コメントには次を含める。

- 現在の判断
- なぜその判断になったか
- 人間に決めてほしいこと
- 推奨 default
- 回答形式
- 次 owner

agent 内部用の長い YAML をそのまま本文にしない。人間が読める文章にする。

### 8. Pattern Signal Handoff

未 scaffold Pattern signal は直接処理せず、report-only で記録する。

| Signal | Record as |
| --- | --- |
| PR review comment、conflict、approval、merge readiness | `pr_babysitter` |
| CI failure、workflow failure、test failure log | `ci_sweeper` |
| dependency update、security alert、lockfile churn、dependency noise | `dependency_sweeper` |
| merge 後 follow-up、不要 branch、残作業、技術的負債 | `post_merge_cleanup` |
| release note、changelog 対象 | `changelog_drafter` |

## L1 Output

L1 report-only では、AI Work Ticket spreadsheet の許可列に人間向け comment と提案情報を書き、`loop-run-log.md` に次の構造を残す。

```yaml
daily_triage_result:
  run_id:
  run_at:
  autonomy_level: L1
  startup_mode: report_only
  tickets_scanned:
  tickets_actionable:
  tickets_blocked:
  proposed_ticket_updates:
    - ticket_id:
      current_status:
      proposed_status:
      proposed_next_owner:
      reason:
      evidence:
      risk_level:
      human_gate_required:
      suggested_next_action:
  proposed_ticket_comments:
    - ticket_id:
      comment_type:
      summary:
      decision_needed:
      questions:
      reply_format:
  spreadsheet_writeback:
    enabled: true
    allowed_columns:
      - ai_comment_type
      - ai_comment_summary
      - decision_needed
      - questions_for_human
      - default_assumption
      - reply_format
      - proposed_*
      - last_loop_run_id
      - triage_notes
    rows_updated:
      - ticket_id:
        columns:
        reason:
  pattern_signals:
    pr_babysitter:
    ci_sweeper:
    dependency_sweeper:
    post_merge_cleanup:
    changelog_drafter:
  state_updates:
    high_priority:
    watch_list:
    recent_noise:
  no_ops:
  blocked:
```

`STATE.md` には、次回 Loop が参照すべき永続情報だけを残す。

- High Priority
- Watch List
- Recent Noise
- 未 scaffold Pattern signal
- blocked / pending の継続事項

TODO や一時的な作業メモは `STATE.md` に残さない。

## Completion Checklist

完了前に次を確認する。

- guard check の結果を記録した。
- 読んだ source と ticket 件数を記録した。
- 各 actionable ticket に status 更新案または no-op 理由がある。
- human gate / deny list / pending / no action の理由が人間に読める。
- Kiro / implementation / Ticket Builder / Human の next owner が分かる。
- AI Work Ticket spreadsheet の許可列に、人間が判断できる comment / proposed update がある。
- `STATE.md` と `loop-run-log.md` に次回 Loop への引き継ぎがある。
