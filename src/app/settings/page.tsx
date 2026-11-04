import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/config";
import { signOut } from "@/app/auth/actions";
import { aiAvailability, aiStatus } from "@/lib/ai";
import { aiErrors } from "@/lib/ai-contract";
import { ConsentForm, KeyForm } from "@/components/ai-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account", robots: { index: false, follow: false } };

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!supabaseConfig()) return <section className="account-panel"><p className="eyebrow">YOUR ACCOUNT</p><h1>A home for<br /><em>your taste.</em></h1><div className="notice"><h2>Account access is being set up.</h2><p>Private settings will be available when Google sign-in is connected.</p></div><Link className="button secondary" href="/">Back to home</Link></section>;
  const supabase = await createClient();
  let result;
  try { result = await supabase.auth.getUser(); } catch { throw new Error("Account service unavailable"); }
  if (result.error && result.error.status && result.error.status >= 500) throw new Error("Account service unavailable");
  if (!result.data.user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles").select("onboarding_completed").eq("owner", result.data.user.id).single();
  const params = await searchParams;
  return <section className="settings"><p className="eyebrow">YOUR OWN LITTLE CORNER</p><h1>Your <em>account.</em></h1><p className="intro">A private home for the stories that stay with you.</p>
    {params.error === "logout" && <p className="notice" role="alert">We couldn’t finish signing you out. Please try again.</p>}
    <div className="settings-row"><div><h2>Signed in with Google</h2><p className="muted">{result.data.user.email}</p></div><form action={signOut}><button className="button secondary">Sign out</button></form></div>
    {error && <p className="notice" role="alert">Your profile could not be loaded. Try refreshing in a moment.</p>}
    <div className="settings-row"><div><h2>Your preferences</h2><p className="muted">{profile?.onboarding_completed ? "Your onboarding is complete." : "Optional taste onboarding is ready whenever you are."}</p></div><Link className="button secondary" href="/onboarding">Edit taste preferences</Link></div>
    <AiSettings client={supabase} user={result.data.user} />
  </section>;
}

async function AiSettings(account: Parameters<typeof aiStatus>[0]) {
  const [available, status] = await Promise.all([aiAvailability(), aiStatus(account).catch(() => null)]);
  return <section className="settings-ai" id="ai" aria-labelledby="ai-heading"><h2 id="ai-heading">AI & privacy</h2>
    {available !== "ok" && <p className="muted">{aiErrors[available]}</p>}
    {!status ? <p className="notice" role="alert">Your AI settings could not be loaded. Try refreshing in a moment.</p> : <>
      {/* Withdrawing consent and deleting a key always stay possible, even while AI is unavailable. */}
      <ConsentForm consented={status.consented} allowAccept={available === "ok"} />
      <KeyForm keyHint={status.keyHint} allowSave={available === "ok"} />
      <p className="muted small"><Link className="text-link" href="/ai">Your saved AI results →</Link></p></>}
  </section>;
}
