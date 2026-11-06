# Phase 2 catalog contract

Public server-rendered catalog pages; no browser TMDB credentials, provider URL or arbitrary proxy endpoint. Movie/TV identity is always `(mediaType, tmdbId)`.

| Surface | Input and behavior |
| --- | --- |
| `/discover` | A mixed daily/weekly trending feed plus independently recoverable popular movie and TV lists. `trend` selects day/week (defaults to day). Popular lists are page-based; `movies` and `tv` query params accept pages 1–20 and invalid/repeated values fall back to page 1. |
| `/search` | GET form, explicit submission (no per-keystroke requests), `q` trimmed 2–100 chars, `type` movie or tv, integer `page` 1–20. Reject repeated/invalid parameters before provider call. Empty query shows instructions. |
| `/title/[mediaType]/[id]` | Type movie/tv, canonical positive int32 ID. Invalid identity or upstream 404 shows 404. Fetch trusted title metadata server-side. |
| `/credits` | TMDB attribution, approved logo and link, required non-endorsement notice. |

## Provider calls

`GET https://api.themoviedb.org/3/trending/all/{day|week}`, `/movie/popular`, `/tv/popular`, `/search/movie`, `/search/tv`, `/movie/{id}`, `/tv/{id}`.

Bearer token is `TMDB_ACCESS_TOKEN` server-only. Fixed `language=en-US`; search also sends `include_adult=false`, encoded query and bounded page. Drop any explicit adult results. Responses are runtime-validated with Zod; no raw provider JSON is rendered or logged. Check detail ID matches request. Bound body to 1 MiB and upstream deadline to 6 seconds, including response body. Do not follow provider redirects. No automatic retries.

Shared non-personal fetch cache: daily trending and popular 1 hour, weekly trending 6 hours, details 6 hours, search 1 minute. Trending carries movie/TV identity badges and drops people. Popular page controls retain the other section's current page and the selected trending window. Search page itself is noindex and query strings are not logged by application code. Avoid typing sensitive information into public catalog search; hosting access logs may include URLs.

Per-instance search guard: 60 submissions/minute; max 8 simultaneous catalog fetches. This is a best-effort MVP guard, not a distributed anti-abuse quota. Platform/distributed protections remain a release gate.

## Error behavior

Missing/invalid server credential -> catalog unavailable notice, without secret details. Provider 401/403/429/5xx, transport errors, oversized/malformed/schema-invalid responses -> sanitized recovery screen with retry link. 404 details -> missing title. Empty results -> explicit empty state and editable search. Preserve healthy discovery section if its sibling fails.

Metadata includes title, media label, release/first-air date, overview, genres, original language, movie runtime or TV season count, and TMDB community score/vote count. Community score is explicitly not the user's reaction. No personal rating/status/AI controls until their phases.

Poster URLs use only validated TMDB file paths under `https://image.tmdb.org/t/p/w342/`; lazy images have fixed aspect ratio and a visible fallback on missing or failed images.

## Verification plan

Use local Postman simulation with fictional fixtures matching the documented TMDB shapes; no real keys. Exercise real Next.js pages over HTTP against it for movie/TV ID collision, search encoding and pagination, empty/invalid input, 404, provider auth/429/5xx, malformed data, body-size limit and timeout. Confirm browser output and bundles contain no test token. Check 320/768/1440px overflow, keyboard form controls and image-error fallback. Record real API smoke evidence separately if a credential is supplied.

## Sources (checked 2026-11-05)

- https://developer.themoviedb.org/reference/movie-popular-list
- https://developer.themoviedb.org/reference/tv-series-popular-list
- https://developer.themoviedb.org/reference/trending-all
- https://developer.themoviedb.org/reference/search-movie
- https://developer.themoviedb.org/reference/search-tv
- https://developer.themoviedb.org/reference/movie-details
- https://developer.themoviedb.org/reference/tv-series-details
- https://developer.themoviedb.org/docs/image-basics
- https://developer.themoviedb.org/docs/faq

Orbit located TV search/discover contracts; official references supply popular/movie/detail contracts. `postman status` is unsupported in the installed CLI; authenticated owner-mock discovery was skipped. Local stand-in is authored from provider documentation; not a provider-owned mock or live service evidence.

## Recorded result

Final phase 2 run: 4 Node/PostgreSQL tests, 19 production-browser checks, lint, typecheck, normal and isolated builds passed. Browser checks include deliberately delayed hydration for early image-error recovery and retry after a partial outage is removed. Separate live TMDB smoke returned HTTP 401; success against the real service remains pending a valid Read Access Token. See `../../PHASES.md` for the workspace handoff.

Discover feed update (2026-11-07): added `/trending/all/day|week`, with movie/TV identity retained and people ignored, and bounded page navigation for movie/TV popular lists. Lint, typecheck and production build passed. Browser simulation and the new live trending endpoint were not exercised in this update.
