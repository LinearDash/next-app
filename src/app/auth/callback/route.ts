import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appOrigin, supabaseConfig } from "@/lib/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  let success = false;
  if (code && code.length <= 4096 && supabaseConfig()) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      success = !error;
    } catch {
      // Missing/expired PKCE verifier and provider outages share a safe recovery path.
    }
  }
  const response = NextResponse.redirect(
    new URL(success ? "/settings" : "/login?error=callback", appOrigin()),
    303,
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
