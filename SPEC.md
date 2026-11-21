# SANAD specification

The implementation specification is published in the repository's local Markdown issue tracker:

[SANAD verification and dispute specification](./.scratch/sanad-verification/spec.md).

That document is the single specification body; this entry point avoids maintaining duplicate contracts. The six interview decisions in [the ADR directory](./docs/adr/) are accepted. On 21 November 2026, the requesting human accepted shared-contract and database-migration ownership and approved all 17 contract decisions, the currently exported schemas/types/fixtures as a bounded baseline, three binding clarifications and explicit deferrals. See the canonical specification and [approval ledger](./src/contracts/v1/README.md#approval-ledger).

The designated human backend lead and contract owner subsequently stated that the team delegates shared-contract approval to them and explicitly authorized the bounded `v1.0.0` freeze. Individual teammate signoff is no longer blocking, as recorded in the [ADR 0005 governance amendment](./docs/adr/0005-shared-contracts-and-central-mock-services.md#governance-amendment--21-november-2026). Revision is `v1.0.0`; merge requires fresh contract-test/typecheck/lint/build evidence and GitHub's normal protections. Deferred interfaces and integrations retain their own gates; the freeze does not establish runtime authorization, persistence, crypto/AI feasibility, OpenAPI, accessibility or deployment. No individual developer reviews are asserted, and B01 is not started by this authorization.
