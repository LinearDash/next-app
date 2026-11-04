# Phase 4 non-AI recommendations contract

Private `/for-you` page with separate movie and TV sections. No Gemini, no new tables, migration or environment variables; uses the phase-1 RLS tables through the user-scoped SSR client.

## Inputs (server-side only)

- Up to the 24 most recently updated **rated** library entries. Genre IDs come from trusted TMDB detail lookups (batches of four, existing cache). Titles whose details fail are left out, and the page says so. When the cap is reached, the page shows that only recent ratings are used.
- `profiles.genre_preferences` (explicit onboarding genres).
- No community score is used as a personal reaction or as a ranking weight.

## Heuristic (`src/lib/recommend.ts`)

- Genre weight = Σ(reaction − 3) over rated titles with that genre, + 1 if the user chose that genre. "It was okay" (3) is neutral. Reactions are ordinal labels, so the weights rank genres without implying calibrated intervals.
- Candidates per media type: TMDB `/discover` for the top three positive genres (any of them, popularity order, adult content excluded, at least 50 votes) followed by `/popular`. The two calls are independent, so either one can fail without losing the section.
- Candidate score = sum of its genre weights. Net-negative candidates are never shown, even as popular filler. Ties keep provider popularity order.
- Diversity: greedy selection; each earlier pick that shares the same lead genre costs 2.
- Up to 12 picks per section. Explanations name at most two matched genres ("Matches genres you rated highly: …" or "Matches genres you chose: …"). Otherwise: "Popular on TMDB right now". The page states these are not predictions. No percentages or probability wording.

## Exclusions and marks

Matched by `(media_type, tmdb_id)`: watched, watching, dropped and dismissed titles are excluded. Want-to-watch titles stay and are marked "On your watchlist". The exclusion lookup queries only the candidate IDs, so it is exact regardless of library size. "Not interested" reuses the phase-3 dismissal action (identity re-verified, reversible from the library), which now also revalidates `/for-you`.

## Cold start and failures

- No ratings and no chosen genres: popular titles with an honest notice and a link to onboarding. No discover request is made.
- Chosen genres but no ratings: genre-based picks with a notice inviting ratings.
- Catalog outage: each section degrades independently to the catalog notice. A personal data failure shows the private error page. Signed-out visitors are redirected to login. The page is `private, no-store` via the proxy.

## Verification

- `tests/recommend.test.mjs` covers cold start, liked/disliked/neutral reactions, mixed tastes, preference-only taste, exclusion by media type + ID, the watchlist mark, de-duplication, diversity and the absence of probability wording.
- `tests/browser/recommendations.spec.ts` runs the actual app against the local Postman TMDB/Supabase stand-ins. It covers cold start, reaction-driven picks with exclusions, the watchlist mark, dismiss → disappear → restore, a second simulated user unaffected, preference-only picks, partial and full outages, the signed-out redirect, 320/768/1440px layout and no-store headers.
- Stand-in evidence is not hosted Supabase or live TMDB evidence.

## Live acceptance checklist

1. With a fresh account, `/for-you` shows popular titles with the cold-start notice.
2. Choose genres only, then confirm genre-based explanations.
3. Rate several titles (love some genres, hate one), then confirm hated-genre titles disappear and explanations name the loved genres.
4. Mark a title watched or dismissed and confirm it leaves both sections. Restore it from the library and confirm it can return. Want-to-watch titles show the badge.
5. A second account's suggestions are unaffected by the first account's ratings and dismissals.

Sources: https://developer.themoviedb.org/reference/discover-movie; https://developer.themoviedb.org/reference/discover-tv (`with_genres` uses `|` for OR, plus `sort_by`, `include_adult` and `vote_count.gte`).
