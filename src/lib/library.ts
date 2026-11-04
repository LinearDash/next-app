import "server-only";
import { z } from "zod";
import { readAccount } from "./account";
import { entrySchema, dismissalSchema } from "./library-input";
import { detail } from "./tmdb";
import type { MediaType } from "./catalog";

export const entryColumns = "tmdb_id,media_type,status,reaction,tags";

export async function personalTitle(mediaType: MediaType, id: number) {
  const account = await readAccount();
  if (!account) return null;
  const { client, user } = account;
  const [entry, dismissal] = await Promise.all([
    client.from("library_entries").select(entryColumns).eq("owner", user.id).eq("media_type", mediaType).eq("tmdb_id", id).maybeSingle(),
    client.from("dismissals").select("tmdb_id,media_type").eq("owner", user.id).eq("media_type", mediaType).eq("tmdb_id", id).maybeSingle(),
  ]);
  if (entry.error || dismissal.error) throw new Error("Library unavailable");
  return { entry: entry.data ? entrySchema.parse(entry.data) : null, dismissed: Boolean(dismissal.data) };
}

export async function catalogLabels<T extends z.infer<typeof dismissalSchema>>(rows: T[]) {
  const resolved = [];
  for (let offset = 0; offset < rows.length; offset += 4) {
    resolved.push(...await Promise.all(rows.slice(offset, offset + 4).map(async row => {
      try { return { ...row, title: await detail(row.media_type, String(row.tmdb_id)) }; }
      catch { return { ...row, title: null }; }
    })));
  }
  return resolved;
}
