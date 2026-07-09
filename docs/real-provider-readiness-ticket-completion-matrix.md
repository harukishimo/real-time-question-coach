# Real Provider Readiness Ticket Completion Matrix

作成日: 2026-07-09

## 目的

この文書は、`RQC-W21` から `RQC-W33` までの各チケットについて、実装内容と完了条件をマトリクス化したものである。

対象チケットの目的は、Realtime Question Coach MVP を「外部サービスの環境変数を設定すれば real provider 動作確認へ進める一歩手前」まで持っていくことである。

## 共通実行境界

| 項目 | 内容 |
| --- | --- |
| 対象 | `RQC-W21` から `RQC-W33` |
| 自律度 | `L3` |
| 実行範囲 | code / docs / tests only |
| real provider 実行 | AIは実行しない。human-run only |
| secret | 作成、閲覧、投入、表示は禁止 |
| `.env` / `.env.*` | 読取、編集は禁止 |
| `.env.example` | secret実値なしのplaceholder documentationとしてのみ編集可 |
| deploy / production | 禁止 |
| push / merge | 禁止 |
| server DB保存禁止 | audio、transcript body、AI card body、LLM input、LLM output、report body |
| logging禁止 | audio、transcript body、AI card body、LLM input、LLM output、report body、secret |

## LLM Provider方針

| 項目 | 内容 |
| --- | --- |
| 初期候補 | `OpenAI` |
| 代替候補 | `Anthropic Claude` |
| provider選択 | `RQC_LLM_PROVIDER=mock\|openai\|anthropic` |
| server-only key | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`。どちらもclientへ露出しない |
| model env | `LLM_MODEL_REALTIME`, `LLM_MODEL_REPORT`。providerごとに利用可能なmodel名を人間が設定する |
| adapter contract | OpenAI / Claude / mock の出力を同じ `CoachCardCandidate` または `SessionReport` schemaへ正規化する |
| docs確認 | 実装時は選択providerの公式docsを確認する。OpenAI固定の実装にしない |

## 共通完了ゲート

各チケットは、下記をすべて満たすまで `done` にできない。

| Gate | 必須条件 |
| --- | --- |
| Red Team | `APPROVE`。`APPROVE_WITH_MINOR_NOTES` では `done` 不可 |
| QA Agent | `passed`。acceptance criteria traceability、required checks coverage、negative cases、security/storage/logging review を含む |
| Tester Agent | `passed`。commands run、test files、fixtures、browser/viewport、pass/fail/not_run、trace/screenshot status を含む |
| Verifier | `APPROVE` |
| 基本コマンド | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| 関連検証 | ticketごとの unit / API / Playwright / docs check |
| security | secret client exposureなし、body logなし、server DB conversation persistenceなし |
| 証跡 | `verification_evidence` または `done_evidence` に構造化して記録 |

## Ticket Matrix

| Ticket | 内容 | 完了条件 | 必須検証 / 証跡 | 対象外 |
| --- | --- | --- | --- | --- |
| `RQC-W21` | Provider runtime/env/error contract hardening。provider mode matrix、env schema、server/client env分離、shared error taxonomy、mock fallback境界を定義する。 | `mock`, `missing-env`, `real-enabled` の挙動が明確。`real-enabled` でenv不足時に黙ってmockへ落ちず、安全な診断エラーになる。server-only keyがclient configへ出ない。`.env.example` はplaceholderのみ。 | env/config unit。missing-env diagnostics test。client bundle secret scan。`.env.example` placeholder scan。`npm run build`。 | secret実値、`.env`読取、provider console変更、real provider実行、deploy。 |
| `RQC-W22` | Core privacy/security/rate-limit guardrails。provider-facing API向けのredaction、no body log、no-store、server DB保存禁止、rate limit primitiveを共通化する。 | provider-facing API群 `W25`, `W28`, `W30`, `W31` に共通guardrailを適用できる。server log、client diagnostics、test snapshotsにtranscript/audio/LLM input/output/report body/secretが出ない。 | security unit/API。no-log sentinel。DB write negative test。client bundle secret scan。provider API no-store header test。rate limit test。 | production monitoring、real provider実行、secret処理、test弱体化。 |
| `RQC-W23` | Supabase Google OAuth adapter and login flow。Supabase browser/server client境界、Google OAuth sign-in/sign-out shell、callback/session hydrationを実装する。 | Supabase env設定後にOAuth flowへ進めるコード境界がある。mock authはlocal-only fallbackとして維持。callback origin allowlistが文書化される。service role keyがclientへ露出しない。 | auth unit/API。Playwright login shell。callback/session mocked tests。service-role exposure negative test。official Supabase docs確認。 | Supabase project設定、Google console設定、callback登録、secret投入、real OAuth実行。 |
| `RQC-W24` | Auth role/permission guard integration。owner/user/dev role resolution、API guard、unauthorized UI/API states、role escalation防止を実装する。 | guestは保護API/UIへ入れない。owner/user/dev roleが最小権限で解決される。Supabase metadataはauth/profile/roleのみ。会話、音声、transcript、AI出力、report本文を保存しない。 | role unit。API 401/403。role escalation negative test。Playwright guard。metadata minimization check。 | org管理、管理者監査、広範RBAC、production user mutation。 |
| `RQC-W25` | STT token provider contract。short-lived STT token、provider-neutral adapter、OpenAI STT/Reatime候補、TTL/user/session bindingを定義する。 | STT token APIがprovider configとaudioSourceを検証する。tokenにはTTLがあり、可能な範囲でuser/sessionに紐づく。provider master secretを返さない。Next APIで長時間audio relayしない。OpenAI real候補では transcription session / WebRTC `realtimeUrl` を返す。 | `/api/stt-token` API tests。TTL/user-binding tests。invalid audio source test。OpenAI Realtime token payload test。no relay/storage tests。no secret/body log tests。official STT provider docs確認。 | provider account設定、secret投入、real STT実行、audio保存、server relay。 |
| `RQC-W26` | Browser audio to STT connection pipeline。microphone/tab audio captureをSTT adapter lifecycleへ接続し、permission/fallback/lifecycleを扱う。 | audio stream start/stop/errorがmock STT adapterで再現できる。OpenAI real候補では browser `MediaStream` のaudio trackだけをWebRTC peer connectionへ渡し、SDPをephemeral tokenで送信する。permission denied、unsupported tab/system audio、no-audio-track、provider unavailable時に安全にfallbackする。audioを保存しない。 | Playwright microphone permission/live stream。mocked stream lifecycle tests。WebRTC connection unit。permission failure tests。no-audio-track fallback tests。no audio storage check。 | 物理発話の認識精度確認、AIによるreal STT実行、audio保存。 |
| `RQC-W27` | STT transcript event normalization。provider partial/final eventsを`TranscriptSegment`へ正規化し、speaker unknown、reconnect、timeout、malformed eventを扱う。 | provider eventが安定したpartial/final segmentになる。OpenAI delta はitem単位で蓄積し、completedでfinal化する。unknown speakerを安全に扱う。重複final、空text、timeout、reconnect、malformed eventで破綻しない。transcript bodyをserver保存しない。 | event parser unit。OpenAI delta/completed tests。partial/final tests。speaker unknown tests。reconnect/timeout tests。no transcript persistence test。official provider event docs確認。 | 完璧なdiarization、server transcript DB、provider固有最適化の作り込み。 |
| `RQC-W28` | LLM coach adapter。初期providerはOpenAI、代替providerとしてAnthropic Claudeを想定し、provider別server-side adapter、model env、minimal payload builder、structured response validation、candidate capを実装する。 | `RQC_LLM_PROVIDER=mock\|openai\|anthropic` の切替境界があり、OpenAIまたはClaudeのenv設定後にserver-side adapter経由でschema-validなカード候補を生成できるコード境界がある。payloadは必要最小限。candidateは上限管理される。schema failure時は安全に破棄/診断する。LLM bodyを保存/ログしない。 | adapter unit。`/api/coach` API tests。mock/openai/anthropic provider switch tests。valid/invalid schema tests。payload minimization snapshot。no LLM body log/storage tests。official OpenAI/Anthropic docs確認。 | client-side LLM key、real LLM実行、unbounded prompt、server DB保存、provider固有schemaの下流漏れ。 |
| `RQC-W29` | AI trigger/dispatch hardening。final-only trigger、priority、cooldown、idempotency、cancellation、manual recheck、pinned/queued interactionを厳格化する。 | partial transcriptではLLMを呼ばない。final triggerでもpriority/cooldown/idempotency/in-flight limitで呼び出しが制御される。manual recheckは明示操作で、active card最大3とpinned保護を壊さない。 | trigger matrix tests。adapter call count tests。cooldown tests。cancellation tests。manual recheck tests。Playwright card flow。active card max 3 assertion。 | always-on LLM polling、音声割り込み、無制限カード表示。 |
| `RQC-W30` | LLM report adapter。初期providerはOpenAI、代替providerとしてAnthropic Claudeを想定し、report用provider adapter、report model env、minimal payload、structured report schema、mock fallbackを実装する。 | `RQC_LLM_PROVIDER=mock\|openai\|anthropic` の切替境界があり、OpenAIまたはClaudeのenv設定後にserver-side adapterでschema-valid reportを生成できるコード境界がある。schema/provider failure時は安全にfallback/diagnostic。report bodyとLLM I/Oをserver保存/ログしない。 | report adapter unit。`/api/report` API tests。mock/openai/anthropic provider switch tests。valid/invalid schema tests。provider timeout/error tests。no report persistence/logging tests。official OpenAI/Anthropic docs確認。 | full議事録プロダクト化、server report保存、real LLM実行、provider固有schemaの下流漏れ。 |
| `RQC-W31` | Provider diagnostics UX/API errors。missing env、invalid token、rate limit、timeout、provider denied、quota、schema failureを安全なUI/API診断へ変換する。 | error responseとUI表示にsafe code、safe message、retryability、provider categoryが含まれる。raw provider error、secret、transcript/audio/LLM/report bodyを表示/ログ/snapshotに出さない。 | diagnostics unit/API。UI error tests。snapshot no-sensitive-content tests。auth/STT/LLM/report error fixtures。 | raw provider error露出、secret/body表示、provider console操作。 |
| `RQC-W32` | Deploy-readiness docs/env checklist。Vercel/Supabase/STT/LLM(OpenAI/Anthropic Claude)のenv checklist、setup order、callback URL期待値、mock/real mode、human-owned作業をREADME/.env.exampleへ整理する。 | READMEと`.env.example`に必要env名、mock/real mode、LLM provider選択、設定順序、human-owned作業、deploy境界、既知制限が明記される。secret実値、production URL、個人credentialは含まない。 | docs review。`.env.example` placeholder scan。no real secret scan。README setup path review。provider-specific env consistency check。 | deploy実行、secret値投入、production URL記入、外部console操作。 |
| `RQC-W33` | Full mock plus optional real-provider verification pack。full mock automated suiteと、human-run real provider smoke checklistを分離して用意する。 | mock suiteは自動必須。real smokeはCI標準で必ずskip。`RUN_REAL_PROVIDER_SMOKE=1` かつ必要envがある場合のみhuman-run。missing env時はskip理由を記録する。artifact/log/trace/screenshotにsecret/bodyを残さない。 | `npm run lint`。`npm run typecheck`。`npm test`。`npm run test:e2e` full mock。`npm run build`。real smoke default skip test。missing-env skip test。sanitized artifact check。 | AIによるreal provider smoke実行、secret logging、deploy、production操作。 |

## Red Team追加テスト観点

2026-07-09に、Security/Privacy Red Team、Provider Failure Red Team、QA/E2E/UX Red Teamの3系統で追加確認項目を洗い出した。ここに書かれた項目は、上記の完了条件に加えて `test_perspectives` と `test_plan` に反映する。実装チケットを `done` にするには、該当項目を `passed`、`not_run`、または `human-run only` として証跡化し、Red Team `APPROVE` を得る必要がある。

| Ticket | Red Team追加確認項目 |
| --- | --- |
| `RQC-W21` | env未設定、空文字、whitespace、未知provider、大小文字ゆれ、invalid endpointでunsafe defaultや黙ったmock fallbackにならない。<br>server-only envにdummy sentinelを入れ、client bundle、diagnostics、snapshot、Playwright表示に値が出ない。<br>timeout、auth-like failure、schema error、rate limit、raw provider風secret混入errorがsafe taxonomyとredactionへ変換される。<br>`not_run` 証跡に未実行理由、必要env名、対象provider、確認日時を残し、real provider成功済みと誤認させない。 |
| `RQC-W22` | transcript、audio、AI card、LLM input/output、report body、secret風sentinelをAPI、logs、diagnostics、snapshotsへ流しても本文が残らない。<br>provider-facing API後にDB write spyを置き、server DBへbody系データが保存されない。<br>rate limitを同一user/session/IP、concurrent request、spoofed `X-Forwarded-For`、retryで壊し、provider call前で止まりsafe 429を返す。<br>provider responseのcache headerを壊した場合に `no-store` 欠落を検出する。 |
| `RQC-W23` | Supabase env未設定、不正URL、不正anon keyではOAuth UIを安全にdisabledにし、実ログイン可能に見せない。<br>callbackのmissing code/state、malformed state、expired state、evil origin、open redirect、origin mismatchを拒否する。<br>service role key sentinel、session token、OAuth raw errorがbundle、query string、local/session storage、log、snapshotに出ない。<br>mock auth fallbackはlocal-only境界を越えず、signed-out、signed-in、expired、callback error、mobile導線をPlaywrightで確認する。 |
| `RQC-W24` | anonymous、unknown role、missing role claim、malformed/stale claim、複数role、client注入roleはdefault denyにする。<br>guest、expired session、直URL、browser back、reloadでprotected UI/APIが一瞬でも露出しない。<br>他user/session/org相当resource idでIDOR的に読めない、操作できない。<br>権限不足表示は未ログイン、権限不足、設定未完了を混同せず、logs/artifactsにPIIやtokenを出さない。 |
| `RQC-W25` | missing/invalid env、expired token、長すぎるTTL、不足scope、replay、cross-session、unauthenticated requestをfail closedにする。<br>token TTL、scope、audience、user/session binding、schema drift、extra/missing fields、wrong typeを検証する。<br>`audioSource` にfile URL、remote URL、未知値、巨大値、audio bytesを入れて拒否し、server relay/storage扱いにしない。<br>token実値、provider master secret風sentinelはresponse、log、snapshot、UIに出さない。 |
| `RQC-W26` | microphone denied、permission revoke midstream、no device、silence、too short、too large、unsupported tab/system audio、unsupported MIME、empty/truncated audioを確認する。<br>start/stop連打、unmount中断、upload/stream cancel、provider timeout、rate limit、partial failure、malformed responseでdangling stream、retry storm、二重送信が残らない。<br>Playwrightで録音開始、停止、送信中、失敗、再試行、responsive表示、fake media permission success pathを確認する。<br>audio bytes、blob URL、audio由来sentinelは保存、log、trace、screenshot、snapshotに残さない。 |
| `RQC-W27` | 空文字、whitespace、句読点のみ、Unicode、日本語、mixed language、長文、HTML/script/control char、絵文字混在を壊さず正規化する。<br>duplicate final、out-of-order partial/final、reconnect、timeout partial、segment missing timestamp、speaker unknown/spoofed speakerを安全に扱う。<br>malformed event、extra fields、secret風field、schema driftをrejectまたはsafe normalizeし、raw provider payloadをdownstream、log、diagnosticsへ流さない。<br>normalization failureやpartialのみではfinal扱いにせず、LLM triggerやserver persistenceを発生させない。 |
| `RQC-W28` | missing API env、invalid model config、unsupported provider/modelではprovider callを止め、mock fallbackは明示設定時だけ許可する。<br>prompt injection、余計なPII/metadata/history field、secret風textを含むtranscriptでpayload minimizationとredactionを確認する。<br>mock OpenAI/Claudeでsuccess、timeout、rate limit、malformed response、schema mismatch、empty response、過剰candidate、script入りresponseを再現する。<br>provider固有responseを共通 `CoachCardCandidate` schemaへ正規化し、retry/cancelはidempotentにし、古いcoach responseを新しいtranscript結果として表示しない。 |
| `RQC-W29` | partial transcript floodではadapter call countを0に保ち、final duplicate、replay、rapid retry、double click、tab reload、network abortで重複dispatchしない。<br>priority、cooldown、idempotency、in-flight limit、manual recheck、cancel、timeout、retry exhaustionのstate transitionを確認する。<br>provider disabled、readiness failed、401、403、429、5xx、invalid JSONではreal providerへ進まずsafe errorと `not_run` または failed 証跡を残す。<br>pinnedありでactive card overflowを壊し、最大3件、pinned保護、stale delayed response破棄を確認する。 |
| `RQC-W30` | missing/invalid report model config、unsupported provider/model、unsupported output schemaではfail closedにする。<br>minimal payload以外のtranscript、AI card、history、PII fieldを混ぜても送信せず、long transcript、prompt overflow、malformed JSON、missing section、extra field、schema driftを検出する。<br>OpenAI/Claude双方のtimeout、rate limit、retry exhaustion、provider error、secret風sentinel混入errorをnormalized errorにする。<br>report body、provider raw response、LLM I/Oをserver DB、log、artifactへ残さず、失敗reportを成功export/download扱いにしない。 |
| `RQC-W31` | diagnosticsはenv presence、mock/real mode、provider readiness、`not_run` 理由を示してもsecret実値やprovider raw payloadを表示しない。<br>unavailable、rate limited、timeout、quota、invalid token、provider denied、schema drift、unknown errorを区別し、retryability/categoryで安全に表示する。<br>unauthorized userにprovider readinessや他user rate limit/quota内部値を漏らさない。<br>all green、partial unavailable、all unavailable、unknown errorをPlaywrightで確認し、color、文言、aria label、responsive、export/copy/logのredactionを確認する。 |
| `RQC-W32` | READMEと `.env.example` にreal-looking secret、production URL、個人credential、secret投入をAIへ要求する文言がないことをscanする。<br>required env names、public env/server-only env、service-role禁止境界、LLM provider選択、OpenAI/Anthropic server-only key境界、mock test command、human-run smoke、default skip、callback URL期待値を明記する。<br>missing/invalid env時のexpected behavior、rollback/fallback、privacy/no-log、rate limit、timeout、schema driftの確認観点をdocsに含める。<br>docsとCI guardが一致し、real provider検証のAI可能範囲とhuman-only範囲を混同しない。 |
| `RQC-W33` | verification packにW21-W32のmock unit/API/Playwright/docs check結果、Red Team、QA、Tester、Verifier、`not_run` evidenceを分離して入れる。<br>CI/local defaultではreal smokeがskipされ、`RUN_REAL_PROVIDER_SMOKE=1` なしに外部通信しない。env不足時もsafe skip理由を残し、値をechoしない。<br>fake secret/body sentinel、raw audio、transcript、provider payload、token、不要PIIがlog、trace、screenshot、report artifactへ混入しない。<br>missing env、invalid config、timeout、rate limit、schema drift、fallback、cancel/retry、external network禁止の代表ケースを含め、未実行をpassに混ぜない。 |

## 依存関係の見方

| Ticket | 主な依存 |
| --- | --- |
| `RQC-W21` | `RQC-W20` |
| `RQC-W22` | `RQC-W21` |
| `RQC-W23` | `RQC-W21`, `RQC-W22` |
| `RQC-W24` | `RQC-W23` |
| `RQC-W25` | `RQC-W21`, `RQC-W22`, `RQC-W24` |
| `RQC-W26` | `RQC-W25` |
| `RQC-W27` | `RQC-W26` |
| `RQC-W28` | `RQC-W21`, `RQC-W22`, `RQC-W24`, `RQC-W29` |
| `RQC-W29` | `RQC-W10`, `RQC-W11`, `RQC-W13`, `RQC-W22` |
| `RQC-W30` | `RQC-W21`, `RQC-W22`, `RQC-W24`, `RQC-W28` |
| `RQC-W31` | `RQC-W21`, `RQC-W22`, `RQC-W23`, `RQC-W25`, `RQC-W28`, `RQC-W30` |
| `RQC-W32` | `RQC-W21` から `RQC-W31` |
| `RQC-W33` | `RQC-W21` から `RQC-W32` |

## 完了判定で禁止する言い換え

次の状態は `done` とみなさない。

- mockだけが動いているのに real provider ready と表現する。
- env不足時に黙ってmockへfallbackする。
- real smokeをAIがsecretなしで実行したことにする。
- Playwright happy path 1本だけで完了にする。
- Red Team / QA / Tester / Verifier のいずれかが未実施。
- no body log / no server DB persistence / no secret exposure の証跡がない。
- `RUN_REAL_PROVIDER_SMOKE=1` のskip条件、not_run理由、human-run境界が記録されていない。

## 実装・検証完了証跡

2026-07-09 のL3実装runで、`RQC-W21` から `RQC-W33` までのコード、docs、tests範囲を実装し、各チケットのRed Team追加確認項目をテストケースへ反映した。

正本の完了証跡:

- `docs/real-provider-verification-pack.md`
- `loop-run-log.md`

実行済みゲート:

- `npm run typecheck`: `passed`
- `npm test`: `passed` (`18 files / 120 tests`)
- `npm run lint`: `passed`
- `npm run test:e2e`: `passed` (`16 Playwright tests`)
- `npm run build`: `passed`
- Red Team: `APPROVE`
- QA Agent: `passed`
- Tester Agent: `passed`
- Verifier: `APPROVE`
