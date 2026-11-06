"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { readAccount } from "@/lib/account";
import { scalar } from "@/lib/library-input";
import { seal, VaultError } from "@/lib/vault";
import { runFinder, runVerdict, verdictById, type Outcome } from "@/lib/ai";
import type { VerdictView } from "@/components/verdict-card";
import {
  aiErrors,
  CONSENT_VERSION,
  finderInputSchema,
  keyInputSchema,
  verdictInputSchema,
  type AiErrorCode,
} from "@/lib/ai-contract";

// nextKey: a fresh idempotency key for the next attempt; reusing a submitted key is reported as a duplicate.
export type AiActionState = {
  ok: boolean;
  message: string;
  code?: AiErrorCode;
  nextKey?: string;
  verdict?: VerdictView;
};
const expired: AiActionState = { ok: false, message: aiErrors.auth, code: "auth" };
const failed = (message: string): AiActionState => ({ ok: false, message });
const invalidInput = (): AiActionState => ({
  ok: false,
  message: aiErrors.invalid_input,
  code: "invalid_input",
  nextKey: randomUUID(),
});

function settingsChanged() {
  revalidatePath("/settings");
  revalidatePath("/ai", "layout");
}

export async function saveKey(_previous: AiActionState, form: FormData): Promise<AiActionState> {
  const parsed = keyInputSchema.safeParse(scalar(form, "apiKey"));
  if (!parsed.success)
    return failed("That doesn’t look like a Gemini API key. Paste the whole key and try again.");
  try {
    const account = await readAccount();
    if (!account) return expired;
    const sealed = seal(account.user.id, parsed.data);
    const saved = await account.client
      .from("provider_credentials")
      .upsert(
        { owner: account.user.id, ...sealed, key_hint: parsed.data.slice(-4) },
        { onConflict: "owner" },
      )
      .select("key_hint")
      .single();
    if (saved.error) throw new Error("Key not saved");
  } catch (error) {
    return failed(
      error instanceof VaultError
        ? "Key storage isn’t configured on this server yet."
        : "We couldn’t save your key. Please try again.",
    );
  }
  settingsChanged();
  return {
    ok: true,
    message:
      "Gemini key saved. It’s encrypted and can’t be viewed again, only replaced or deleted.",
  };
}

export async function deleteKey(): Promise<AiActionState> {
  try {
    const account = await readAccount();
    if (!account) return expired;
    const removed = await account.client
      .from("provider_credentials")
      .delete()
      .eq("owner", account.user.id)
      .select("owner");
    if (removed.error) throw new Error("Key not deleted");
  } catch {
    return failed("We couldn’t delete your key. Please try again.");
  }
  settingsChanged();
  return { ok: true, message: "Gemini key deleted. No further AI requests will be made with it." };
}

export async function changeConsent(
  _previous: AiActionState,
  form: FormData,
): Promise<AiActionState> {
  const intent = scalar(form, "intent");
  if (
    intent === "accept" &&
    (scalar(form, "adult") !== "yes" || scalar(form, "understood") !== "yes")
  )
    return failed("Please confirm both statements to turn on AI features.");
  if (intent !== "accept" && intent !== "withdraw") return failed("Please try again.");
  try {
    const account = await readAccount();
    if (!account) return expired;
    const result = await account.client.rpc("set_ai_consent", {
      p_version: intent === "accept" ? CONSENT_VERSION : null,
    });
    if (result.error) throw new Error("Consent not saved");
  } catch {
    return failed("We couldn’t update your AI consent. Please try again.");
  }
  settingsChanged();
  return {
    ok: true,
    message:
      intent === "accept"
        ? "AI features are on for your account."
        : "AI consent withdrawn. No further AI requests will be made.",
  };
}

function finish(outcome: Outcome): AiActionState {
  if (!outcome.ok)
    return {
      ok: false,
      message: aiErrors[outcome.code],
      code: outcome.code,
      nextKey: randomUUID(),
    };
  revalidatePath("/ai", "layout");
  redirect(`/ai/${outcome.id}`);
}

// Unexpected failures (database, limiter) show an inline message and a server-log line instead of the error page.
function unexpected(where: string, error: unknown): AiActionState {
  unstable_rethrow(error);
  console.error(
    `[ai] ${where} failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  return {
    ok: false,
    message:
      "Something went wrong on our side and nothing was saved. Please try again in a moment.",
    nextKey: randomUUID(),
  };
}

export async function askVerdict(previous: AiActionState, form: FormData): Promise<AiActionState> {
  try {
    return await verdict(form);
  } catch (error) {
    return unexpected("verdict", error);
  }
}

export async function findTitles(previous: AiActionState, form: FormData): Promise<AiActionState> {
  try {
    return await finder(form);
  } catch (error) {
    return unexpected("finder", error);
  }
}

async function verdict(form: FormData): Promise<AiActionState> {
  const parsed = verdictInputSchema.safeParse({
    mediaType: scalar(form, "mediaType"),
    id: scalar(form, "id"),
    requestKey: scalar(form, "requestKey"),
    subset: scalar(form, "subset"),
  });
  if (!parsed.success) return invalidInput();
  const outcome = await runVerdict(parsed.data);
  if (!outcome.ok) return finish(outcome);
  // Shown inline under the button; it is already saved, so reading it back makes no Gemini call.
  revalidatePath("/ai", "layout");
  const account = await readAccount();
  const verdict = account ? await verdictById(account, outcome.id) : null;
  if (!verdict) redirect(`/ai/${outcome.id}`);
  return { ok: true, message: "", verdict, nextKey: randomUUID() };
}

async function finder(form: FormData): Promise<AiActionState> {
  const parsed = finderInputSchema.safeParse({
    mediaType: scalar(form, "mediaType"),
    genres: form.getAll("genres"),
    language: scalar(form, "language"),
    maxRuntime: scalar(form, "maxRuntime"),
    mood: scalar(form, "mood"),
    exclude: form.getAll("exclude"),
    requestKey: scalar(form, "requestKey"),
    subset: scalar(form, "subset"),
  });
  if (!parsed.success) return invalidInput();
  return finish(await runFinder(parsed.data));
}

export async function deleteResults(form: FormData) {
  const id = scalar(form, "id");
  const all = scalar(form, "scope") === "all";
  if (!all && !z.string().uuid().safeParse(id).success) return;
  const account = await readAccount();
  if (!account) redirect("/login");
  let query = account.client.from("ai_results").delete().eq("owner", account.user.id);
  if (!all) query = query.eq("id", id!);
  const removed = await query.select("id");
  if (removed.error) throw new Error("Results not deleted");
  revalidatePath("/ai", "layout");
  redirect("/ai?deleted=1");
}
