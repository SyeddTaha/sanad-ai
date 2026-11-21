SANAD uses Next.js, Supabase Auth and PostgreSQL. For B01 setup, migrations,
synthetic accounts and frontend/backend authentication integration, see
[the backend foundation guide](docs/backend-foundation.md) and
[verification evidence](docs/b01-verification.md). The minimal sign-in page is `/login`.

B02 centralized authorization, consent endpoint schemas, purpose disclosures and
teammate integration examples are in [the RBAC and consent handoff](docs/b02-rbac-consent.md).

B03 Case submission, immutable evidence/Assessment persistence, Passport endpoints
and setup are in [the Case and Evidence Passport handoff](docs/b03-cases-evidence.md)
and [verification evidence](docs/b03-verification.md).

B04 officer queues, dispatch, immutable published rules and transactional Case
Resolution APIs are documented in [the staff integration guide](docs/b04-officer-rules.md)
and [verification evidence](docs/b04-verification.md). Frozen v1 exports are unchanged.

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

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
