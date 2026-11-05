import Link from "next/link";
import { randomUUID } from "node:crypto";
import { aiAvailability, latestVerdict } from "@/lib/ai";
import { readAccount } from "@/lib/account";
import { TASTE_BUDGET } from "@/lib/ai-contract";
import { VerdictForm } from "./ai-controls";
import { personalTitle } from "@/lib/library";
import { PersonalControls, DismissControl } from "./personal-controls";
import type { MediaType } from "@/lib/catalog";

export async function PersonalPanel({ mediaType, id }: { mediaType: MediaType; id: number }) {
  let personal;
  try { personal = await personalTitle(mediaType, id); }
  catch { return <div className="notice" role="status"><p>Your personal library is temporarily unavailable. Please refresh to try again.</p></div>; }
  if (!personal) return <p className="notice"><Link className="text-link" href="/login">Sign in to save this title and add your own reaction →</Link></p>;
  return <section className="personal-panel" aria-label="Your library"><h2>Your library</h2>
    <PersonalControls mediaType={mediaType} id={id} entry={personal.entry} />
    <DismissControl mediaType={mediaType} id={id} dismissed={personal.dismissed} />
    {await aiAvailability() === "ok" && <VerdictForm mediaType={mediaType} id={id} requestKey={randomUUID()} budget={TASTE_BUDGET} saved={await savedVerdict(mediaType, id)} />}
  </section>;
}

async function savedVerdict(mediaType: MediaType, id: number) {
  const account = await readAccount().catch(() => null);
  return account ? latestVerdict(account, mediaType, id) : null;
}
