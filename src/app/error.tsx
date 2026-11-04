"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="account-panel"><p className="eyebrow">A BRIEF INTERMISSION</p><h1>Let’s try<br /><em>that again.</em></h1><p>The service is temporarily unavailable. Your account data hasn’t been changed.</p><div className="actions"><button className="button primary" onClick={reset}>Try again</button><Link className="text-link" href="/">Back to home</Link></div></section>;
}
