export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { url: parsed.href.replace(/\/$/, ""), key };
  } catch {
    return null;
  }
}

export function appOrigin() {
  const configured = process.env.APP_ORIGIN;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGIN is required in production");
  }
  const url = new URL(configured || "http://localhost:3000");
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error("APP_ORIGIN must be an application origin");
  }
  return url.origin;
}
