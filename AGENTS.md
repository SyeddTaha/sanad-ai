# SANAD Engineering Instructions

## Project
SANAD is a prototype for Coder's Cup 2026.
Deadline: 22 November 2026, 6 PM PKT.

## Source of truth
1. docs/brief/AI_Hackathon_Problem_Statement.md
2. SPEC.md and agreed API contracts
3. TASKS.md
4. docs/brief/SANAD_Hackathon_Master_Handoff.md

The official brief takes priority on conflicts.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Engineering rules
- Use Next.js, TypeScript and PostgreSQL/Supabase.
- One application. Avoid unnecessary microservices.
- Use synthetic identity and payment data only.
- Never expose API keys or private signing keys.
- Enforce RBAC and consent on the server.
- Cryptographic verification is deterministic.
- AI cannot approve payments or override verified facts.
- Uncertain cases require human review.
- Validate AI responses and external inputs.
- Add tests for critical behavior.
- Never claim a test passed unless it ran.
- Do not silently replace real AI with canned results.
- Do not modify shared contracts without approval.
- Work only on the assigned task and branch.
- Do not push directly to main.
- Explain changed files, tests and blockers.
- Maintain a usable, deployed vertical slice.

## Definition of done
Code passes relevant tests and typecheck.
The assigned behavior works end to end.
No known P0/P1 defect remains in that behavior.
Changes are committed on the feature branch.
The PR includes test evidence and limitations.

## Agent skills

### Issue tracker

Issues are tracked as local Markdown files. See `docs/agents/issue-tracker.md`.

### Domain docs

Documentation uses the single-context layout: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
