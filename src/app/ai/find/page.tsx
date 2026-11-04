import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireAccount } from "@/lib/account";
import { aiAvailability, aiStatus } from "@/lib/ai";
import { aiErrors, TASTE_BUDGET } from "@/lib/ai-contract";
import { genres } from "@/lib/tmdb";
import { FinderForm } from "@/components/ai-controls";

export const metadata = { title: "Find me a movie", robots: { index: false, follow: false } };

export default async function Find() {
  const account = await requireAccount();
  const [available, status, genreList] = await Promise.all([aiAvailability(), aiStatus(account), genres().catch(() => [])]);
  const blocked = available !== "ok" ? aiErrors[available] : !status.consented ? aiErrors.consent_required : !status.keyHint ? aiErrors.missing_key : null;
  return <section className="catalog-page"><p className="eyebrow">ASK GEMINI, ON YOUR TERMS</p><h1>Find me <em>a movie.</em></h1>
    <p className="intro">Gemini picks up to three titles from real catalog results that match your filters, using your ratings. Titles you’ve watched, are watching, dropped or dismissed are left out.</p>
    {blocked ? <div className="notice" role="status"><p>{blocked}</p>{available === "ok" && <Link className="text-link" href="/settings#ai">Open AI settings →</Link>}</div>
      : <>{!genreList.length && <p className="notice" role="status">Genre filters are temporarily unavailable.</p>}
        <FinderForm genres={genreList} requestKey={randomUUID()} budget={TASTE_BUDGET} /></>}
    <p><Link className="text-link" href="/for-you">Prefer suggestions without AI? See For you →</Link></p>
  </section>;
}
