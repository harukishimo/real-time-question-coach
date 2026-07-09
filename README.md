# Realtime Question Coach

Realtime Question Coach is a Next.js / React MVP for reducing missed questions during live conversations.

The MVP is mock-first: it can run locally without real Supabase, STT, or LLM credentials. Real providers are isolated behind adapter boundaries so they can be swapped in later through environment variables and server-side API routes.

## Current Scope

- Google OAuth / Supabase Auth adapter boundary with local mock fallback
- Session Setup with conversation type, industry, purpose, must-check items, audio source, and fixed no-server-storage policy
- Browser-memory session profile, repository playbook resolution, dummy transcript engine, transcript buffer
- Category playbooks under `playbooks/` for sales, requirements, recruiting, and user research
- Local Rule Gate to avoid constant LLM calls
- Mock coach API and card engine with active cards capped at 6 in a scrollable pane
- Audio source capture, short-lived STT token API, and OpenAI Realtime WebRTC client boundary
- Session Report, Markdown export, JSON export, local browser save, and discard
- Security guardrails for no server DB persistence of conversation data and no body logging

## Local Setup

```bash
npm install
DEV_AUTH_ENABLED=true RQC_LOCAL_RUNTIME=true NEXT_PUBLIC_RQC_AUTH_MODE=mock npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` only if you need local overrides. Do not put real secrets in the repository.

Default local mode:

```text
NEXT_PUBLIC_RQC_AUTH_MODE=mock
NEXT_PUBLIC_RQC_PROVIDER_MODE=mock
DEV_AUTH_ENABLED=true
RQC_LOCAL_RUNTIME=true
RQC_LLM_PROVIDER=mock
RQC_STT_PROVIDER=mock
```

`DEV_AUTH_ENABLED=true` and `RQC_LOCAL_RUNTIME=true` are for local development only. In production, mock/dev auth must stay disabled and Google OAuth through Supabase Auth should be configured instead.

Production-like provider mode:

```text
NEXT_PUBLIC_RQC_AUTH_MODE=supabase
NEXT_PUBLIC_RQC_PROVIDER_MODE=real
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-publishable-or-anon-key>
RQC_LLM_PROVIDER=mock|openai|anthropic
RQC_STT_PROVIDER=mock|openai
LLM_MODEL_REALTIME=<provider-model-for-coach-cards>
LLM_MODEL_REPORT=<provider-model-for-session-report>
OPENAI_API_KEY=<server-only-openai-key>
ANTHROPIC_API_KEY=<server-only-anthropic-key>
STT_API_KEY=<server-only-stt-key>
RUN_REAL_PROVIDER_SMOKE=0
```

`RQC_LLM_PROVIDER` is intentionally provider-selectable. Valid implementation targets are `mock`, `openai`, and `anthropic`; OpenAI is the initial real-provider candidate, and Anthropic Claude remains replaceable through the same server-side adapter contract.

`RQC_STT_PROVIDER` is `mock` or `openai`. The app does not send audio bytes through `/api/stt-token`; that route only issues a short-lived, user/session-bound token contract for direct browser-to-provider streaming.

Server-only keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `STT_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser. Real provider integration should be added through the existing API/adapter boundaries.

## Supabase Google OAuth

Set the Supabase Auth provider to Google outside this repository. The local callback URL is:

```text
http://localhost:3000/auth/callback
```

For a deployed preview or production URL, add:

```text
https://<your-app-domain>/auth/callback
```

The callback URL is where Google/Supabase returns the browser after OAuth. It must be in the Supabase redirect allow list. The app uses the Supabase browser client for PKCE session hydration and sends the resulting access token to protected API routes as `Authorization: Bearer <token>`.

Supabase user role metadata must explicitly be `owner` or `user`. Unknown, missing, or client-injected roles are rejected by protected API routes.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`npm run test:e2e` starts the local Next.js dev server through Playwright.

## Audio And STT Status

Playwright verifies browser microphone permission and a live `getUserMedia({ audio: true })` stream. The app now starts a retained browser audio stream, obtains a short-lived `/api/stt-token`, and, when `RQC_STT_PROVIDER=openai`, connects the browser directly to OpenAI Realtime over WebRTC with the ephemeral token. In mock mode the stream is immediately stopped after the token boundary is verified.

The Next API route never accepts audio bytes, audio files, or remote audio URLs. Realtime transcript deltas/completions are normalized in the browser before becoming `TranscriptSegment` data. Physical speech-to-text accuracy and real provider smoke runs remain human-run only because they require external credentials, provider account settings, and real audio.

## Real Provider Verification

Automated checks use mock providers by default and must not call external providers. Human-run smoke checks are opt-in only:

```bash
RUN_REAL_PROVIDER_SMOKE=1 npm test
```

If required env vars are missing, the verification pack records `not_run` with env names only. It must not echo secret values, transcript bodies, audio, LLM inputs/outputs, AI card bodies, or report bodies.

Expected provider failure behavior:

- Missing env: protected provider APIs return a safe `missing_env` diagnostic with env names only.
- Invalid provider or model: requests fail before provider dispatch with `invalid_config`.
- Timeout, 429, quota, denied, or schema drift: provider errors are normalized into safe diagnostics. Raw provider payloads and secret-like values are not returned.
- Report provider failure: the app stays on the realtime session screen and does not expose export actions for a failed report.
- `NEXT_PUBLIC_RQC_PROVIDER_MODE=real`: both LLM and STT providers must be non-mock and ready. Real mode must not silently fall back to mock.

## Safety Boundaries

- Do not create, read, or edit `.env` files.
- Do not put real secrets into the repository.
- Do not deploy, push, merge, or touch production services from this workspace.
- Conversation text, audio, AI card text, LLM inputs/outputs, and report bodies must not be stored in a server DB.
- Local export and local browser save require explicit user action.

## Deploy Readiness

This repository is intended to stop at deploy-ready code and documentation. Deployment itself, production operation, secret creation/view/insertion, push, and merge are out of scope for the Loop execution.
