import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/config";

export async function proxy(request: NextRequest) {
  const config = supabaseConfig();
  let response = NextResponse.next({ request });
  if (config) {
    const supabase = createServerClient(config.url, config.key, {
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal || AbortSignal.timeout(6000) }) },
      cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try {
      await supabase.auth.getUser();
    } catch {
      // The private page independently verifies identity and shows a recovery screen.
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/settings/:path*", "/library/:path*", "/for-you/:path*", "/ai/:path*", "/onboarding/:path*", "/title/:path*", "/login", "/auth/:path*"] };
