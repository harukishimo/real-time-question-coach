# Real Provider Readiness AI Work Tickets

作成日: 2026-07-09

## Purpose

この文書は、Realtime Question Coach MVP を「外部サービスの環境変数を設定すれば real provider 動作確認へ進める一歩手前」まで進めるための、後続 AI Work Ticket 起票証跡である。

対象は `RQC-W21` から `RQC-W33` まで。既存 `RQC-W01` から `RQC-W20` は local/mock MVP の完了範囲として扱う。

各チケットの内容、完了条件、必須検証、対象外は `docs/real-provider-readiness-ticket-completion-matrix.md` を正とする。

## Execution Boundary

- `allowed_autonomy`: `L3`
- 実行範囲: code / docs / tests only
- real provider 実行: human-run only
- secret 作成・閲覧・投入: prohibited
- deploy / production operation / push / merge: prohibited
- `.env` / `.env.*` の読取・編集: prohibited
- `.env.example` は secret 実値なしの placeholder documentation としてのみ編集可
- 会話本文、音声、AIカード本文、LLM入力、LLM出力、レポート本文の server DB 保存は禁止
- provider 送信は処理目的の一時送信のみ。no body log / no server persistence を必須にする

## Review Result

| Reviewer | Result | Required Revision Reflected |
| --- | --- | --- |
| Requirements Ticket Reviewer | `APPROVE_WITH_MINOR_NOTES` | W21/W31, W21/W25 の境界明確化。real smoke skip条件を追加 |
| Implementation Readiness Reviewer | `APPROVE_WITH_MINOR_NOTES` | 各ticketのrequired checks、Auth/STT/LLM固有AC、provider-specific official docs確認を追加 |
| Risk And Verification Reviewer | `APPROVE_WITH_MINOR_NOTES` | risk_level、human gate、code-only approval scope、secret/body/log/storage禁止ACを追加 |

## Mandatory Done Gate

各チケットは、実装agentの自己判断だけでは `done` にできない。次をすべて満たすこと。

- Red Team: `APPROVE`
- QA Agent: `passed`
- Tester Agent: `passed`
- Verifier: `APPROVE`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- relevant API / unit / Playwright checks
- `npm run build`
- no secret exposure / no body log / no server DB conversation persistence checks

## Ticket List

| Ticket | Priority | Risk | Title | Goal | Required Checks Summary |
| --- | --- | --- | --- | --- | --- |
| RQC-W21 | P0 | medium | Provider runtime/env/error contract hardening | provider mode matrix、env schema、error taxonomy、mock fallback境界を固める | env unit, missing-env diagnostics, client secret scan, build |
| RQC-W22 | P0 | high | Core privacy/security/rate-limit guardrails | provider API向けのredaction、no body log、no-store、rate limit、DB保存禁止を共通化 | security unit/API, log sentinel, bundle scan, provider API header tests |
| RQC-W23 | P0 | high | Supabase Google OAuth adapter and login flow | Google OAuth login shell、Supabase client/server境界、callback/session処理を作る | auth unit/API, Playwright login shell, service-role exposure negative test |
| RQC-W24 | P0 | high | Auth role/permission guard integration | owner/user/dev role、API guard、unauthorized UI/API、role escalation防止を実装する | role unit, API 401/403, role escalation negative test, Playwright guard |
| RQC-W25 | P0 | high | STT token provider contract | short-lived STT token、provider-neutral adapter、OpenAI STT初期候補、TTL/user bindingを定義する | token API tests, TTL tests, no relay/storage tests, provider docs check |
| RQC-W26 | P1 | high | Browser audio to STT connection pipeline | ブラウザ音声取得をSTT adapterへ接続し、permission/fallback/lifecycleを扱う | Playwright mic, mocked stream tests, no audio storage, permission failure tests |
| RQC-W27 | P1 | high | STT transcript event normalization | provider partial/final eventsをTranscriptSegmentへ正規化する | event parser unit, partial/final tests, reconnect/timeout tests, no transcript persistence |
| RQC-W28 | P0 | high | LLM coach adapter | 初期providerはOpenAI、代替providerはAnthropic Claudeを想定し、provider-neutral adapter、最小payload、schema validation、candidate capを実装する | adapter unit, provider switch tests, schema failure tests, no LLM body log/storage, OpenAI/Anthropic docs check |
| RQC-W29 | P0 | high | AI trigger/dispatch hardening | LLM常時呼び出しを避け、priority/cooldown/idempotency/manual recheckを厳格化する | trigger matrix, call count, cancellation, active max 3, Playwright card flow |
| RQC-W30 | P1 | high | LLM report adapter | 初期providerはOpenAI、代替providerはAnthropic Claudeを想定し、report用provider-neutral adapter、structured report schema、mock fallbackを実装する | report API tests, provider switch tests, schema failure tests, no report persistence/logging, OpenAI/Anthropic docs check |
| RQC-W31 | P1 | high | Provider diagnostics UX/API errors | missing env、invalid token、rate limit、timeout等を安全な診断へ変換する | diagnostics unit/API, UI error tests, no secret/body in errors or snapshots |
| RQC-W32 | P0 | medium | Deploy-readiness docs/env checklist | Vercel/Supabase/STT/LLM(OpenAI/Anthropic Claude)のenv checklistとREADMEを整備する | docs review, `.env.example` placeholder scan, provider env consistency check, no real secret check |
| RQC-W33 | P0 | medium | Full mock plus optional real-provider verification pack | mock自動検証とhuman-run real provider smoke checklistを用意する | full mock suite, real smoke skip by default, RUN_REAL_PROVIDER_SMOKE opt-in tests |

## Notes

- `RQC-W21` は taxonomy/config contract の定義を担当し、`RQC-W31` は user-safe diagnostics UX/API mapping を担当する。
- `RQC-W21` は共通 provider config を扱い、`RQC-W25` は STT 固有 token/config validation を扱う。
- `RQC-W25` の初期 real STT 候補は OpenAI STT / Realtime transcription とする。ただし adapter は provider-neutral に維持する。
- `RQC-W28` と `RQC-W30` は `RQC_LLM_PROVIDER=mock|openai|anthropic` の切替を前提にする。初期real候補はOpenAIだが、Anthropic Claudeへ差し替えても下流schemaが変わらないadapter境界を必須とする。
- `RQC-W28` と `RQC-W30` は選択providerの公式docs確認、structured schema failure時の安全なfallback、timeout/error時のsafe diagnosticを必須とする。
- `RQC-W33` の real-provider smoke は CI 標準では必ず skip する。`RUN_REAL_PROVIDER_SMOKE=1` かつ必要 env が存在する場合のみ、人間が実行する。
