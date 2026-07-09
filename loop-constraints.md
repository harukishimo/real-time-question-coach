# Loop Constraints - Realtime Question Coach

このファイルは、Realtime Question Coach リポジトリで Loop を実行する際の拘束条件を定義する。Orchestrator Agent と各 Loop Pattern は、処理開始前に必ずこのファイルを読み、ここにある制約を優先する。

この制約は Loop 実行時に適用する。人間がこのスレッドで明示的に依頼した Loop Engineering 用の設計文書編集は、Loop 実行そのものとは分けて扱う。

## Product Boundary

Realtime Question Coach は、会議中の文字起こしとAI補助カードによって、重要な質問漏れを減らすためのリアルタイム支援ツールである。議事録生成を主目的にしない。

MVPの基本フロー:

1. Login
2. Session Setup
3. Realtime transcript + AI coach cards
4. Session Report
5. discard / local save / export

## Autonomy Boundary

| Level | Allowed | Not allowed |
|-------|---------|-------------|
| L1 | read-only 調査、Pattern 判定、`STATE.md` / `loop-run-log.md` 更新、AI Work Ticket spreadsheet の Human Communication columns / L1 Proposed Updates columns 更新 | コード変更、branch 作成、PR 作成、push、merge、deploy、canonical status 更新 |
| L2 | Activation Record がある AI Work Ticket の branch 作成、限定的な実装、test 実行、verifier 依頼、PR package 作成 | merge、production deploy、human gate 対象の未承認実装、PR 作成 command、reviewer comment command |
| L3 | L2 に加えて、Activation Record で明示許可された PR 作成 command、reviewer comment command、`max_fix_attempts` 内の自律修正 | 自動 merge、人間承認なしの ready 化、release / deploy、承認範囲外の追加実装 |

本PJの最大許可自律度は L3。scheduled daily-triage は L1 report-only を基本とする。L2 / L3 は対象 AI Work Ticket ごとの Activation Record がある場合だけ起動できる。Activation Record の形式と条件は `docs/loop-autonomy-contract.md`、実行手順は `docs/loop-execution-contract.md` を正とする。

## Kill Switch

次のいずれかに該当する場合、Loop は即時停止する。

- `loop-pause-all` が `STATE.md`、`loop-constraints.md`、チケット、または人間の最新指示に含まれる。
- 当日の budget を超過している。
- secret、credential、production deploy、破壊的 git 操作が必要である。
- Pattern を起動するための最低限の state file、skill、connector が存在しない。
- 実provider実行、課金発生、production外部サービス操作、secret投入が必要だが、Activation Recordに明示許可がない。
- 会話本文、音声、LLM入出力、AIカード本文、Session Report本文をサーバーDBへ保存する必要がある。

停止した場合は、可能であれば `STATE.md` または `loop-run-log.md` に no-op / blocked 理由を残す。

## Deny List And Human Gate Responsibility

- Deny List は「Loop が自律実行してはいけない操作、または自律編集してはいけない領域」を定義する。
- Human Gate は「実装可能性はあるが、人間の判断、承認、補足、または終了前確認を必要とする作業」を定義する。
- human gate 分岐条件の正本は `loop-human-gates.md` とする。L2 / L3 では実装開始前と終了前に必ず読み直す。
- Deny List に該当する場合、人間の追加承認があっても Loop は自律実行しない。

## Repository-Specific Deny List

Loop は次の操作を行わない。これは L2 / L3 でも同様に適用する。

### Secrets And Production

- `.env`, `.env.*`, credentials, secrets, private key, token を読む、表示する、編集する。
- Supabase service role key、Google OAuth client secret、OpenAI API key、Anthropic API key、STT provider credential、Vercel token を読む、表示する、編集する。
- 例外: `.env.example` は、secret 実値を含まない placeholder documentation としてのみ、AI Work Ticket の scope に明記されている場合に作成・編集してよい。実値、token、private key、production URL、個人 credential が必要になった時点で停止する。
- production data、production console、production deploy、DNS、OAuth consent screen、OAuth redirect URI設定、Vercel project settings、Supabase production project settings に触れる。

Observed path examples:

- `.env*`
- `*.pem`
- `*.key`
- `*.p12`
- `secrets/**`
- `credentials/**`

### Conversation Data And Privacy

- 実会話の音声、文字起こし本文、AIカード本文、LLM input、LLM output、Session Report本文をサーバーDBへ永続化する変更を行わない。
- 上記データを `loop-run-log.md`、test snapshot、console log、server log、Playwright trace、fixture、README、PR本文へ貼らない。
- 実会話データをfixture化、seed化、スクリーンショット化、外部共有しない。
- ブラウザメモリ、IndexedDB、Markdown export、JSON export の範囲を超える保存方式を追加しない。
- サーバー送信時の暗号化、TLS、payload minimization、redaction を弱める変更を行わない。

Observed path examples:

- `loop-run-log.md`
- `test-results/**`
- `playwright-report/**`
- `coverage/**`
- `docs/**`
- `src/**/*.test.*`
- `tests/**`

### Auth, Authorization, And Identity

- Google OAuth / Supabase Auth の実provider設定、redirect URI、callback URL、session cookie policy、JWT validation、role mapping、RLS policy を自律変更しない。
- ユーザー権限、role、admin判定、最小権限の意味を緩める変更を行わない。
- `user_metadata.role` などユーザーが自己編集できる可能性がある値を権限根拠として採用する変更を行わない。
- 認証なしで保護APIへアクセス可能にする変更を行わない。

Observed path examples:

- `src/lib/auth.ts`
- `src/lib/auth-client.ts`
- `src/lib/oauth-callback.ts`
- `src/app/auth/**`
- `src/app/api/**/route.ts`

### External Providers And Cost

- 実 STT / LLM provider を実行しない。実行が必要な場合は human-run とする。
- OpenAI / Anthropic / Supabase / Google OAuth / Vercel の管理画面、課金、model setting、rate limit、quota、provider account を変更しない。
- provider adapter境界をなくす変更、mock fallbackを削除する変更、provider固定を強める変更を行わない。
- LLM常時呼び出しを導入しない。発火条件、rate limit、重要語/曖昧表現判定、3枚上限、優先度制御を弱めない。
- 音声を自前サーバーへ中継・保存する実装を追加しない。

Observed path examples:

- `src/lib/stt.ts`
- `src/lib/llm-adapter.ts`
- `src/lib/report-adapter.ts`
- `src/lib/provider-diagnostics.ts`
- `src/lib/rule-gate.ts`
- `src/app/api/stt-token/route.ts`
- `src/app/api/coach/route.ts`
- `src/app/api/report/route.ts`

### Database, Storage, And Schema

- DB migration、Supabase schema、RLS policy、storage bucket、Edge Function、database trigger、seed、direct SQL、bulk import、truncate、data cleanup を自律実行しない。
- ログイン機能以外の目的でサーバーDB保存範囲を拡張しない。
- 会話データ、AIカード本文、LLM入出力、Session Report本文をDB schemaに追加しない。

Observed path examples:

- `supabase/**`
- `db/**`
- `migrations/**`
- `schema.sql`
- `seed.sql`

### Runtime, Generated, And Dependency Artifacts

- dependency / generated / runtime output を直接編集しない。
- compiled asset、cache、coverage、log、tmp、vendor dependency を成果物として編集しない。
- lockfile を伴わない dependency 手作業変更をしない。
- dependency update、major version変更、security remediation は human gate 対象とする。

Observed path examples:

- `node_modules/**`
- `.next/**`
- `playwright-report/**`
- `test-results/**`
- `coverage/**`
- `tmp/**`

### Browser Permission And Audio Capture

- OSのマイク許可ダイアログをユーザーの代わりに承認する前提で完了扱いにしない。
- 物理マイクから実音声が入る確認は自動テストだけで完了扱いにしない。Playwrightで確認できるのはブラウザAPI許可パスとstream取得までである。
- tab audio / display media / microphone capture のpermission modelを迂回する変更を行わない。

### Destructive Git And External State

- `git reset --hard`, `git checkout --`, force push、rebase による共有履歴改変を行わない。
- issue、PR、ticket を人間の承認なく close しない。
- 自動 merge を行わない。
- production / staging / external service の状態を変更する command を実行しない。
- push 前には人間へ伝える。merge、deploy、release は人間の明示承認後のみ。

### Test Integrity

- test を green にする目的で test を削除、skip、disable、弱体化しない。
- assertion を緩めるだけの変更をしない。
- Red Team / QA / Tester / Verifier の gate を省略しない。
- 完了条件にある Playwright、unit/API、typecheck、lint、build の確認を実行できない場合は、理由と残リスクを明記する。

## Human Gate Required

次に該当する作業は、Loop が自律的に実行せず human gate に送る。判定は原則としてファイル単位ではなく、変更差分が影響する機能境界で判断する。

- Google OAuth / Supabase Auth / role / permission / JWT / callback URL / redirect origin / RLS に影響する。
- DB schema、Supabase project、RLS、storage、Edge Function、server-side persistence に影響する。
- OpenAI、Anthropic、STT provider、LLM model、provider credential、provider cost、quota、rate limit に影響する。
- 音声、文字起こし、AIカード、LLM入出力、Session Report の保存・保持・ログ・export・暗号化に影響する。
- AIカードの3枚上限、優先度制御、重要語/曖昧表現判定、LLM発火条件に影響する。
- Session Setup の入力項目、会話タイプ、業界、目的、ナレッジ選択、speaker handling に影響する。
- CI/CD、Vercel、production build setting、deploy、domain、DNS、OAuth consent screen に影響する。
- dependency update、lockfile churn、security alert remediation を扱う。

## Ticket And Pattern Constraints

- Orchestrator Agent は raw human request を直接実行しない。
- 実行対象は AI-readable な AI Work Ticket に限る。
- AI Work Ticket の構造不足、仕様未確定、受け入れ基準不足がある場合は実装へ進まない。
- 各ticketはRed Team確認条件を網羅するテストケースを持つ。
- 各ticketはQA Agent、Tester Agent、Verifier Agentの証跡を持つ。
- 各ticketはRed Team `APPROVE` を得るまで `done` にしない。
- ループ処理終了条件は、対象ticketすべての完了条件、Red Team gate、QA/Tester/Verifier gate、required checksが通過していることとする。
- Pattern Picker は Pattern 選択だけを行い、AI Work Ticket の schema、status、差し戻し文面は定義しない。
- 現時点で直接起動してよい active Pattern は `daily-triage` のみ。

## Branch, PR, And Merge

- L1 では branch 作成、push、PR 作成を行わない。
- L2 以上では、AI Work Ticket が十分で human gate に該当しない低risk作業に限り、branch作成と限定的な実装を許可できる。
- push 前には人間へ伝える。
- PR 作成 command は L3 以上かつ Activation Record で明示許可されている場合に限る。L2 は PR package 作成まで。
- ready for review への変更、merge、close は人間の明示承認後のみ。
- merge は人間の明示承認後のみ。自動 merge は禁止。

## Verification

- L1 では test 実行を必須にしない。コード変更を行わないため。
- L2 以上でコード変更を行う場合は、提案前に関連 test を実行する。
- MVP実装ticketの標準確認は `npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build` とする。
- browser permission、microphone stream、AIカード3枚上限、LLM dispatch gate、provider diagnostics、auth guard、report export / discard / local save はPlaywrightまたは同等のE2Eで確認する。
- test を実行できない場合は、理由と残リスクを明示する。
- verifier agent を使う場合は、scope、test、risk、deny list違反の有無を確認する。

## Budget

- token spend が daily cap の 80% に達した場合は report-only に切り替える。
- daily cap を超過した場合は no-op とし、次回 Loop に残す。
- L1 では sub-agent spawn を行わない。

## Fallback

判定に迷う場合は、次の順で扱う。

1. deny list に該当する可能性がある場合は `blocked_by_constraints`。
2. 人間の判断が必要な場合は `human_gate_pending`。
3. 仕様、優先度、影響範囲、承認 scope が不明な場合は `needs_human_management`。
4. AI Work Ticket の構造が不足している場合は `ticket_builder_required`。

曖昧なまま `not_required` にしない。
