---
status: accepted
---

# Shared contracts and central mock services

Approved in interview question 5 on 21 November 2026. Four developers using different coding agents could otherwise create incompatible frontend fixtures, backend responses, and AI outputs. SANAD therefore adopts one versioned contract boundary and centrally owned synthetic mocks, with an initial freeze limited to interfaces needed for parallel development rather than designing every future endpoint.

## Contract authority and source

- The designated human backend lead owns shared schemas and database migrations. Shared-contract approval is delegated to that owner under the governance amendment below; individual affected-developer signoff is no longer a blocking requirement. Changes still require explicit owner approval and coordinated contract/fixture/test updates.
- Use shared Zod schemas for runtime validation and inferred TypeScript types. These define requests, responses, findings, case states, errors, and AI outputs; generate public OpenAPI documentation from the same definitions where practical, and avoid manually maintained conflicting schemas.
- Start with `/api/v1`. Freeze exact field names, enums, error structures, and representative examples for the interfaces needed by parallel work. A frozen contract can change through an explicit, coordinated and reviewed contract update with corresponding test updates.
- Validate representative requests, responses, error cases, authorization boundaries, and mock-service behavior before integrating dependent features.

## Governance amendment — 21 November 2026

The designated human backend lead and contract owner explicitly stated that the
team delegates shared-contract approval to them and authorized the bounded
`v1.0.0` freeze. This supersedes this ADR's earlier owner-plus-affected-developer
approval requirement; individual teammate signoff no longer blocks shared-contract
approval. It records the owner's delegation statement, not individual developer
reviews or approvals. GitHub branch protections remain in force and may not be
bypassed. Approval covers the currently exported schemas, types and synthetic
fixtures only; all documented runtime and integration gates remain deferred.

## Mock boundaries and safe failure

- Keep identity, payment, and program-data services inside the single Next.js monolith, with separate shared service interfaces, centrally maintained synthetic fixtures, and protected REST API boundaries. Application code uses the shared service boundary; do not introduce separate microservices, an API gateway, or a complex contract registry.
- Lookup outcomes are `FOUND`, `NOT_FOUND`, `AMBIGUOUS`, and `UNAVAILABLE`. Payment settlement status remains a separate finding. Never automatically merge recipients based on name similarity.
- Missing records, contradictions, service outages, and invalid AI outputs remain explicit. Malformed AI output, provider timeout, or unavailable AI invokes a deterministic/manual fallback, with AI unavailability recorded. Never fabricate evidence, confidence, or successful AI results, and never allow AI failure to alter authoritative findings.

## Idempotency and API security

- Mutating requests use idempotency keys scoped to the authenticated principal and operation and bound to the original request payload. Identical retries do not duplicate actions and return the original result; reuse of the same key for a different payload returns a conflict.
- Recheck current authorization and consent before returning any stored response. An idempotency cache must not expose previously authorized evidence after consent withdrawal.
- Public API keys are hashed, scoped, expiring, and revocable. They identify service principals requiring explicit authorization and never bypass role, assignment, or consent checks or grant unrestricted case access.

## Required integration tests

These are acceptance requirements for later implementation, not executed tests or claims of completed behavior.

- Frontend and backend validate against identical schemas.
- Invalid request payloads receive consistent errors.
- Ambiguous identity matches never resolve automatically.
- Mock-service outages return explicit unavailable states.
- Malformed AI responses cannot alter authoritative findings.
- Repeated submissions create only one Case.
- Reusing an idempotency key with changed content returns a conflict.
- Revoked consent blocks access to cached responses.
- Invalid, expired, or insufficiently scoped API keys are rejected.
- OpenAPI documentation matches implemented endpoints.
