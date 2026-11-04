"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appOrigin, supabaseConfig } from "@/lib/config";

export async function signIn() {
  if (!supabaseConfig()) redirect("/login?error=configuration");
  const supabase = await createClient();
  let destination: string | undefined;
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${appOrigin()}/auth/callback`, skipBrowserRedirect: true },
    });
    if (!error && data.url) {
      const url = new URL(data.url);
      if (url.origin === supabaseConfig()!.url && url.pathname === "/auth/v1/authorize") {
        destination = url.href;
      }
    }
  } catch {
    // Keep provider errors and configuration details out of responses and logs.
  }
  redirect(destination || "/login?error=unavailable");
}

export async function signOut() {
  let failed = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  redirect(failed ? "/settings?error=logout" : "/login?signedOut=1");
}
