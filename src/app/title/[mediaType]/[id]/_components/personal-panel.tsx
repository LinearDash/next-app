import { randomUUID } from "node:crypto";
import Link from "next/link";

import { VerdictForm } from "@/components/ai-controls";
import { PersonalControls, DismissControl } from "@/components/personal-controls";
import { aiAvailability, latestVerdict } from "@/lib/ai";
import { TASTE_BUDGET } from "@/lib/ai-contract";
import type { MediaType } from "@/lib/catalog";
import { readAccount } from "@/lib/account";
import { personalTitle } from "@/lib/library";

export async function PersonalPanel({ mediaType, id }: { mediaType: MediaType; id: number }) {
  let personal;
  try {
    personal = await personalTitle(mediaType, id);
  } catch {
    return (
      <aside className="title-personal-panel" aria-label="Your library">
        <h2>Your library</h2>
        <p className="notice" role="status">
          Your personal library is temporarily unavailable. Please refresh to try again.
        </p>
      </aside>
    );
  }
  if (!personal)
    return (
      <aside className="title-personal-panel" aria-label="Your library">
        <h2>Your library</h2>
        <p className="notice">
          <Link className="text-link" href="/login">
            Sign in to save this title and add your own reaction →
          </Link>
        </p>
      </aside>
    );
  return (
    <aside className="personal-panel title-personal-panel" aria-label="Your library">
      <h2>Your library</h2>
      <PersonalControls mediaType={mediaType} id={id} entry={personal.entry} compact />
      <DismissControl mediaType={mediaType} id={id} dismissed={personal.dismissed} />
      {(await aiAvailability()) === "ok" && (
        <VerdictForm
          mediaType={mediaType}
          id={id}
          requestKey={randomUUID()}
          budget={TASTE_BUDGET}
          saved={await savedVerdict(mediaType, id)}
        />
      )}
    </aside>
  );
}

async function savedVerdict(mediaType: MediaType, id: number) {
  const account = await readAccount().catch(() => null);
  return account ? latestVerdict(account, mediaType, id) : null;
}
