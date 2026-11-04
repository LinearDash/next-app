import Link from "next/link";
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
  </section>;
}
