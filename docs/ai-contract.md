# Phase 5 key vault and Gemini contract

Migration `supabase/migrations/202611050002_ai.sql`. There is no service-role key. Owners reach their own rows through RLS, and request limits and consent go through narrow `security definer` functions that derive the owner from `auth.uid()`.

## Eligibility and kill switch (fail closed)

Gemini runs only if all of these hold:
- `GEMINI_ENABLED=1`
- `GEMINI_KEY_ENCRYPTION_KEYS` is valid
- the platform country (`x-vercel-ip-country`) is listed in `GEMINI_ALLOWED_COUNTRIES`

Details:
- The country header is trusted only on Vercel (`VERCEL=1`), or in tests via `GEMINI_TRUST_COUNTRY_HEADER=1`. Never set that flag on a host where clients can supply the header.
- `*` is accepted only outside production.
- Ineligible users see no AI controls. They can still delete their key and withdraw consent, and the non-AI app is unaffected.
- Consent records an 18+ attestation and a data-sharing acknowledgement under `CONSENT_VERSION`. A checkbox is **not** proof of age, of region, or of the user's key plan.
- Allowed countries and age/eligibility evidence are open release decisions. The current Gemini terms restrict clients likely to be used by under-18s and require Paid Services in the EEA, Switzerland and the UK.

## Key vault

- `provider_credentials` holds one row per owner (provider fixed to `gemini`): base64 ciphertext, a 12-byte nonce, a 16-byte tag, the key version and a 4-character hint.
- Encryption is AES-256-GCM with a fresh random nonce. The additional authenticated data (AAD) is `iiwi:gemini:<owner>:<version>`, so tampering, rows copied to another owner, and unknown versions all fail to decrypt.
- Encryption keys live only in server environment secrets. `GEMINI_KEY_ENCRYPTION_KEYS="v2:<b64>,v1:<b64>"`: the first key encrypts and all keys decrypt.
- Rotation: add a new first entry, keep the old ones until users re-save, then remove them.
- Losing a key: users see "missing key" and must replace their saved key.
- The key input is a password field and is cleared after submit. The UI shows only `••••` plus the last four characters. No API returns plaintext.
- The owner can read their own ciphertext through RLS. Without the server key it is useless.

## Request flow

1. Validate input with Zod and reject repeated fields.
2. Check eligibility.
3. Verify the session with `auth.getUser()`.
4. Check consent against the current version, and check that a key is saved.
5. Run a cheap count of rated titles. If there are more than 60, return `oversized` without using quota. The UI then asks for explicit consent to send the 60 most recently updated ratings.
6. Call `begin_ai_request`, which atomically checks the per-user lock, idempotency key (IW001), in-flight request (IW002) and the 20-per-day limit (IW003). If the limiter is unavailable, the request is refused.
7. Fetch trusted TMDB metadata: the subject title, or finder candidates. Then remove library and dismissal exclusions on the server.
8. If the finder pool is empty, return `no_matches` without calling Gemini.
9. Decrypt the key, then make one stateless `generateContent` call to `gemini-3.5-flash-lite`:
   - fixed host and model
   - `responseMimeType` set to JSON, plus `responseSchema`
   - `maxOutputTokens` 4096
   - 25 s timeout, 256 KiB response cap
   - no redirects, retries, tools or stored interactions
10. Check `finishReason=STOP`, then strict Zod validation. For the finder, chosen IDs must be distinct members of the offered candidates.
11. Re-check consent and key. If either was withdrawn during the call, discard the answer.
12. Save a private `ai_results` row with the model, prompt version, schema version, taste fingerprint and display snapshot.
13. Call `finish_ai_request` on every exit.

## What Gemini receives

- For each rated title: its name, movie/TV and year, plus the reaction (1–5) with its label.
- The genre names the user chose.
- Trusted metadata for the subject or candidates. Overviews are truncated.
- Filters and mood.

It never receives the user's name, email, account or owner ID. The versioned system prompt treats all input as untrusted data. It requires spoiler-free answers and opinions rather than probabilities, and it requires the finder to choose only offered IDs. Spoiler avoidance is by instruction only and is not guaranteed.

## Errors

The user-facing messages are in `aiErrors` (`src/lib/ai-contract.ts`). They cover:
- authentication, ineligible region, kill switch
- consent required, missing key, invalid input
- duplicate submission, busy, daily quota
- provider rejected the key (401/403, or 400 with `API_KEY_INVALID`), provider rate limit (429)
- provider unavailable or timed out, invalid response (malformed, incomplete, schema or semantic failure)
- no matches, oversized history, catalog unavailable

Provider error bodies are never shown or logged. Failed requests save nothing. Each failure returns a fresh idempotency key, so a deliberate retry isn't reported as a duplicate. Regenerating, or "Show different picks", is always a new, explicit request.

## In-flight requests

A request that has already passed its checks can still reach Gemini after the user deletes the key or withdraws consent, because the provider call is already underway. Its answer is then discarded instead of saved, and every later request is refused. Turning `GEMINI_ENABLED` off stops new requests immediately.

## Results

- `/ai` lists the 50 most recent results. Each can be deleted individually, or all at once.
- `/ai/<id>` reopens a stored result without calling Gemini. Stored JSON is re-validated before it is displayed.
- The verdict page offers explicit regeneration. The finder page offers "Show different picks", which excludes up to 30 earlier picks.
- Results show the date, model and prompt version, and are labeled as opinion.

## Verification

- **Unit tests** (`tests/ai.test.mjs`): vault round trip, nonce freshness, tampering of each field, wrong owner, unknown and truncated tag, rotation, bad configuration, the eligibility matrix, input bounds, strict outputs, and semantic finder checks.
- **Database test** (`tests/ai-database.test.mjs`): the real SQL on embedded PostgreSQL. Covers RLS isolation, constraints, no direct `ai_requests` access, the consent function versus the forbidden column write, busy/duplicate/quota, anonymous denial, and cascade deletion.
- **Browser tests** (`tests/browser/ai.spec.ts`): the real Next.js app against Postman stand-ins for Supabase, TMDB and Gemini. Covers:
  - consent and the key lifecycle, with ciphertext and no plaintext at rest
  - the data-minimized prompt
  - safe rendering of injected model text
  - reopening without a new call, and deletion
  - provider failures: invalid key, 429, 503, timeout, malformed output, MAX_TOKENS, schema break — each followed by a successful retry
  - finder exclusions, invented IDs, empty picks, no candidates without a call, and "Show different picks"
  - concurrent busy, daily quota, oversized history with subset consent, consent withdrawal, ineligible region
  - 320/1440px layout and no-store headers
- **Not covered:** none of this is live Gemini, live hosted RLS or legal-eligibility evidence.

## Live acceptance checklist (not yet run)

1. Apply migration 2 to the dev Supabase project. Set `GEMINI_ENABLED=1`, `GEMINI_ALLOWED_COUNTRIES=*` (local dev only), and fresh `GEMINI_KEY_ENCRYPTION_KEYS` in the ignored env file.
2. Consent and save a real key. In the Supabase table, confirm only ciphertext and the hint are stored.
3. Ask for a verdict and run the finder with your own key. Confirm the answers are spoiler-free, show no probabilities, and are saved and reopen without a new call.
4. Use an invalid key and confirm the sanitized "rejected" message.
5. With two accounts, confirm keys, results and consent stay isolated.
6. Delete the key or withdraw consent, then confirm later requests are refused.
7. Before launch, recheck the Gemini terms and model availability, and decide the allowed countries and age assurance.
