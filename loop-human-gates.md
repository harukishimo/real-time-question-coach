# Loop Human Gates - Realtime Question Coach

このファイルは、Realtime Question Coach Loop Engineering における human gate 判定の正本である。

`loop-constraints.md` は deny list と全体制約を扱う。このファイルは、実装可能性はあるが、人間の判断、承認、補足、または終了前確認が必要な条件を扱う。

L2 / L3 実行では、Orchestrator Agent、Implementation Agent、Verifier Agent はこのファイルを実装前と実装後に必ず読み返す。

## Responsibility

| File | Responsibility |
|------|----------------|
| `loop-constraints.md` | 自律実行禁止、deny list、kill switch、破壊的操作禁止 |
| `loop-human-gates.md` | 人間判断、承認、補足、終了前確認が必要な条件 |
| `docs/loop-autonomy-contract.md` | L0-L3 の権限境界と Activation Record |
| `docs/loop-execution-contract.md` | L2 / L3 の実行順序、branch、verification、run-log |
| `docs/codecommit-pr-contract.md` | PR 作成と reviewer comment 投稿の条件 |

Deny list と human gate が重なる場合は、deny list を優先する。deny list に該当する場合、human approval があっても自律実行しない。

## Read Timing

L2 / L3 では次のタイミングでこのファイルを読む。

| Timing | Required action |
|--------|-----------------|
| 実装開始前 | AI Work Ticket、Activation Record、scope、risk、affected areas をもとに human gate 要否を判定する |
| branch 作成前 | branch 作成が許可範囲内で、human gate 未承認作業を含まないことを確認する |
| 実装中 | scope 外、risk 上昇、厳格 gate 領域への波及が見えた時点で停止する |
| verifier handoff 前 | diff、test、変更影響をもとに human gate が新たに発生していないか再確認する |
| PR 作成前 | PR 作成、人間承認、draft-equivalent 表示、merge 禁止表示を確認する |
| reviewer comment 投稿前 | comment が許可済みで、承認、merge、close、resolve、ready 化を伴わないことを確認する |

## Gate Outcomes

| Outcome | Meaning | Spreadsheet status |
|---------|---------|--------------------|
| `not_required` | human gate 不要。Activation Record の範囲で続行できる | 継続 |
| `approved` | human gate 対象だが、人間承認済み | 継続可。ただし承認 scope 内だけ |
| `pending` | 人間判断待ち | `human_gate_pending` |
| `needs_human_management` | 方針、優先度、仕様、影響判断を人間が管理すべき | `needs_human_management` |
| `blocked_by_constraints` | deny list、kill switch、budget、禁止操作に該当 | `blocked_by_constraints` |

判断に迷った場合は `pending` または `needs_human_management` にする。推測で実装を継続しない。

## Functional Impact Rule

human gate は path だけでなく、変更差分が影響する機能境界で判定する。

例外を判断する場合は、次をすべて満たす必要がある。

- 認証、認可、保存、送信、外部provider、ログ、暗号化、export、deployに影響しない。
- 既存 route、API payload、provider payload、storage policy、rate limit、LLM発火条件に影響しない。
- test または差分確認で、文言・ドキュメントだけの変更と説明できる。
- Verifier が scope creep なしと判断できる。

## Pre-Implementation Human Gate Check

実装開始前に次を確認する。

```yaml
pre_implementation_human_gate:
  ticket_id:
  affected_areas:
  strict_gate_area: true | false
  human_gate_required: true | false
  human_gate_reason:
  human_decision_needed:
  approved_scope:
  fallback_status: human_gate_pending | needs_human_management | blocked_by_constraints
```

次に該当する場合、実装開始前に停止する。

- AI Work Ticket の `human_gate_required = unknown`。
- affected areas が厳格 gate 領域に該当する。
- `risk_level = medium` または `high`。
- scope が広く、承認済み tasks または acceptance criteria が不足している。
- 実装に外部 service、production、secret、DB mutation、deploy、release、real provider execution が必要。
- path ではなく機能影響として認証、認可、会話データ保存、STT、LLM、暗号化、ログ、export、deploy に影響する。

## Post-Implementation Human Gate Check

実装後、verifier handoff 前に次を確認する。

```yaml
post_implementation_human_gate:
  ticket_id:
  changed_files:
  functional_impact_summary:
  scope_creep_found: true | false
  strict_gate_area_touched: true | false
  new_human_gate_required: true | false
  reason:
  verifier_required: true
```

次に該当する場合、PR 作成や status 完了へ進まず停止する。

- 実装中に scope 外変更が入った。
- AI Work Ticket にない仕様判断、データ判断、認可判断が必要になった。
- 厳格 gate 領域に新たな影響が出た。
- required checks が失敗し、原因が不明または scope 外に広がる。
- Verifier が `ESCALATE_HUMAN` を返した。
- PR 作成前 approval が Activation Record に残っていない。

## Strict Gate Areas

以下は厳格 gate 領域である。原則として human gate に送る。

### Authentication, Authorization, And OAuth

次に影響する場合は human gate に送る。

- Google OAuth provider、Supabase Auth、PKCE、callback URL、redirect origin、session cookie、JWT validation。
- role、permission、admin判定、最小権限、`app_metadata.role` の扱い。
- protected route / protected API / middleware / auth header contract。
- mock auth と real auth の切り替え条件。

### Supabase DB, RLS, And Server Storage

次に影響する場合は human gate に送る。

- DB schema、migration、RLS policy、storage bucket、Edge Function、database trigger。
- ログイン機能以外のDB利用。
- 会話本文、音声、AIカード本文、LLM input/output、Session Report本文のサーバー保存。
- browser memory、IndexedDB、Markdown export、JSON export の保存方針。

実データを変更する command は deny list として扱い、自律実行しない。

### STT, Microphone, And Browser Audio

次に影響する場合は human gate に送る。

- microphone permission、browser audio、tab audio、display media、Web Audio API、MediaRecorder。
- STT provider token、token TTL、session binding、speaker label、diarization、audio relay。
- 「誰が喋っているか」の判定方式。
- 実音声・物理マイク確認の完了条件。

自動テストで完了扱いにできるのは、ブラウザAPI許可パスとstream取得までである。OSダイアログの人間承認、物理マイクからの実音声、実STT精度は human-run 確認とする。

### LLM Dispatch, Coach Cards, And Report Generation

次に影響する場合は human gate に送る。

- LLM provider、model、prompt、adapter境界、mock fallback。
- LLMへ送信するpayload、redaction、payload minimization、schema、受信schema、fallback。
- AIカードの役割、最大3件制御、priority、dedupe、pinned、dismiss、manual recheck。
- LLM発火条件、重要語、曖昧表現、沈黙、質問候補生成、常時呼び出し禁止。
- Session Report生成、report failure時のexport可否。

LLMは会話支援のために必要なタイミングだけ呼ぶ。常時呼び出しはcost、latency、privacy、カード過多のリスクがあるため不可とする。

### Session Setup And Knowledge

次に影響する場合は human gate に送る。

- Session Setup の入力項目、validation、sessionProfile schema。
- 会話タイプ、業界、今回の目的。
- 会話タイプ / 業界 / 目的から読み込むリポジトリ内ナレッジ。
- playbook、knowledge、category selector、preset prompt の意味。

現時点のSession Setupは、会話タイプ、業界、今回の目的を収集し、後続のSTT/LLM/AIカード判定で使う `sessionProfile` を作るための画面である。

### Privacy, Encryption, Logging, And Export

次に影響する場合は human gate に送る。

- TLS、通信暗号化、payload redaction、server log、client log、diagnostics。
- 会話本文、音声、AIカード本文、LLM input/output、Session Report本文の保存・保持・削除。
- Markdown export、JSON export、local save、discard。
- Playwright trace、screenshot、test fixture に含めるデータ。

ログには本文を出さない。診断情報はprovider名、状態、設定不足の種類などに限定し、secretや会話本文を含めない。

### External Providers, Cost, And Environment

次に影響する場合は human gate に送る。

- OpenAI、Anthropic、STT provider、Supabase、Google OAuth、Vercel。
- API key、model、quota、rate limit、課金、provider account設定。
- `.env.example` 以外の環境変数ファイル。
- real provider execution。

`.env.example` はplaceholderのみなら編集できる。実値の作成、閲覧、投入、検証はしない。

### API Security And Rate Limiting

次に影響する場合は human gate に送る。

- `/api/session/init`、`/api/stt-token`、`/api/coach`、`/api/report`、`/api/diagnostics`。
- auth guard、rate limit、no-store headers、origin / next validation、request schema。
- sessionId rotation対策、user/session binding、timeout、AbortSignal。

### UI Flow And Accessibility

次に影響する場合は human gate に送る。

- Login -> Session Setup -> Realtime transcript + AI coach cards -> Session Report -> discard / local save / export の主要導線。
- 画面遷移条件、戻る操作、disabled state、error state、loading state。
- AIカード過多を防ぐUI、3枚上限、優先順位、次に重要なactionの差し替え。
- mobile viewport、keyboard operation、visible focus、text overflow。

### Infrastructure, Deployment, And Dependency

次に影響する場合は human gate に送る。

- Vercel、production build setting、domain、DNS、CI/CD workflow、monitoring。
- `package.json`、`package-lock.json`、Playwright browser install、major dependency update。
- security alert remediation、lockfile churn。

## Verification Gate Requirements

コード変更を伴うticketは、ticketごとの完了条件に加えて次を確認する。

- Red Team確認条件を網羅するtest caseが存在する。
- QA Agentがacceptance criteria、negative case、security / privacy / storage / logging観点を確認している。
- Tester Agentが実行コマンド、環境、fixture、pass/fail/not_run、trace/screenshot有無を記録している。
- Purple Teamがfindingを `fixed_and_retested`、`human_gate_pending`、`blocked` のいずれかに整理している。
- Verifierがscope、diff、test、deny list、人間gate要否を確認している。
- Red Team `APPROVE`、QA `passed`、Tester `passed`、Verifier `APPROVE` が揃うまで `done` にしない。

## PR And Reviewer Comment Gate

PR 作成と reviewer comment 投稿は `docs/codecommit-pr-contract.md` または該当repository action contractを正とする。

human gate が必要な条件:

- L3 Activation Record がない。
- PR 作成が明示許可されていない。
- reviewer comment 投稿が明示許可されていない。
- repository name、base branch、source branch、destination branch、credential扱いが不明。
- draft相当の表示を入れない。
- PR 作成前 approval が Activation Record または最新の人間指示に残っていない。

## Human-Facing Comment Template

human gate に送る場合は、Spreadsheet の Human Communication columns に次を残す。

```yaml
ai_comment_type: human_gate_request
ai_comment_summary: |
  このチケットは human gate が必要です。
  理由: ...
  影響領域: ...
  実装を進めるには、以下の判断が必要です。
decision_needed: |
  1. ...
  2. ...
questions_for_human: |
  - ...
default_assumption: none
reply_format: |
  approve / reject / clarify のいずれかと、承認 scope を記載してください。
```
