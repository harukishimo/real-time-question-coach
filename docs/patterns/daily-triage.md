# Daily Triage Loop Pattern

## Purpose

`daily-triage` は、1日1回の Daily Orchestration Loop で AI Work Ticket 一覧を棚卸しし、各 ticket の構造、risk、constraints、次 action を判断する Loop Pattern である。

`daily-triage` は agent 名ではない。Orchestrator Agent が `docs/pattern-picker.md` に従ってこの Pattern を起動し、この Pattern 内で AI Work Ticket の検査と status 更新案を作る。

現時点の運用は L1 report-only である。実装、branch 作成、PR 作成、merge、canonical ticket field への直接書き戻しは行わない。

ただし、Google Sheets connector の共有権限は Editor を前提に整備する。L1 では人間が判断できるように、Human Communication columns と L1 Proposed Updates columns への write-back を許可する。Editor 権限があっても、L1 が更新できるのは `ai_comment_type`, `ai_comment_summary`, `decision_needed`, `questions_for_human`, `default_assumption`, `reply_format`, `proposed_*`, `last_loop_run_id`, `triage_notes` に限る。

## Responsibility Boundary

| Component | Responsibility |
| --- | --- |
| Orchestrator Agent | `docs/pattern-picker.md` を読み、`daily-triage` を起動するか判断する |
| Pattern Picker | どの Loop Pattern を起動するかだけを決める |
| `daily-triage` Pattern | AI Work Ticket の構造検査、status 更新案、Kiro / 実装 / human gate の分岐判断を行う |
| Ticket Builder / Intake | raw human request を AI-readable な AI Work Ticket に変換する |
| Kiro | `daily-triage` から必要に応じて呼び出される仕様精緻化 tool |
| Implementation Agent | `ready_for_implementation` 以降で、許可された autonomy と constraints の範囲だけ実装する |
| Verifier Agent | L2 以降で scope、test、risk、deny list を検査する |

`daily-triage` は Ticket Builder の代替ではない。構造不足の AI Work Ticket を見つけた場合、内容を勝手に補完せず、`ticket_builder_required` の更新案と差し戻し理由を作る。

## When To Run

`daily-triage` は次の signal がある場合に起動する。

- AI Work Ticket 一覧に `ready_for_triage`, `pending`, `needs_human_management`, `blocked_by_constraints` などの未完了 item がある。
- AI Work Ticket の構造不足、raw human request 混入、human gate 要否を確認する必要がある。
- 新機能、仕様変更、責務境界があり、cc-sdd / Kiro に渡すか判断する必要がある。
- 他の専用 Pattern を起動するほど signal が明確ではない。
- 初回 Loop または1日1回の棚卸しを行う。
- 未 scaffold の Pattern signal を report-only で記録する必要がある。

## When Not To Run

次の場合、`daily-triage` は起動しない、または no-op として終了する。

- `loop-pause-all` が有効である。
- `loop-budget.md` 上の当日 budget を超過している。
- `loop-constraints.md` の deny list に該当する作業しかない。
- AI Work Ticket 一覧が存在しない、または connector / file access がない。
- `STATE.md` または `loop-run-log.md` を読めない。
- `daily-triage` より優先度の高い scaffold 済み Pattern があり、その Pattern を安全に起動できる。

現時点では scaffold 済み active Pattern が `daily-triage` のみであるため、他 Pattern signal があっても直接起動せず、`daily-triage` の report-only に記録する。

## Required Inputs

`daily-triage` は開始時に次を読む。

1. `loop-constraints.md`
2. `loop-human-gates.md`
3. `loop-budget.md`
4. `loop-run-log.md`
5. `STATE.md`
6. `docs/ai-work-ticket-contract.md`
7. `docs/ai-work-ticket-spreadsheet-schema.md`
8. `docs/ticket-builder-intake.md`
9. `docs/pattern-picker.md`
10. `docs/loop-autonomy-contract.md`
11. `docs/loop-agent-registry.md`
12. `docs/loop-agent-behavior-contracts.md`
13. `docs/loop-execution-contract.md`
14. AI Work Ticket spreadsheet

必要に応じて次も参照する。

- `LOOP.md`
- `.kiro/specs/`
- `.kiro/steering/`
- `.codex/agents/verifier.toml`
- PR / CI / commit / evidence links

## Non-Goals

`daily-triage` は次を行わない。

- Pattern Picker の代わりに全 Pattern の優先順位を変更しない。
- raw human request を AI Work Ticket として登録しない。
- AI Work Ticket の不足項目を推測だけで埋めない。
- コード変更、branch 作成、commit、push、PR 作成、merge を行わない。
- L1 では spreadsheet の canonical `status` を直接更新しない。
- L1 では `title`, `source_*`, `overview`, `scope_*`, `risk_*`, `acceptance_criteria` などの AI Work Ticket 本体を直接更新しない。
- L1 では external issue / PR comment を直接投稿しない。
- L1 でも read-only / report-only agent は budget 内で起動できる。ただし code、branch、canonical ticket fields、external state は変更しない。
- L1 では AI Work Ticket spreadsheet の Human Communication columns と L1 Proposed Updates columns だけを更新できる。
- CI failure の原因調査や修正を主目的にしない。該当する場合は `ci-sweeper` signal として記録する。
- PR review comment / conflict / approval / merge readiness の継続監視を主目的にしない。該当する場合は `pr-babysitter` signal として記録する。

## Autonomy Behavior

| Level | Allowed | Not allowed |
| --- | --- | --- |
| L0 | 読み取り、要約、質問作成 | file 更新、ticket 更新、実装 |
| L1 | `STATE.md` と `loop-run-log.md` への report-only 記録、read-only / report-only agent 起動、AI Work Ticket spreadsheet の Human Communication columns と L1 Proposed Updates columns 更新 | canonical ticket status 更新、AI Work Ticket 本体の直接更新、branch 作成、実装、PR 作成、external issue / PR comment 投稿 |
| L2 | human approval 後の ticket status 更新、Kiro workflow 起動提案、実装 agent / verifier 起動提案 | merge、production deploy、human gate 対象の自律実装 |
| L3 | human gate 通過後の PR ready 判断材料提示、次 action の実行提案 | 自動 merge、人間承認なしの ready 化 |

通常時に許可されている自律度は L1 である。L2 / L3 は対象 AI Work Ticket ごとの Activation Record がある場合だけ起動できる。Activation Record と実行手順は `docs/loop-autonomy-contract.md` と `docs/loop-execution-contract.md` を正とする。

## Workflow

### 1. Guard Check

開始時に次を確認する。

- `loop-pause-all` がない。
- 当日の budget が残っている。
- `loop-constraints.md` を読めている。
- AI Work Ticket spreadsheet にアクセスできる。
- `STATE.md` と `loop-run-log.md` を読めている。

guard に失敗した場合、実行せず `blocked_by_constraints` または no-op として `loop-run-log.md` に理由を残す。

### 2. Ticket Inventory

AI Work Ticket spreadsheet から対象行を棚卸しする。

対象にする status:

- `ready_for_triage`
- `ticket_builder_required`
- `needs_human_management`
- `blocked_by_constraints`
- `pending`
- `ready_for_kiro`
- `ready_for_implementation`
- `human_gate_pending`

終端扱いにする status:

- `done`
- `no_action_required`

終端扱いの ticket も、明確な再開条件や contradictory signal がある場合は Watch Item として記録できる。

### 3. Structural Check

各 AI Work Ticket について、次を確認する。

- `docs/ai-work-ticket-spreadsheet-schema.md` の Required Completeness を満たしている。
- 新機能、仕様変更、責務境界がある場合は Feature Ticket Completeness を満たしている。
- `source_summary` が raw human request の丸貼りではない。
- `overview`, `background_purpose`, `problem`, `current_state`, `desired_state` が分かれている。
- `scope_in`, `scope_out`, `non_goals` があり、過剰対応を防げる。
- `acceptance_criteria`, `required_checks`, `test_perspectives` が検証可能である。
- `agent_alignment` があり、daily-triage、Kiro、実装 agent が同じ intent を読める。

構造不足の場合、実装や Kiro に進めない。`proposed_status = ticket_builder_required` とし、Ticket Builder / Intake への差し戻し理由を作る。

### 4. Constraint And Human Gate Check

各 ticket について `loop-constraints.md` と `loop-human-gates.md` を確認する。

deny list に該当する場合:

- `proposed_status = blocked_by_constraints`
- `proposed_next_owner = Human` または `Orchestrator`
- `constraint_block` を作る
- 安全な次 step を明記する

human gate に該当する場合:

- `proposed_status = needs_human_management` または `human_gate_pending`
- `human_management` を作る
- `decision_needed`, `affected_scope`, `options`, `recommended_next_owner` を明記する

{{MONEY_DOMAIN}}、PDF は path だけで判定しない。{{MONEY_DOMAIN}}計算、承認、保存、外部出力、PDF 生成物、宛先、法務・{{ACCOUNTING_DOMAIN}}上の意味に影響する場合に human gate とする。単純な文言追加や表示ラベル変更のみの場合は、この条件だけでは停止しない。

daily lock、KPI / management、外部連携、{{ACCOUNTING_SYSTEM}} / {{ACCOUNTING_DOMAIN}} master、DB / infrastructure は厳格に扱う。

### 5. Work Type Classification

構造と constraints を確認した後、`work_type` を分類する。

| work_type | Use when |
| --- | --- |
| `feature` | 新機能、画面追加、API 追加、DB 追加など |
| `bug_fix` | 期待挙動との差分を修正する |
| `spec_refinement` | 仕様が未確定で、Kiro による精緻化が主目的 |
| `docs` | docs / comment / README / operation guide |
| `test` | test 追加、test 改善、検証整備 |
| `ops` | 運用、設定、手順、監視に関わる |
| `cleanup` | 不要 code、follow-up、技術的負債整理 |
| `dependency` | dependency update / alert / lockfile |
| `unknown` | 判断材料が不足している |

### 6. cc-sdd / Kiro Decision

次に該当する場合は、原則として `cc_sdd_required = true` または `kiro_required = true` と扱う。

- 新機能である。
- 仕様変更である。
- 責務境界、権限、DB、外部連携、画面要件、テスト方針に影響する。
- requirements / design / tasks に分解した方が認識ズレを減らせる。
- AI Work Ticket はあるが、仕様判断が未確定である。

`ready_for_kiro` にできる条件:

- `overview`, `background_purpose`, `problem`, `current_state`, `desired_state` が明確である。
- `scope_in`, `scope_out`, `non_goals` がある。
- Kiro で詰めるべき unknown が明示されている。
- human review が必要な phase が分かる。
- 実装ではなく、requirements / design / tasks の作成または更新が requested outcome として扱える。

`ready_for_implementation` にできる条件:

- `docs/ai-work-ticket-contract.md` の Ready For Implementation を満たす。
- blocking unknown がない。
- `cc_sdd_required = false`、または Kiro spec / human approval が完了している。
- constraints と human gate が確認済みである。
- L2 以上が許可されている。

L1 では `ready_for_kiro` や `ready_for_implementation` を直接書き戻さず、`proposed_ticket_updates` として記録する。

### 7. Status Proposal

`daily-triage` は各 ticket に対して、次のいずれかの status 更新案を作る。

| Proposed status | Use when |
| --- | --- |
| `ticket_builder_required` | Required fields、Feature Ticket Completeness、scope、acceptance criteria、evidence が不足している |
| `needs_human_management` | 人間の判断、補足、優先度、承認、責務判断が必要 |
| `blocked_by_constraints` | deny list、budget、kill switch、権限不足により実行不可 |
| `out_of_scope` | Realtime Question Coach または現在の Loop 管轄外 |
| `pending` | 外部状態、期日、依存 ticket、人間判断待ちで、次回確認条件がある |
| `no_action_required` | 重複、解決済み、情報共有のみ、Loop 作業なし |
| `ready_for_kiro` | 仕様精緻化が必要で、Kiro に渡す材料が揃っている |
| `ready_for_implementation` | 仕様、scope、受け入れ基準、constraints が揃っている |
| `human_gate_pending` | 実装前または終了前に human gate が必要 |

status だけを提案してはいけない。必ず理由、次 owner、AI comment 案、根拠を残す。

### 8. Human-Facing Comment

人間に伝える必要がある場合は、AI Work Ticket spreadsheet の Human Communication columns を更新する。あわせて、`loop-run-log.md` に `proposed_ticket_comments` として同じ判断を残す。

コメントには次を含める。

- 現在の判断
- なぜその判断になったか
- 人間に決めてほしいこと
- 推奨 default
- 回答形式
- 次 owner

コメントは agent 内部用 YAML をそのまま貼らない。人間が読める文章にする。

### 9. Output And State Update

L1 report-only では、次を更新できる。

- `loop-run-log.md`
- `STATE.md`
- AI Work Ticket spreadsheet の Human Communication columns
- AI Work Ticket spreadsheet の L1 Proposed Updates columns

canonical な `status`, `next_owner`, ticket 本体、scope、risk、acceptance criteria、external issue、PR comment への直接書き戻しは行わない。

L1 が spreadsheet に書いてよい列は次に限定する。

- `ai_comment_type`
- `ai_comment_summary`
- `decision_needed`
- `questions_for_human`
- `default_assumption`
- `reply_format`
- `proposed_status`
- `proposed_next_owner`
- `proposed_ai_comment`
- `proposed_update_reason`
- `proposed_by`
- `proposed_at`
- `last_loop_run_id`
- `triage_notes`

`loop-run-log.md` には次を残す。

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

## Pattern Signal Handoff

`daily-triage` は未 scaffold Pattern signal を直接処理しない。次のように report-only で記録する。

| Signal | Record as |
| --- | --- |
| PR review comment、conflict、approval、merge readiness | `pr_babysitter` signal |
| CI failure、workflow failure、test failure log | `ci_sweeper` signal |
| dependency update、security alert、lockfile churn、dependency noise | `dependency_sweeper` signal |
| merge 後 follow-up、不要 branch、残作業、技術的負債 | `post_merge_cleanup` signal |
| release note、changelog 対象 | `changelog_drafter` signal |

現時点ではこれらの専用 Pattern は未 scaffold のため、直接起動しない。

## Stop Conditions

処理中に次を検出した場合、`daily-triage` は停止する。

- secret / credential / production data を読む必要がある。
- production deploy、破壊的 git 操作、自動 merge が必要である。
- ticket の scope が広すぎて、cc-sdd / Kiro なしで扱うべきではない。
- human gate 必須領域に該当し、承認がない。
- budget が 80% を超え、以降を report-only に縮退する必要がある。
- 同じ ticket で判断が収束せず、人間の判断が必要である。

停止時も可能な範囲で `loop-run-log.md` に `blocked` 理由を残す。

## First Loop Behavior

初回 Loop では、実装や branch 作成に進まない。

成果物は次に限定する。

- AI Work Ticket 一覧の件数と status 棚卸し
- 構造不足 ticket の検出
- `proposed_ticket_updates`
- `proposed_ticket_comments`
- 未 scaffold Pattern signal の棚卸し
- `STATE.md` と `loop-run-log.md` の更新

## Example: Feature Ticket

FAQ 管理機能のような新機能 ticket を検出した場合、L1 では次のような提案に留める。

```yaml
proposed_ticket_update:
  ticket_id: AIT-0001
  current_status: ready_for_triage
  proposed_status: ready_for_kiro
  proposed_next_owner: Orchestrator
  reason: >
    新機能開発であり、画面、サーバー処理、DB、権限、テストが関係する。
    cc-sdd 対象として requirements / design / tasks に分解する必要がある。
  risk_level: medium
  human_gate_required: true
  suggested_next_action: refine_spec
  evidence:
    - cc_sdd_required=true
    - kiro_required=true
    - scope includes admin UI, CRUD, permission, data model

proposed_ticket_comment:
  ticket_id: AIT-0001
  comment_type: ready_notice
  summary: >
    この ticket は FAQ 管理機能の新規開発として整理されています。
    実装へ直接進まず、Kiro で requirements / design / tasks を作成する対象です。
  decision_needed: >
    requirements / design / tasks の作成に進めてよいか確認してください。
  reply_format: >
    「Kiro作成OK」または、追加したい仕様判断を箇条書きで返信してください。
```

## Completion Criteria

`daily-triage` run は次を満たした場合に完了扱いにする。

- guard check の結果が記録されている。
- 読んだ source と ticket 件数が記録されている。
- 各 actionable ticket に status 更新案または no-op 理由がある。
- human gate / deny list / pending / no action の理由が人間に読める形である。
- Kiro / implementation / Ticket Builder / Human の next owner が分かる。
- `STATE.md` と `loop-run-log.md` に次回 Loop への引き継ぎがある。
