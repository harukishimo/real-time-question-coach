# Loop Configuration - Realtime Question Coach Daily Orchestration

このファイルは、Realtime Question Coach リポジトリでの Loop Engineering 運用を定義する。Orchestrator Agent は Kiro-style Spec-Driven Development の上位層として動き、AI が読むために正規化された AI Work Ticket だけを実行対象にする。

人間が書いた依頼、Issue、PR コメント、会話メモなどの raw input は、Loop が直接実行するチケットではない。これらは Ticket Builder / Intake 層が読み取り、AI Work Ticket として十分に構造化した後で、AI が読むチケット一覧に登録される。

AI が読むチケット一覧は、外部 issue / repository issue ではなくスプレッドシートで管理する。列定義は `docs/ai-work-ticket-spreadsheet-schema.md` に従う。外部 issue、PR、repository service 上の情報は Human-origin input または evidence の一種として参照してよいが、AI Work Ticket の正本一覧として扱わない。

## Active Loop

| Loop | Cadence | Current level | Primary state | Purpose |
|------|---------|---------------|---------------|---------|
| Daily Orchestration Loop | 1回/日 | L3 allowed / scheduled L1 | `STATE.md` | Orchestrator Agent が AI Work Ticket 一覧を確認し、Pattern、action、自律度、実行可否、human gate を判断する |

## Operating Model

1日1回、Orchestrator Agent が次の順序で処理する。

1. `loop-constraints.md` を読み、deny list、停止条件、禁止操作を確認する。`loop-human-gates.md` を読み、実装前後に人間判断が必要な条件を確認する。`docs/safety.md` など独立した安全文書がある場合は合わせて読む。
2. `loop-budget.md` と `loop-run-log.md` を読み、当日の実行回数、token budget、kill switch を確認する。
3. `STATE.md` を読み、前回から継続中の High Priority / Watch List / Recent Noise を把握する。
4. `docs/pattern-picker.md` を読み、Pattern 選択の責務と意思決定フローを確認する。
5. Pattern 選択に必要な signal を収集する。対象は AI Work Ticket 一覧の有無、PR 状態、CI failure、dependency update、dependency noise、merge 後 follow-up、技術的負債 signal、changelog 対象など。
6. Pattern Picker に従い、この run で起動する `selected_pattern`, `startup_mode`, `autonomy_level` を決める。
7. 選択した Pattern を起動する。AI Work Ticket の詳細検査、status 更新、差し戻し文面の生成は、起動された Pattern 側の責務とする。
8. Pattern、startup mode、risk に応じて実行してよい範囲だけを処理し、必要に応じて branch / agent / verifier / human gate に渡す。
9. `STATE.md` と `loop-run-log.md` を更新し、次回 Loop が引き継げる状態にする。

## Ticket Boundaries

Orchestrator Agent が Pattern 選択の signal として見る実行候補は AI Work Ticket である。人間起点の情報は source として扱うが、Loop の実行単位にはしない。

| Type | Meaning | Loop behavior |
|------|---------|---------------|
| Human-origin input | 人間が書いた依頼、Issue、PR コメント、会話メモ、Slack 相当の文脈、口頭メモなど | Orchestrator Agent は直接実行しない。Ticket Builder / Intake 層が解釈し、AI Work Ticket に変換する |
| AI Work Ticket | AI が読むチケット一覧に登録される、構造化済みの実行契約 | Orchestrator Agent は Pattern 選択の signal として扱う。詳細な構造検査や status 更新は選択された Pattern 側で行う |
| Raw evidence | PR、CI、commit、spec、ログ、スクリーンショットなどの根拠情報 | AI Work Ticket の source / evidence として参照する |

AI が読むチケット一覧に raw human request が混入している疑いがある場合、Orchestrator Agent は実装系 Pattern を起動しない。原則として `daily-triage` の report-only を起動し、詳細な status 更新や Ticket Builder 差し戻しは daily-triage 側で行う。

AI Work Ticket 一覧の管理媒体は、1ページのスプレッドシートを前提とする。外部 issue / repository issue 一覧を AI Work Ticket 一覧として読ませない。外部 issue や PR を参照する場合は、spreadsheet row の `source_type`, `source_link`, `source_summary`, `evidence` に取り込む。

## AI Work Ticket

AI Work Ticket は、AI が読むチケット一覧に登録される実行契約である。Pattern Picker は AI Work Ticket の詳細 schema を定義しない。Orchestrator Agent は、Pattern 選択に必要な signal だけを見て、詳細検査は選択された Pattern に委譲する。

```yaml
pattern_decision:
  selected_pattern: daily-triage | pr-babysitter | ci-sweeper | dependency-sweeper | post-merge-cleanup | changelog-drafter
  startup_mode: report_only | monitor_only | assisted_fix | no_op
  autonomy_level: L0 | L1 | L2 | L3
  primary_signal:
  reason:
```

## Pattern Decision

Orchestrator Agent は `docs/pattern-picker.md` に従い、この run で起動する `selected_pattern`, `startup_mode`, `autonomy_level` を決める。

`daily-triage` は agent ではなく Loop Pattern である。Orchestrator Agent がこの Pattern を起動し、その Pattern 内で AI Work Ticket の棚卸し、構造不足の検出、Kiro による仕様精緻化、実装 agent への振り分け、人間管理への差し戻しを扱う。

Pattern の選択基準は [docs/pattern-picker.md](docs/pattern-picker.md) を正とする。構造不足チケットの差し戻し先や `needs_human_management` の理由更新フォーマットは、daily-triage または Ticket Builder / Intake 側の責務として別途定義する。

## Autonomy Levels

| Level | Allowed behavior |
|-------|------------------|
| L0 | 読むだけ。要約、分類、質問作成のみ。ファイル変更なし。 |
| L1 | report-only。read-only / report-only agent 起動、`STATE.md`、`loop-run-log.md`、AI Work Ticket spreadsheet の Human Communication columns / L1 Proposed Updates columns まで。コード変更なし。 |
| L2 | branch 作成、実装 agent 起動、test 実行、verifier 依頼、PR package 作成まで。PR 作成 command は不可。merge は不可。 |
| L3 | L2 に加えて、Activation Record で明示許可された場合に CodeCommit PR 作成 command と reviewer comment command を実行できる。自動 merge は不可。 |

詳細な権限境界は `docs/loop-autonomy-contract.md` を正とする。本PJでは最大L3まで許可済みとする。ただし、scheduled daily-triage は L1 report-only を基本とし、L2 / L3 実行へ進む場合は、AI Work Ticket に `branch_required: true`、`verifier_required: true`、`human_gate_required` の判断が明記され、対象 ticket ごとの Activation Record が必要である。

## Branch, Agent, Review Flow

L2 以上の作業は次の流れを守る。

詳細な実行手順は `docs/loop-execution-contract.md` を正とする。

1. 対象 AI Work Ticket の scope と stop conditions を確認する。
2. 既存変更を `git status` で確認し、無関係な変更を触らない。
3. 作業用 branch を作成する。
4. 対応 agent を起動する。Kiro spec がある場合は `$kiro-impl` を優先する。
5. 実装 agent は最小変更で作業し、必要な test を実行する。
6. verifier / reviewer が scope、test、risk、禁止操作違反を確認する。
7. 問題がなければ human gate が必要か判定する。
8. human gate が必要な場合は merge せず、判断材料を提示して停止する。
9. PR 作成が必要な場合、L2 では PR package まで作成する。L3 かつ Activation Record で明示許可されている場合だけ repository service の PR 作成手段を使う。
   - GitHub など draft PR を持つ service では draft PR から開始する。
   - CodeCommit では `docs/codecommit-pr-contract.md` に従い、`aws codecommit create-pull-request` 相当の command を使う。
   - L3 かつ Activation Record で明示許可されている場合、reviewer agent は `aws codecommit post-comment-for-pull-request` または `aws codecommit post-comment-reply` 相当の command で reviewer comment を投稿できる。
10. human gate が不要な低 risk 作業でも、自動 merge はしない。merge は人間の明示承認後に行う。

## Kiro Integration

Loop は Kiro SDD の代替ではない。Orchestrator Agent は、仕様を詰める必要がある signal を見た場合、まず `selected_pattern: daily-triage` を選ぶ。Kiro を呼ぶかどうかは、起動された daily-triage Pattern 内の判断として扱う。

- 新規仕様が必要な場合: `$kiro-discovery "<idea>"`
- 既存仕様を更新する場合: `$kiro-spec-requirements <feature>`
- 承認済み task を実装する場合: `$kiro-impl <feature> [tasks]`
- 実装後の機能検証: `$kiro-validate-impl <feature>`

Orchestrator Agent は、Pattern Picker に従って daily-triage、PR babysitter など、どの Pattern を起動すべきかを判断する。Kiro を呼ぶか、実装 agent に振り分けるかは、daily-triage Pattern 内の action として扱う。

## Human Gates

human gate の詳細条件は `loop-human-gates.md` を正とする。

以下のいずれかに該当する場合は必ず human gate に送る。

- merge、production deploy、release に関わる
- Google OAuth / Supabase Auth / role / permission / callback URL / RLS に影響する
- DB schema、Supabase project、server-side persistence、conversation data storage に影響する
- STT provider、LLM provider、model、provider credential、quota、cost、real provider execution に影響する
- 音声、文字起こし、AIカード本文、LLM input/output、Session Report本文の保存、保持、ログ、export、暗号化に影響する
- AIカードの3枚上限、priority、dedupe、LLM dispatch条件、重要語/曖昧表現判定に影響する
- `.env`, credentials, secrets, infrastructure config に触れる必要がある
- 要件、受け入れ基準、対象 spec が不明確
- test が失敗している、または検証環境が不足している
- reviewer / verifier が `ESCALATE_HUMAN` または同等の判断をした
- 3回以内に修正が収束しない

## State And Evidence

各 Loop 実行後は次を残す。

- `STATE.md`: High Priority、Watch List、Recent Noise、前回からの継続事項
- `loop-run-log.md`: 実行時刻、pattern、items_found、actions_taken、escalations、tokens_estimate、outcome
- 必要に応じて Pattern decision、自律度、human gate 判断

成功扱いにするには、少なくとも次の証跡が必要。

- 何を入力として読んだか
- どの `selected_pattern` と `startup_mode` を選んだか
- なぜその自律度にしたか
- 実行した action と実行しなかった action
- test / verifier / human gate の状態
- 次回 Loop が見るべき残事項

## Stop Conditions

次の場合、Loop は実装や merge に進まず停止する。

- `loop-pause-all` が有効
- daily budget を超過、または 80% 以上で report-only に切り替える必要がある
- Pattern 選択に必要な signal が不足している
- scope が広すぎ、Kiro spec なしで扱うべきではない
- risk が medium 以上で human gate が未通過
- 外部 package 実行、secret 読み取り、破壊的 git 操作など安全上の懸念がある

## Initial Operating Policy

当面の運用は以下とする。

- Daily Orchestration Loop は 1日1回。
- 本PJの最大許可自律度は L3。
- scheduled daily-triage は L1 report-only を基本とする。
- L2 / L3 実行は、対象 AI Work Ticket ごとの Activation Record、budget、human gate 条件が揃う場合だけ on-demand で行う。
- PR babysitter は Orchestrator Agent が Pattern Picker で選ぶ対象として扱い、単独高頻度 Loop にはまだしない。
- 自動 merge は行わない。merge は人間の明示承認後のみ。
