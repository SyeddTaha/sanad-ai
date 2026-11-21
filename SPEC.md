# SANAD specification

The implementation specification is published in the repository's local Markdown issue tracker:

[SANAD verification and dispute specification](./.scratch/sanad-verification/spec.md).

That document is the single specification body; this entry point avoids maintaining duplicate contracts. The six interview decisions in [the ADR directory](./docs/adr/) are accepted. On 21 November 2026, the requesting human accepted shared-contract and database-migration ownership and approved all 17 contract decisions, the currently exported schemas/types/fixtures as a bounded baseline, three binding clarifications and explicit deferrals. See the canonical specification and [approval ledger](./src/contracts/v1/README.md#approval-ledger).

Revision remains `candidate-v1.0.0`, pending explicit affected-developer signoff before promotion to `v1.0.0` and fresh contract-test/typecheck/lint/build evidence. Deferred interfaces and integrations retain their own gates; this approval does not establish runtime authorization, persistence, crypto/AI feasibility, OpenAPI, accessibility or deployment. No teammate approval is implied.
