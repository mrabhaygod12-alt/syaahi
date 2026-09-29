# Real-time voice interview setup

Syaahi's server endpoint `POST /api/interview/live-token` issues a **single-use, short-lived Gemini Live token** only after an authenticated, rate-limited request. It never returns `GEMINI_LIVE_API_KEY` or `GEMINI_API_KEY` to the browser.

## Required Render API environment

```text
GEMINI_LIVE_API_KEY=your Gemini API key with Live API access
GEMINI_LIVE_MODEL=models/gemini-3.8-live
```

`GEMINI_API_KEY` can be used as a fallback during development, but a dedicated `GEMINI_LIVE_API_KEY` is preferable in production so it can have its own quota and rotation schedule.

## Client connection rules

1. Request `/api/interview/live-token` after the learner presses **Start voice interview**.
2. Connect directly to Gemini's constrained `v1beta` Live WebSocket with the ephemeral token. Do not send the long-lived API key to the browser.
3. Send microphone audio as raw 16-bit PCM, mono, 16 kHz. Gemini returns native audio as raw PCM at 24 kHz.
4. Store only an explicit transcript and evaluation the learner chooses to save. Show a microphone/privacy notice before recording.
5. Close the connection when the learner leaves, mutes, or the session expires. Re-request a token for every new session.

## Product guardrails

- Voice feedback is private practice, not a hiring decision or a human interview.
- Keep typed practice as an accessible fallback until production voice telemetry confirms stable microphone, token, interruption, and audio-playback behavior.
- Do not request identity documents, private employer questions, protected characteristics, or confidential information.
- Add retention, deletion, abuse-reporting, quota and consent controls before enabling recorded audio storage.
