import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { supabaseConfig } from "@/lib/config";

export const metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const configured = Boolean(supabaseConfig());
  return <section className="account-panel"><p className="eyebrow">YOUR SEAT IS WAITING</p><h1>Welcome to<br /><em>your kind of cinema.</em></h1><p>Sign in to keep your account private and take your taste with you.</p>
    {params.signedOut === "1" && <p className="notice" role="status">You’re signed out on this device.</p>}
    {params.error && <p className="notice" role="alert">Sign-in could not be completed. Please try again. If it continues, check back shortly.</p>}
    {configured ? <form action={signIn}><button className="button primary" type="submit">Continue with Google <span aria-hidden="true">↗</span></button></form> : <div className="notice"><h2>Account access is being set up.</h2><p>Google sign-in will be available once the service is connected. You can still explore the home page.</p></div>}
    <p className="small muted">Your account is private. AI is optional and requires separate consent before use.</p><Link className="text-link" href="/">← Back to home</Link>
  </section>;
}
