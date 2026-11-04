import type { BrowserContext } from "@playwright/test";

export const service = "http://127.0.0.1:4519/supabase";
export const alice = "00000000-0000-0000-0000-000000000001";
export const bob = "00000000-0000-0000-0000-000000000002";

export async function session(context: BrowserContext, owner = alice) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const access_token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 })}.fixture-signature`;
  const stored = { access_token, refresh_token: "fictional-refresh-token", token_type: "bearer", expires_in: 3600, expires_at: now + 3600,
    user: { id: owner, email: "fixture@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-11-05T00:00:00Z" } };
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${encode(stored)}`, domain: "127.0.0.1", path: "/", sameSite: "Lax" }]);
}
