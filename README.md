# Is It Worth It? — Next.js

Phase 2 catalog MVP. Read `../REBUILD_PLAN.md` and `../PHASES.md` before continuing.

## Local start

Verified with Node 26.12.1 and npm 12.2.1. Configuration tests use native TypeScript support in Node.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Without credentials the home and account setup screens work. To enable login:

1. Create a **dedicated development** Supabase Free project. Apply `supabase/migrations/202611050001_foundation.sql` in the SQL editor (or through your linked Supabase CLI migration workflow). Do not apply to a shared production project.
2. Copy project URL and **publishable** key into `.env.local`. No service role key is needed.
3. Create Google OAuth web credentials. In Google, allow the exact Supabase Auth callback `https://YOUR_PROJECT.supabase.co/auth/v1/callback`. Put Google client ID/secret only in Supabase provider configuration.
4. Enable Google under Supabase Authentication providers. Set Site URL to `http://localhost:3000` and redirect allowlist to `http://localhost:3000/auth/callback`.
5. Set `APP_ORIGIN=http://localhost:3000`, restart Next.js, and open `/login`.

Production requires an explicit HTTPS APP_ORIGIN. Use separate Supabase projects and exact callback allowlists for local, preview, production. Never connect public previews to production accounts or secrets. Set Vercel project root to `next-app/` only in phase 7.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run build:test
npx playwright install chromium
npm run test:browser
npm audit
```

Browser suite uses a separate credential-free production build in `.next-test/` on port 3417 and a local Postman TMDB simulation on port 4519. Install Postman CLI 1.70+ before browser checks. Run `npm run build:test` after app changes; real app credentials are preserved. Database tests run the actual SQL on embedded PostgreSQL with simulated auth claims; no external user data or keys. See `docs/auth-contract.md` for required live two-account/OAuth checks.

Migrations cover profiles, library and dismissals with owner-leading unique indexes, constraints, profile creation trigger, cascades and RLS. Provider vault, results and atomic request-limit migrations belong to phase 5. Profile consent columns are not writable by browser roles; no consent flow exists yet.

Security headers are a baseline. Nonce CSP, complete privacy/deletion flows, quotas, provider behavior and release security checks remain in later phases. TMDB catalog requests are server-only; no Gemini requests exist yet.

## Catalog setup and routes

Set `TMDB_ACCESS_TOKEN` in your ignored `.env` or `.env.local` to the **API Read Access Token** from [TMDB API settings](https://www.themoviedb.org/settings/api). This is Bearer authentication, not an `api_key` query parameter. An HTTP 401 usually means the token is invalid or is the wrong credential type. Restart the dev server after changing it; production needs a server restart/redeploy. Never prefix this variable with `NEXT_PUBLIC_`.

- `/discover`: popular movies and TV, independently recoverable sections.
- `/search`: explicit GET search, separate media type and bounded pagination.
- `/title/movie/42` and `/title/tv/42`: separate catalog identities and metadata.
- `/credits`: official TMDB logo, data/image credit and non-endorsement notice.

Search sends nothing while typing. Shared non-personal fetches use bounded revalidation; search also has a per-instance 60/minute guard, with at most eight catalog fetches in flight. These are MVP protections; distributed/platform anti-abuse protection remains a launch gate. Runtime provider validation and safe errors are described in `docs/catalog-contract.md`.

### Local dependency simulation

`npm run test:browser` starts/stops both the real Next.js app and Postman's local stand-in. Fictional titles in `postman/mocks/tmdb` are test-only, never fallback content for real users. The browser suite reads sanitized stand-in request records to confirm correct HTTP paths, query encoding and Bearer auth. It covers upstream auth/429/503, invalid JSON/schema, oversized response, timeout, empty results, missing titles and partial outages.

For manual simulated browsing:

```sh
postman simulation run postman/simulations/catalog.sim.yaml --port 4519 --no-history --output ndjson
```

In another terminal, start the isolated test build with `CATALOG_TEST_BUILD=1`, `TMDB_ACCESS_TOKEN=catalog-simulation-token`, `TMDB_SIMULATION_URL=http://127.0.0.1:4519/tmdb/3` and auth variables empty. The override only permits a loopback URL and the dummy token; a real token can never be sent to this stand-in. Do not configure the simulation override on real deployments.

The approved logo in `public/tmdb-logo.svg` was downloaded unchanged from [TMDB's official attribution page](https://www.themoviedb.org/about/logos-attribution), blue_short variant. It is used for attribution, not as this app's branding.
