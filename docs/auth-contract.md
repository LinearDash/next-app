# Phase 1 authentication contract

Google OAuth is handled through the Supabase SSR SDK, using PKCE and cookies.
No custom token endpoints or browser-facing privileged credentials exist.

| Surface | Contract |
| --- | --- |
| `GET /login` | Public. Google sign-in form if configured; honest setup state otherwise. Sanitized error banner. |
| Sign-in Server Action | POST with Next.js same-origin/Origin protection. Start Google OAuth via Supabase. Callback uses configured `APP_ORIGIN`, never a forwarded host or user-supplied redirect. |
| `GET /auth/callback?code=…` | Exchange bounded code plus cookie-held PKCE verifier. 303 to fixed `/settings`, or `/login?error=callback`. Ignore `next` and all other redirect parameters. No raw provider errors. No-store and no-referrer. |
| `GET /settings` | Dynamic, private, no-store. Verify via `auth.getUser()` on server. No user redirects to login. Service failure shows retry screen; no configuration shows public setup shell without private data. Profile query uses user-scoped RLS client. |
| Sign-out Server Action | POST, local-device logout through Supabase. Success to login; failure to settings with retry message. No GET logout. |

Session refresh runs in `src/proxy.ts`; page-level user verification remains authoritative.
Next.js Server Actions supply origin/host CSRF checks; do not add wildcard allowed origins.
Only the publishable Supabase key is used. Profiles expose no keys or sensitive provider data.
Never publicly cache private routes or place a CDN cache in front of auth cookie responses.

## Threats and phase checks

- Cross-user reads/writes: RLS and explicit column grants; exercised in PostgreSQL with simulated claims.
- Redirect injection/login CSRF: fixed APP_ORIGIN callback; Supabase PKCE; missing-code redirect browser check.
- XSS: React text rendering; no unsafe HTML; baseline security headers. Nonce CSP remains a release gate.
- Session expiry/revocation: proxy refresh + server `getUser`; live expired/revoked-session evidence is pending.
- Credential leakage: no service role key, no Gemini key routes; no provider error logging.

## Live gate (two separate Google test identities required)

1. Apply migration in a dedicated development Supabase project. Enable Google provider.
2. Log in as A, verify redirect, profile and persistent session after refresh.
3. Log in as B in another browser context. Using each user's scoped API client, confirm profiles/library/dismissals cannot read, insert, update, delete or reassign the other owner's rows.
4. Expire/revoke A's session; check private page rejection and retry/re-login behavior.
5. Sign out; browser-back/refresh must not reveal cached settings.
6. Deny Google consent, reuse callback code, remove PKCE cookie and submit an external next URL; expect safe recovery.
7. Inspect network/bundles/logs for secrets; confirm cookie Secure in HTTPS, SameSite=Lax.

Local SQL and browser checks are not substitutes for this live gate.

## Sources / tooling

- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Google OAuth setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Next.js auth guidance](https://nextjs.org/docs/app/guides/authentication)

Checked at implementation on 2026-11-05. Orbit discovery returned an unrelated Supabase MCP organization-listing capability, not an auth contract, so official SDK documentation was used. Installed Postman CLI rejects `postman status`; no workspace was initialized or artifacts published. The contract and automated checks are local.
