"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readAccount } from "@/lib/account";
import { entryInputSchema, changesSchema, entrySchema, preferencesSchema, scalar } from "@/lib/library-input";
import { detail, genres } from "@/lib/tmdb";
import type { ActionState } from "@/lib/taste";

const invalid: ActionState = { ok: false, message: "Please check the title, status, reaction, and tags, then try again." };

export async function changeEntry(_previous: ActionState, form: FormData): Promise<ActionState> {
  const parsed = entryInputSchema.safeParse({ mediaType: scalar(form, "mediaType"), id: scalar(form, "id"), intent: scalar(form, "intent") });
  if (!parsed.success) return invalid;
  const { mediaType, id, intent } = parsed.data;
  const changes = intent === "save" ? changesSchema.safeParse({ status: scalar(form, "status"), reaction: scalar(form, "reaction"), tags: form.getAll("tags") }) : null;
  if (changes && !changes.success) return invalid;
  let message = "";
  try {
    const account = await readAccount();
    if (!account) return { ok: false, message: "Your session has expired. Please sign in again before saving changes." };
    const { client, user } = account;
    const identity = { owner: user.id, media_type: mediaType, tmdb_id: id };
    if (intent === "save" && changes?.success) {
      const existing = await client.from("library_entries").select("tmdb_id").match(identity).maybeSingle();
      if (existing.error) throw new Error("Library unavailable");
      if (!existing.data && !await detail(mediaType, String(id))) return { ok: false, message: "This title is no longer available in the catalog." };
      const saved = await client.from("library_entries").upsert({ ...identity, ...changes.data }, { onConflict: "owner,media_type,tmdb_id" })
        .select("tmdb_id,media_type,status,reaction,tags").single();
      if (saved.error || !entrySchema.safeParse(saved.data).success) throw new Error("Save failed");
      message = "Saved to your library.";
    } else if (intent === "dismiss") {
      if (!await detail(mediaType, String(id))) return { ok: false, message: "This title is no longer available in the catalog." };
      const saved = await client.from("dismissals").upsert(identity, { onConflict: "owner,media_type,tmdb_id" }).select("tmdb_id").single();
      if (saved.error || !saved.data) throw new Error("Dismissal failed");
      message = "Marked not interested. You can undo this in your library.";
    } else {
      const table = intent === "remove" ? "library_entries" : "dismissals";
      const removed = await client.from(table).delete().match(identity).select("tmdb_id");
      if (removed.error) throw new Error("Removal failed");
      message = intent === "remove" ? "Removed from your library." : "Dismissal undone.";
    }
  } catch {
    return { ok: false, message: "We couldn’t save that change. Your form is still here; please try again in a moment." };
  }
  revalidatePath("/library");
  revalidatePath("/onboarding");
  revalidatePath(`/title/${mediaType}/${id}`);
  return { ok: true, message };
}

export async function savePreferences(_previous: ActionState, form: FormData): Promise<ActionState> {
  const intent = scalar(form, "intent");
  const parsed = preferencesSchema.safeParse(form.getAll("genres"));
  if (!["save", "skip"].includes(intent || "") || (intent === "save" && !parsed.success)) return { ok: false, message: "Please choose valid genres and try again." };
  try {
    const account = await readAccount();
    if (!account) return { ok: false, message: "Your session has expired. Please sign in again." };
    let preferences: number[] | undefined;
    if (intent === "save" && parsed.success) {
      const allowed = new Set((await genres()).map(genre => genre.id));
      if (parsed.data.some(id => !allowed.has(id))) return { ok: false, message: "Please choose genres from the available list." };
      preferences = parsed.data;
    }
    const saved = await account.client.from("profiles").update({ onboarding_completed: true,
      ...(preferences ? { genre_preferences: preferences } : {}) }).eq("owner", account.user.id).select("onboarding_completed").single();
    if (saved.error || !saved.data?.onboarding_completed) throw new Error("Preferences not saved");
  } catch { return { ok: false, message: "We couldn’t update your preferences. Please try again." }; }
  revalidatePath("/settings");
  revalidatePath("/library");
  revalidatePath("/onboarding");
  redirect("/library");
}
