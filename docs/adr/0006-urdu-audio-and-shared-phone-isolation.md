---
status: accepted
---

# Urdu audio guidance and shared-phone isolation

Approved in interview question 6 on 21 November 2026. Citizens may be unable to read and may use a shared phone on an unreliable connection, while persistent private caches could expose another family's evidence after switching or withdrawal. SANAD prioritizes working Urdu Audio Guidance and safe Shared-Phone Sessions, with limited in-memory drafts and connected server persistence rather than advanced speech recognition or complex offline synchronization.

- Provide spoken Urdu instructions, large touch targets, labeled icons, and optional English. The primary Citizen journey covers notice intake by QR scanning or assisted pasting, independent evidence findings, dispute submission, status tracking, and sharing controls without requiring reading.
- Use prerecorded audio for fixed instructions. Generate case-specific narration only from validated, server-authoritative findings; AI must not invent payment or eligibility claims. If dynamic Urdu TTS is unavailable, use tested prerecorded phrases and structured narration. Never claim untested speech functionality works or count prerecorded instructions as an AI voice feature; required AI capabilities must be demonstrated independently.
- Explain each consent recipient, purpose, permitted actions, and expiry through audio and visual information. Sharing choices start unselected and require separate Citizen-authenticated confirmation; a helper cannot grant itself access.
- Preserve unsent input in memory and save authorized progress server-side when connected. Distinguish `UNSENT`, `SAVING`, `SAVED`, and `FAILED` through visual and audio feedback. `SAVED` requires server confirmation; never imply an unsent draft is safely persisted. Draft progress is separate from case status.
- In-memory drafts may disappear when a tab closes or reloads. This limited-resilience behavior is acceptable for the initial prototype and must not be described as true offline-first functionality.
- On Citizen switching, clear private views, draft state, audio playback, and pending requests; ignore late responses from previous sessions. Never persist private evidence or case-specific audio in browser storage or service-worker caches; only public assets may be persisted locally.
- Every resumed operation and retry rechecks authentication, role permissions, applicable consent, and case ownership. Use idempotency keys to prevent duplicate Cases after interrupted submissions.
- Disable caching of sensitive API responses and minimize sensitive information in client memory and logs.

## Required acceptance tests

These are requirements for later implementation and execution, not completed tests.

- A Citizen completes the primary workflow using Urdu audio without reading.
- Audio accurately distinguishes authentic notices, payment status, and eligibility.
- Missing or failed audio has an accessible fallback.
- A helper's interaction alone cannot grant consent.
- An interrupted submission can be retried without creating duplicates.
- The interface accurately distinguishes unsent and server-saved progress.
- Switching families prevents previous evidence, audio, and late API responses from appearing.
- Revoked consent blocks subsequent server requests.
- The primary journey works under simulated slow or interrupted connectivity within the documented limitations.
