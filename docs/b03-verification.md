# B03 verification gate

Baseline `5587ab6`: PR #4 verified merged using GitHub, clean tree, main pulled
with fast-forward only, feature branch `feat/cases-evidence` created from main.

On 21 November 2026 the human owner approved draft GET/PATCH compositions and
the explicit unavailable rule basis. Frozen v1 exports remain unchanged. See
[integration instructions](b03-cases-evidence.md).

Verification is in progress. Focused TDD checks cover ownership, helper
submission, withdrawal/replay denial, independent findings, immutable inputs,
malformed/stale requests, bounded history, rollback and SQL guards. Actual final
counts, full production HTTP results and independent Standards/Spec reviews
will be recorded before the PR is ready.
