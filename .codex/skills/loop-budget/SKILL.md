---
name: loop-budget
description: >
  Check Realtime Question Coach Loop budget and run-log spend before and after a Loop run. Use for daily-triage L1 report-only budget guards, read-only sub-agent limits, kill switch checks, self-throttle decisions, and appending budget status to loop-run-log.md without running unapproved external cost commands.
---

# Loop Budget Guard

Realtime Question Coach の Loop 実行前後で `loop-budget.md` と `loop-run-log.md` を確認する。通常運用では `daily-triage`, `report_only`, `L1` を対象にする。L1 でも read-only / report-only sub-agent は budget 内で起動できる。

## Read Order

1. `loop-budget.md`
2. `loop-run-log.md`
3. `STATE.md`
4. `loop-constraints.md`

必要に応じて `docs/patterns/daily-triage.md` を読む。

## Start Of Run

開始時に次を確認する。

1. `loop-pause-all` が `STATE.md`, `loop-constraints.md`, `loop-run-log.md`, 人間の最新指示にない。
2. `daily-triage` の scheduled run が当日 1 回を超えていない。
3. 人間承認なしの retry ではない。
4. 当日の `tokens_estimate` 合計が `loop-budget.md` の `Max tokens/day` 未満である。
5. `sub_agent_spawns` が `loop-budget.md` の L1 read-only / report-only limit 内である。
6. AI Work Ticket spreadsheet、`STATE.md`, `loop-run-log.md` を読める。

## Self-Throttle

| Condition | Behavior |
| --- | --- |
| token estimate < 80% | 通常の L1 report-only を継続する |
| token estimate >= 80% | 新しい source 深掘りを止め、既に読んだ情報で要約する |
| token estimate >= 100% | no-op として停止し、budget exceeded を `loop-run-log.md` に残す |
| no actionable ticket / signal | 5k tokens 未満を目安に no-op で終了する |
| missing required input | `blocked` として停止し、何が不足しているかを残す |

## Hard Rules

- L1 sub-agent は read-only / report-only に限る。
- L1 では `STATE.md`, `loop-run-log.md`, AI Work Ticket spreadsheet Human Communication columns, L1 Proposed Updates columns 以外を更新しない。
- scheduler、automation、external service を自律変更しない。
- `npx @cobusgreyling/loop-cost --pattern daily-triage` は自動実行しない。実行する場合は人間の明示承認を得る。
- budget 超過時に実装、branch 作成、PR 作成、ticket 更新へ進まない。

## End Of Run

終了時に `loop-run-log.md` へ budget 情報を含む entry を残す。

```yaml
budget:
  tokens_estimate:
  budget_status: ok | warn | exceeded
  sub_agent_spawns:
  sub_agent_mode: none | read_only | report_only
```

budget 超過、missing input、kill switch の場合は `blocked` block も残す。

```yaml
blocked:
  is_blocked: true
  reason:
  safe_next_step:
```

## Completion Check

完了前に次を確認する。

- `loop-budget.md` の current operating mode と矛盾していない。
- `loop-run-log.md` に budget status を残した、または no-op 理由を残した。
- 80% 超過時に深掘りを止めた。
- 100% 超過時に停止した。
- 外部 cost command を無承認で実行していない。
