# Loop Budget - Realtime Question Coach

このファイルは、Realtime Question Coach の Loop Engineering 実行予算、実行頻度、kill switch、self-throttle 条件を定義する。

scheduled run の通常運用は `daily-triage` の L1 report-only を基本とする。本PJでは最大L3まで許可済みだが、実装、branch 作成、PR 作成、canonical status 更新、ticket 本体更新は、対象 AI Work Ticket ごとの Activation Record がない限り予算上も許可しない。AI Work Ticket spreadsheet の Human Communication columns と L1 Proposed Updates columns への write-back は L1 で許可する。

L2 / L3 は scheduled run ではない。`docs/loop-autonomy-contract.md` の Activation Record があり、かつこのファイルの on-demand execution budget を満たす場合だけ実行できる。

## Current Operating Mode

| Item | Value |
| --- | --- |
| Active loop | Daily Orchestration Loop |
| Active pattern | `daily-triage` |
| Cadence | 1日1回 |
| Scheduled default autonomy | L1 report-only |
| Max approved autonomy | L3 |
| Allowed writes | `STATE.md`, `loop-run-log.md`, AI Work Ticket spreadsheet Human Communication columns, AI Work Ticket spreadsheet L1 Proposed Updates columns |
| Conditionally allowed writes | L2 / L3 Activation Record がある場合のみ、AI Work Ticket spreadsheet canonical execution fields と branch 上の code。L3 かつ明示許可がある場合のみ CodeCommit PR 作成と reviewer comment 投稿 |
| Disallowed writes | ticket body fields, external issue, merge, deploy, production operation。L3 明示許可のない PR 作成 / PR comment |

## Daily Limits

| Pattern | Max scheduled runs/day | Max human-approved retry/day | Max tokens/day | Max sub-agent spawns/run | Current status |
| --- | ---: | ---: | ---: | ---: | --- |
| `daily-triage` | 1 | 1 | 100k | 3 read-only/report-only | active |
| `pr-babysitter` | 0 | 0 | 0 | 0 | scaffolded_inactive |
| `ci-sweeper` | 0 | 0 | 0 | 0 | scaffolded_inactive |
| `dependency-sweeper` | 0 | 0 | 0 | 0 | scaffolded_inactive |
| `post-merge-cleanup` | 0 | 0 | 0 | 0 | scaffolded_inactive |
| `changelog-drafter` | 0 | 0 | 0 | 0 | documented_no_runtime |

`daily-triage` の retry は、人間が同日に再実行を明示した場合だけ許可する。自動 retry は行わない。

L1 の sub-agent は read-only / report-only に限る。L1 sub-agent は実装、branch 作成、canonical ticket update、external service update、PR 作成、CodeCommit command を行わない。

## On-Demand Execution Limits

L2 / L3 は、対象 AI Work Ticket ごとの Activation Record がある場合だけ on-demand で実行できる。

| Autonomy | Max active tickets/day | Max fix attempts/ticket | Max verifier runs/ticket | Max PR create commands/ticket | Max reviewer comment commands/ticket | Current status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| L2 | 1 | 1 | 1 | 0 | 0 | activation_required |
| L3 | 1 | 3 | 3 | 1, activation allowed only | 3, activation allowed only | allowed_with_activation |

PR 作成 command と reviewer comment command は L3 の Activation Record で明示許可されている場合だけ実行できる。merge、deploy、release は budget 上も常に対象外である。

## Human-Approved MVP Completion Batch

2026-07-08T17:44:48+09:00 の最新人間指示「全チケットが終了するまでLoopさせたい」により、今回の on-demand L3 execution では `RQC-W02` から `RQC-W20` までを同一実行シリーズで逐次処理してよい。

Status: local implementation completed at `2026-07-08T18:00:17+09:00`. The broad multi-ticket implementation override is no longer active. The only remaining exception is spreadsheet write-back for `RQC-W02` to `RQC-W20` once Google Drive connector usage is available again.

この override は次の範囲に限定する。

- 対象は Google Sheets 上の `RQC-W02` から `RQC-W20` まで。
- 実行は依存順の逐次処理とし、同時並行で複数 ticket を実装しない。
- 各 ticket には既存の L3 Activation Record が必要である。
- 各 ticket の `approval_scope`, `scope_in`, `scope_out`, `non_goals`, `acceptance_criteria`, `required_checks` を実装前に確認する。
- `max_fix_attempts/ticket` は L3 の既定どおり 3 回までとする。
- `loop-constraints.md` と `loop-human-gates.md` の deny list / human gate / kill switch は override しない。
- secret の作成・閲覧・投入、production 操作、deploy、release、merge、push、PR 作成 command、reviewer comment command は引き続き禁止する。ただし PR 作成 command と reviewer comment command は別途 Activation Record で明示許可された場合のみ扱えるが、現 Activation Record では許可されていない。
- token / context が大きくなった場合でも、安全に状態を維持できる限り自動 compaction 後に継続してよい。状態維持が不可能な場合だけ `blocked` とし、`STATE.md` と `loop-run-log.md` に再開点を残す。

この override は MVP 完成 Loop 用の一時設定であり、scheduled `daily-triage` の L1 report-only 運用を変更しない。2026-07-08T18:00:17+09:00 以降の追加実装は、通常の on-demand execution limit に戻す。

## Budget Check

Loop 開始時に次を確認する。

1. `STATE.md`, `loop-constraints.md`, `loop-run-log.md` に `loop-pause-all` がない。
2. 当日の `daily-triage` run が scheduled limit を超えていない。
3. 当日の token estimate が `Max tokens/day` の 80% 未満である。
4. L1 の sub-agent spawn が daily limit 内であり、すべて read-only / report-only である。L2 / L3 では Activation Record と on-demand execution limit の範囲内で verifier / implementation agent を使う。
5. AI Work Ticket spreadsheet、`STATE.md`, `loop-run-log.md` を読める。

## Self-Throttle Rules

| Condition | Required behavior |
| --- | --- |
| token estimate < 80% | 通常の L1 report-only を継続する |
| token estimate >= 80% | 新しい source 深掘りを止め、既に読んだ情報だけで要約する |
| token estimate >= 100% | no-op として停止し、`loop-run-log.md` に budget exceeded を残す |
| no actionable ticket / signal | 5k tokens 未満を目安に no-op で終了する |
| missing required input | `blocked` として停止し、何が不足しているかを記録する |

## Kill Switch

次のいずれかがある場合、Loop は即時停止する。

- `loop-pause-all`
- 人間の最新指示による停止
- secret、credential、production data、production deploy が必要
- 破壊的 git 操作、自動 merge、外部状態変更が必要
- `loop-constraints.md` の deny list に該当する作業しか存在しない

再開は、人間が明示的に停止条件を解除した場合だけ許可する。

## Cost Estimate Policy

現時点では、外部 command による cost estimate を自動実行しない。

`npx @cobusgreyling/loop-cost --pattern daily-triage` は scaffold 由来の参考 command であり、Realtime Question Coach 運用では未検証である。実行する場合は、人間の明示承認を得る。

L1 では、`loop-run-log.md` の `tokens_estimate` に概算値を残す。正確な課金計算ではなく、self-throttle と運用観察のための目安として扱う。

## On Budget Exceed

budget を超過した場合、次を行う。

1. `daily-triage` を no-op または abbreviated report-only として終了する。
2. `loop-run-log.md` に `budget_status: exceeded` を残す。
3. 必要なら `STATE.md` の Watch List または High Priority に、次回確認事項として残す。
4. 実装、branch 作成、PR 作成、canonical ticket 更新には進まない。

## Alerts This Period

現時点ではなし。
