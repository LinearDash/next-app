# Is It Worth It? — Next.js

Phase 5: catalog, personal library, non-AI recommendations, and an optional Gemini key vault plus AI features. Read `../REBUILD_PLAN.md` and `../PHASES.md` before continuing.

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

Browser suite uses a separate production build containing only fictional test credentials in `.next-test/` on port 3417 and local Postman TMDB and Supabase Auth/PostgREST stand-ins on port 4519. Install Postman CLI 1.70+ before browser checks. Run `npm run build:test` after app changes; real app credentials are preserved. Database tests run the actual SQL on embedded PostgreSQL with simulated auth claims; no external user data or keys. See `docs/auth-contract.md` for required live two-account/OAuth checks.

Migrations cover profiles, library and dismissals with owner-leading unique indexes, constraints, profile creation trigger, cascades and RLS. Provider vault, results and atomic request-limit migrations belong to phase 5. Profile consent columns are not writable by browser roles; no consent flow exists yet.

Security headers are a baseline. Nonce CSP, complete privacy/deletion flows and release security checks remain in later phases. TMDB and Gemini requests are server-only.

## Catalog setup and routes

Set `TMDB_ACCESS_TOKEN` in your ignored `.env` or `.env.local` to the **API Read Access Token** from [TMDB API settings](https://www.themoviedb.org/settings/api). This is Bearer authentication, not an `api_key` query parameter. An HTTP 401 usually means the token is invalid or is the wrong credential type. Restart the dev server after changing it; production needs a server restart/redeploy. Never prefix this variable with `NEXT_PUBLIC_`.

- `/discover`: mixed daily/weekly movie and TV trends plus separately paginated popular sections.
- `/search`: explicit GET search, separate media type and bounded pagination.
- `/title/movie/42` and `/title/tv/42`: separate catalog identities and metadata.
- `/credits`: official TMDB logo, data/image credit and non-endorsement notice.

Search sends nothing while typing. Shared non-personal fetches use bounded revalidation; search also has a per-instance 60/minute guard, with at most eight catalog fetches in flight. These are MVP protections; distributed/platform anti-abuse protection remains a launch gate. Runtime provider validation and safe errors are described in `docs/catalog-contract.md`.

## UI components

The UI refresh uses shadcn/ui with Base UI, Tailwind CSS v4 and the existing dark-cinema colors. Generated components live in `src/components/ui`; add more with `npx shadcn add <component>`. New and refreshed page controls should use these components as pages are redesigned, rather than importing a second component framework. The current setup includes Button and Skeleton. Loading skeletons are route-specific so a page's skeleton does not stack with a global fallback.

### Local dependency simulation

`npm run test:browser` starts/stops both the real Next.js app and Postman's local stand-in. Fictional titles in `postman/mocks/tmdb` are test-only, never fallback content for real users. The browser suite reads sanitized stand-in request records to confirm correct HTTP paths, query encoding and Bearer auth. It covers upstream auth/429/503, invalid JSON/schema, oversized response, timeout, empty results, missing titles and partial outages.

For manual simulated browsing:

```sh
postman simulation run postman/simulations/catalog.sim.yaml --port 4519 --no-history --output ndjson
```

In another terminal, start the isolated test build with `CATALOG_TEST_BUILD=1`, `TMDB_ACCESS_TOKEN=catalog-simulation-token`, `TMDB_SIMULATION_URL=http://127.0.0.1:4519/tmdb/3` and the fictional Supabase URL/key used by `scripts/build-browser.mjs` (baked into the isolated build). The override only permits a loopback URL and the dummy token; a real token can never be sent to this stand-in. Do not configure the simulation override on real deployments.

The approved logo in `public/tmdb-logo.svg` was downloaded unchanged from [TMDB's official attribution page](https://www.themoviedb.org/about/logos-attribution), blue_short variant. It is used for attribution, not as this app's branding.

## Personal library and taste setup

Phase 3 uses the existing phase-1 migration; no new SQL or environment variables are needed. Sign in with Google, open a title, then save a status, optional personal reaction and descriptive tags. Whole-show TV ratings, ratings before completion and watched-without-rating are supported.

- `/library`: filter saved entries by movie/TV, status and reaction; edit or remove entries, 12 per page.
- `/library?view=dismissed`: review and undo Not interested. Dismissal never deletes a saved entry/reaction; it excludes the title from future recommendations.
- `/onboarding`: optional genres and suggested titles to rate. Five ratings are a suggestion. Skip preserves existing preferences and allows returning later.
- `/settings`: links to editable taste preferences.

Library metadata is fetched from TMDB in batches of four. During an outage, fallback media/ID labels preserve the ability to edit/remove existing entries. Personal responses and Supabase SDK requests are no-store; session verification runs on every private page/action. See `docs/library-contract.md` for behavior and live checks.

The local Supabase stand-in uses fictional sessions and an owner-scoped Auth/PostgREST subset; browser tests exercise actual SSR SDK requests and Server Actions, while PostgreSQL tests separately enforce the real migration's RLS/constraints. This does not establish hosted Supabase isolation. Before accepting the live phase, use two real Google accounts to verify library/prefs/dismissal isolation, reload on another physical device, logout/expiry and no cached private data. Automated tests never write to the real project.

## Recommendations (phase 4)

`/for-you` has separate movie and TV suggestions based on a plain genre heuristic over your reactions and chosen genres. It needs no AI key. See `docs/recommendations-contract.md`.

## Gemini key vault and AI (phase 5, optional)

1. Apply `supabase/migrations/202611050002_ai.sql` to the **development** project, after the foundation migration.
2. In your ignored env file, set:
   - `GEMINI_ENABLED=1`
   - `GEMINI_ALLOWED_COUNTRIES=*` (accepted only in local development; production needs explicit country codes)
   - `GEMINI_KEY_ENCRYPTION_KEYS=v1:<32 random bytes, base64>`

   See `.env.example`, and use different values in every environment.
3. Restart. In Settings → AI & privacy, accept the notice and paste your own Gemini API key. Then use "Ask for a verdict" on a title page, or `/ai/find`. Saved results are at `/ai`.

AI is off unless every setting above is valid. Setting `GEMINI_ENABLED=0` is the kill switch. Automated tests never call Gemini: they use the dummy key against the local stand-in, and the app refuses to send any other key there. See `docs/ai-contract.md` for the vault, eligibility, limits, errors and the live checklist.

Browser checks need the Postman stand-ins for Supabase, TMDB and Gemini (`postman/simulations/catalog.sim.yaml`). If Playwright's browsers live outside the default cache, set `PLAYWRIGHT_BROWSERS_PATH`.
