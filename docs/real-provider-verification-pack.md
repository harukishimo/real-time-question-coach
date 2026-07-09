# Real Provider Readiness Verification Pack

作成日: 2026-07-09

対象: `RQC-W21` から `RQC-W33`

## 実行境界

- 実施範囲: code / docs / tests
- 未実施: deploy、production操作、secret作成・閲覧・投入、push、merge、real provider実行
- real provider smoke: `RUN_REAL_PROVIDER_SMOKE=1` かつ必要envがある場合のみhuman-run
- default automated suite: mock providerのみ。外部通信なし

## Verification Commands

| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | `passed` | TypeScript strict check |
| `npm test` | `passed` | 18 files / 120 tests |
| `npm run lint` | `passed` | ESLint max warnings 0 |
| `npm run test:e2e` | `passed` | 16 Playwright tests。sandboxでのserver起動は権限付き実行で通過 |
| `npm run build` | `passed` | Next.js production build |

## Ticket Evidence Matrix

| Ticket | Implemented Evidence | Red Team Test Coverage | Result |
| --- | --- | --- | --- |
| `RQC-W21` | `src/lib/env.ts`, `src/lib/provider-diagnostics.ts`, `.env.example` | `src/lib/env.test.ts`, `src/lib/provider-diagnostics.test.ts`, `src/lib/verification-pack.test.ts` で unknown provider、whitespace/case、real-mode no-mock、model mismatch、taxonomy、redaction、not_runを確認 | `APPROVE` |
| `RQC-W22` | `src/lib/security.ts`, `src/lib/api-response.ts` | `src/lib/security.test.ts`, `src/app/api/api-routes.test.ts` で redaction、no-store、no-log、per-user/per-session rate limit、sessionId rotation bypass拒否、audio/body拒否を確認 | `APPROVE` |
| `RQC-W23` | `@supabase/supabase-js`, `src/lib/auth-client.ts`, `src/lib/oauth-callback.ts`, `src/app/auth/callback/page.tsx` | `src/lib/auth.test.ts`, `tests/e2e/auth-guards.spec.ts` で callback URL、origin/next/state拒否、未設定Supabase fail closed、callback pageを確認 | `APPROVE` |
| `RQC-W24` | `src/lib/auth.ts`, `src/lib/auth-client.ts`, protected API guards | `src/lib/auth.test.ts`, `src/app/api/api-routes.test.ts`, `tests/e2e/auth-guards.spec.ts` で invalid role、guest 401、dev auth local-only、`user_metadata.role` escalation拒否、protected UI非露出を確認 | `APPROVE` |
| `RQC-W25` | `src/lib/stt.ts`, `src/app/api/stt-token/route.ts` | `src/lib/stt.test.ts`, `src/app/api/api-routes.test.ts` で TTL、provider expiry cap、expired/oversized/schema drift、provider timeout、scope、user/session binding、master secret非返却、URL/huge audioSource/audio body拒否、OpenAI Realtime transcription token payload、WebRTC `realtimeUrl` を確認 | `APPROVE` |
| `RQC-W26` | `src/lib/audio-source.ts`, `src/lib/realtime-stt-client.ts`, UI `startAudioTranscription` session binding | `src/lib/audio-source.test.ts`, `src/lib/realtime-stt-client.test.ts`, `tests/e2e/audio-source-permissions.spec.ts` で retained stream、mock stop、no-audio-track fallback、WebRTC SDP POST、audio-track only addTrack、final commit/cleanup、getUserMedia、Playwright mic permission/live stream、getDisplayMedia fallback、unsupported system audioを確認 | `APPROVE` |
| `RQC-W27` | `src/lib/transcript.ts`, `src/lib/realtime-stt-client.ts` provider event normalization | `src/lib/transcript.test.ts`, `src/lib/realtime-stt-client.test.ts` で OpenAI delta accumulation、completed event、partial/final、unknown/spoofed speaker、empty/malformed/timeout、duplicate/out-of-order、long unicode、secret extra field、control charを確認 | `APPROVE` |
| `RQC-W28` | `src/lib/llm-adapter.ts`, `/api/coach` | `src/lib/llm-adapter.test.ts`, `src/app/api/api-routes.test.ts` で OpenAI/Anthropic response parsing、schema mismatch、timeout/rate/empty、payload redaction/minimization、candidate cap、missing/invalid env fail closedを確認 | `APPROVE` |
| `RQC-W29` | `src/lib/rule-gate.ts`, UI manual recheck flow | `src/lib/coach-flow.test.ts`, `tests/e2e/realtime-session.spec.ts` で final-only、duplicate、in-flight、cooldown、manual recheck body、double-click duplicate dispatch guard、active max 3を確認 | `APPROVE` |
| `RQC-W30` | `src/lib/report-adapter.ts`, `/api/report` | `src/lib/report-adapter.test.ts`, `src/app/api/api-routes.test.ts`, `tests/e2e/session-report-export.spec.ts` で OpenAI/Anthropic switch、timeout/rate/schema failure、payload redaction/minimization、real failure 422、failed report non-export、no persistence/loggingを確認 | `APPROVE` |
| `RQC-W31` | `src/lib/provider-diagnostics.ts`, `/api/diagnostics`, UI診断ボタン | `src/lib/provider-diagnostics.test.ts`, `src/app/api/api-routes.test.ts`, `tests/e2e/realtime-session.spec.ts` で taxonomy、unauthorized denial、authenticated diagnostics、secret/body非表示、not-ready UI、safe messageを確認 | `APPROVE` |
| `RQC-W32` | `README.md`, `.env.example`, this verification pack | `src/lib/docs-security.test.ts`、docs review、placeholder scan、provider env consistency、callback URL説明、expected provider failure behavior、human-run境界を確認 | `APPROVE` |
| `RQC-W33` | `src/lib/verification-pack.ts`, full mock test suite | `src/lib/verification-pack.test.ts`, full command suite、Red Team re-review、default skip、missing-env not_run、secret値非出力、mock suite必須を確認 | `APPROVE` |

## Red Team Verdict

| Reviewer | Verdict | Scope |
| --- | --- | --- |
| Security/Privacy Red Team | `APPROVE` | secret、audio、transcript、LLM I/O、AI card、report bodyのserver persistence/log/snapshot露出を検査 |
| Provider Failure Red Team | `APPROVE` | missing env、invalid provider、timeout/rate/schema failure、OpenAI/Anthropic provider-neutral境界を検査 |
| QA/E2E/UX Red Team | `APPROVE` | Login、callback、Session Setup、audio permission、diagnostics、coach cards、report/export、responsiveを検査 |

## QA / Tester / Verifier

| Agent | Result | Evidence |
| --- | --- | --- |
| QA Agent | `passed` | Acceptance criteria traceability、negative cases、security/storage/logging観点を上記matrixへ紐付け |
| Tester Agent | `passed` | unit/API 112件、Playwright 16件、build/lint/typecheck通過 |
| Verifier | `APPROVE` | common gate、ticket-specific Red Team coverage、not_run boundary、human-only real provider boundaryを確認 |

## Human-run Remaining Work

- Supabase project作成、Google OAuth provider設定、redirect allow list登録
- Vercel等のdeploy先作成と環境変数投入
- OpenAI / Anthropic / STT providerのsecret発行と投入
- `RUN_REAL_PROVIDER_SMOKE=1` での実provider smoke
- production deploy、push、merge
