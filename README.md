SANAD uses Next.js, Supabase Auth and PostgreSQL. For B01 setup, migrations,
synthetic accounts and frontend/backend authentication integration, see
[the backend foundation guide](docs/backend-foundation.md) and
[verification evidence](docs/b01-verification.md). The minimal sign-in page is `/login`.

Final release readiness and current blockers are recorded in
[the integration and release audit](docs/final-release-audit.md). The public URL
is <https://sanad-ai-nine.vercel.app/>; Citizen screens remain disconnected,
staff defaults to labeled fixtures, and hosted SQL-backed workflows currently
fail verification. This is a synthetic prototype, not an official service.

B02 centralized authorization, consent endpoint schemas, purpose disclosures and
teammate integration examples are in [the RBAC and consent handoff](docs/b02-rbac-consent.md).

B03 Case submission, immutable evidence/Assessment persistence, Passport endpoints
and setup are in [the Case and Evidence Passport handoff](docs/b03-cases-evidence.md)
and [verification evidence](docs/b03-verification.md).

B04 officer queues, dispatch, immutable published rules and transactional Case
Resolution APIs are documented in [the staff integration guide](docs/b04-officer-rules.md)
and [verification evidence](docs/b04-verification.md). Frozen v1 exports are unchanged.

B05 scoped service API keys, supported REST operations and the real curl demo
are in [the public API handoff](docs/b05-public-api.md) and
[verification evidence](docs/b05-verification.md). Machine-readable documentation
is available at `GET /api/v1/openapi`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Production deploys from integrated `main`. CI, the Webpack build, environment
names, and the smoke routes are in [the deployment guide](docs/deployment.md).
Do not commit secret values. Copy names from `.env.example` into the host.
