# Phase 3 personal library contract

Private pages and Server Actions use the existing Supabase user-scoped SSR client and phase-1 RLS tables. No service role key, auth bypass, or additional migration is required. No live user data is changed by automated checks.

## Surfaces

- `/library`: authenticated, no-store, 20 entries/page as a poster shelf; selecting a poster (`?edit=<media>-<id>`) opens a side editor; media/status/reaction filters and a separate dismissed view. Empty and service-error states. Metadata resolved from trusted TMDB in batches of at most four; if TMDB is down, entries remain editable/removable using media type and catalog ID as fallback labels.
- Title detail: public catalog remains available while personal panel independently verifies identity. Signed-in users can save/edit status, reaction, controlled tags, remove an entry, dismiss or restore the title. Signed-out users get a login link.
- `/onboarding`: optional genre preferences and roughly five suggested titles to rate; no minimum rating count is enforced. Clear skip action. Completion means saved or explicitly skipped; can revisit from library/settings.
- Settings: links to library and editable taste preferences.

## Writes

Server Action POST, Next.js origin/host CSRF checks and default bounded request body. Verify `auth.getUser()` on every operation; derive owner only from verified user. Validate exact media type and positive int32 ID. Validate status, nullable ordinal reaction 1–5, and at most four unique controlled tags. Invalid/repeated scalar fields are rejected. Unknown owner fields cannot influence ownership.

Save uses upsert keyed on `(owner,media_type,tmdb_id)` and returns checked representation; retries do not create duplicates. Verify new identities against TMDB before insertion/dismissal. Existing entries can be edited/deleted during catalog outage. Removal, restoration and dismissal are separate operations; dismissing never deletes a library entry or a reaction. Dismissal affects later recommendations, not public catalog browsing. All writes use RLS and explicit owner filters; no client-supplied owner, community score, overview, or title metadata is trusted.

Preferences accept at most 30 unique genre IDs, validated against the provider's movie/TV genre lists. Skipping works without TMDB and preserves existing preferences. Consent fields cannot be changed here. Revalidate only fixed library/onboarding and validated title paths. Mutation failure displays a sanitized message and preserves form input; no success message before an acknowledged write. Multi-device conflicts use last acknowledged write wins for an entry; there is no offline queue or automatic write retry.

## Verification

Run existing PostgreSQL tests and extend them for successful CRUD, nullable/early ratings, tags and preferences. Exercise real Next.js pages/actions against local Postman Supabase Auth/PostgREST and TMDB stand-ins with two simulated identities, separate contexts, reload persistence, filters, removals, dismissals/restores, onboarding, malicious input, expired sessions and database failures. Stand-in isolation does not prove hosted Supabase RLS; two real Google accounts and cross-device checks remain a live gate.

Sources: https://supabase.com/docs/reference/javascript/upsert; https://supabase.com/docs/guides/auth/server-side/creating-a-client; local Next.js server-actions and revalidatePath docs; existing SQL migration and auth/catalog contracts. Added genre reads use https://developer.themoviedb.org/reference/genre-movie-list and https://developer.themoviedb.org/reference/genre-tv-list.

## Live acceptance checklist

1. As Google account A, save a movie and TV show, change status/reaction/tags, clear a reaction, and reload.
2. Sign in as A on another physical device and confirm the same entries/preferences. Edit on one device and reload the other.
3. As Google account B in a separate browser, verify A's entries, preferences and dismissals are inaccessible; save the same numeric catalog ID independently.
4. Remove an entry and dismiss/restore a different title; verify the other account is unaffected and dismissal did not delete ratings.
5. Skip/revisit taste setup, save genres, and confirm nullable/early ratings behave independently of community scores.
6. Log out/revoke a session; private pages and writes must require a new sign-in and must not show cached account data.

No hosted write was made by the agent. Local browser/SQL evidence must not be labeled as completion of these live checks.

## Recorded local verification

On 2026-11-05, all 6 Node/PostgreSQL tests and all 29 browser tests passed; lint, TypeScript, normal and isolated production builds passed. Production dependency audit reported zero vulnerabilities. The fully loaded 320px onboarding screenshot was visually inspected. A deliberately cross-origin action generated the expected framework rejection/500 and no private write; this is passing security-test evidence, not an unresolved application error. Two-account hosted checks above remain pending.
