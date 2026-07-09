# Provider Privacy And Browser Audio Notes

確認日: 2026-07-09

この文書は、STT/LLM provider の no-training / retention / no-store 条件と、Web音声取得の対応範囲を整理する。

## Sources Checked

| Area | Source |
|------|--------|
| OpenAI business/API data handling | https://openai.com/enterprise-privacy/ |
| Anthropic commercial training policy | https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training |
| Anthropic commercial retention policy | https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data |
| MDN `getDisplayMedia` | https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia |
| MDN `getUserMedia` | https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia |
| Chrome screen sharing controls | https://developer.chrome.com/docs/web-platform/screen-sharing-controls |

## OpenAI API

Official OpenAI business privacy docs state:

- Business/API data is not used for model training by default unless explicitly opted in.
- API inputs and outputs may be retained for up to 30 days for service provision and abuse monitoring, except for certain endpoints/features.
- Zero Data Retention can be requested for eligible endpoints and qualifying use cases.
- Data is encrypted in transit and at rest according to OpenAI's stated enterprise privacy commitments.

Project decision:

- Do not assume OpenAI API is zero-retention by default.
- Treat OpenAI as acceptable for MVP real-provider smoke only after the human confirms organization policy, account settings, and any required ZDR / DPA / BAA terms.
- Never send secret values, full unnecessary transcript history, or server-persisted conversation bodies.

## Anthropic API

Official Anthropic commercial privacy docs state:

- Commercial products such as Anthropic API do not use inputs or outputs for model training by default.
- Feedback, bug reports, explicit opt-in, and safety/policy review paths can be handled differently.
- Anthropic API inputs and outputs are automatically deleted on the backend within 30 days by default, with exceptions such as longer-retention services, separate agreements, usage policy enforcement, and legal requirements.
- Zero Data Retention requires a separate agreement and may not apply to every product or feature.

Project decision:

- Do not assume Anthropic API is zero-retention by default.
- Treat Anthropic as an adapter-compatible alternative to OpenAI, not a privacy upgrade by default.
- Human must confirm account/org settings, commercial terms, and ZDR applicability before real conversation data is sent.

## STT Provider Privacy

Current implementation supports:

- `RQC_STT_PROVIDER=mock`
- `RQC_STT_PROVIDER=openai`

For OpenAI STT / Realtime transcription, apply the same OpenAI API boundary above unless a provider-specific policy or ZDR agreement says otherwise.

Project decision:

- Real STT smoke is human-run only.
- Browser audio streams directly to the STT provider when real STT is enabled; Next API issues only the short-lived token and does not relay audio.
- OpenAI Realtime WebRTC is the initial real STT client boundary. The browser fetches an ephemeral token from `/api/stt-token`, POSTs SDP to `https://api.openai.com/v1/realtime/calls`, and listens for transcript delta/completed events on the Realtime data channel.
- Do not send real meeting audio until the human confirms provider retention, training, DPA/ZDR expectations, and account configuration.
- Next API routes must not relay or persist long-running audio streams.

Implementation references:

- OpenAI Realtime WebRTC guide: https://developers.openai.com/api/docs/guides/realtime-webrtc
- OpenAI Realtime transcription guide: https://developers.openai.com/api/docs/guides/realtime-transcription

## Browser Audio Support

### Microphone

MDN documents `getUserMedia()` as broadly available, but only in secure contexts. `localhost` is treated as a secure context for development. User permission is required.

Project decision:

- Microphone is the primary MVP audio path.
- Automated Playwright checks may verify browser API permission and live stream acquisition.
- The app keeps the acquired audio stream only for the active STT connection and stops all tracks on mock fallback, stop, session end, setup navigation, discard, or connection failure.
- Physical microphone speech content and STT accuracy remain human-run checks.

### Browser Tab / Display Audio

MDN documents `getDisplayMedia()` as limited availability and notes that audio support varies by browser and selected display surface.

Chrome documentation states:

- `systemAudio` is available in Chrome desktop.
- Chrome can offer tab/window audio capture separately from entire-screen system audio.
- Chrome docs recommend setting screen-sharing controls explicitly because defaults may change.

Project decision:

- Browser tab / system audio uses `getDisplayMedia({ audio: true, video: true })`.
- If the selected surface does not provide an audio track, the app stops the returned stream and falls back to dummy transcript mode.
- Only audio tracks are added to the STT WebRTC peer connection; display video tracks are stopped during cleanup and are not sent to STT.

Project decision:

- Browser tab audio is best-effort and Chrome/Chromium-first.
- System audio is not a guaranteed cross-browser MVP feature.
- UI must provide fallback to microphone or dummy mode when display audio is unsupported or denied.
- `getDisplayMedia()` must be initiated by explicit user action and cannot be treated as a persistent permission.

## MVP Acceptance Boundary

For MVP, completion means:

- microphone permission and stream path works in browser automation;
- browser tab / display audio path is present with fallback;
- real STT/LLM provider smoke is documented as human-run only;
- provider retention/no-training/ZDR assumptions are documented and not silently treated as guaranteed.

Completion does not mean:

- OpenAI or Anthropic account has ZDR enabled;
- real provider terms have been contractually accepted for sensitive customer data;
- system audio works across all browsers and OSes;
- physical microphone speech accuracy has been verified automatically.
