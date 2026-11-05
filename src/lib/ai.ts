import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { readAccount } from "./account";
import { catalogLabels, entryColumns } from "./library";
import { entrySchema } from "./library-input";
import { detail, discover, genres, CatalogError } from "./tmdb";
import { diagnose, generate, GeminiError } from "./gemini";
import { unseal, vaultConfigured, VaultError } from "./vault";
import type { VerdictView } from "@/components/verdict-card";
import { availability, checkFinder, parseSaved, savedRowSchema, CONSENT_VERSION, finderOutputSchema, finderResponseSchema, GEMINI_MODEL, PROMPT_VERSION, reactionMeaning,
  SCHEMA_VERSION, TASTE_BUDGET, verdictOutputSchema, verdictResponseSchema, type AiErrorCode, type FinderInput } from "./ai-contract";
import type { CatalogTitle, MediaType } from "./catalog";

export type Outcome = { ok: true; id: string } | { ok: false; code: AiErrorCode };
class AiFailure extends Error { constructor(public code: AiErrorCode) { super(code); } }
const credentialColumns = "ciphertext,nonce,auth_tag,key_version,key_hint";
const credentialSchema = z.object({ ciphertext: z.string(), nonce: z.string(), auth_tag: z.string(), key_version: z.string(), key_hint: z.string() });
type Account = NonNullable<Awaited<ReturnType<typeof readAccount>>>;

export async function aiAvailability() {
  // x-vercel-ip-country is set by the Vercel edge; elsewhere it is client-controlled, so only trust it on Vercel.
  const country = process.env.VERCEL === "1" || process.env.GEMINI_TRUST_COUNTRY_HEADER === "1" ? (await headers()).get("x-vercel-ip-country") : null;
  return availability({ enabled: process.env.GEMINI_ENABLED, countries: process.env.GEMINI_ALLOWED_COUNTRIES,
    production: process.env.NODE_ENV === "production", vault: vaultConfigured() }, country);
}

export async function aiStatus(account: Account) {
  const { client, user } = account;
  const [profile, credential] = await Promise.all([
    client.from("profiles").select("consent_version,consent_at,genre_preferences").eq("owner", user.id).single(),
    client.from("provider_credentials").select("key_hint,updated_at").eq("owner", user.id).maybeSingle(),
  ]);
  if (profile.error || credential.error) throw new Error(`AI settings unavailable (${profile.error?.code ?? credential.error?.code})`);
  const parsed = z.object({ consent_version: z.string().nullable(), genre_preferences: z.array(z.number().int().positive()).max(30) }).parse(profile.data);
  return { consented: parsed.consent_version === CONSENT_VERSION, preferences: parsed.genre_preferences,
    keyHint: credential.data ? z.string().regex(/^[A-Za-z0-9_.-]{4}$/).parse(credential.data.key_hint) : null };
}

async function gate(subset: boolean): Promise<Account> {
  const available = await aiAvailability();
  if (available !== "ok") throw new AiFailure(available);
  const account = await readAccount();
  if (!account) throw new AiFailure("auth");
  const status = await aiStatus(account);
  if (!status.consented) throw new AiFailure("consent_required");
  if (!status.keyHint) throw new AiFailure("missing_key");
  // Cheap pre-check so an oversized history asks for subset consent before using a quota slot.
  const rated = await account.client.from("library_entries").select("tmdb_id", { count: "exact", head: true }).eq("owner", account.user.id).not("reaction", "is", null);
  if (rated.error) throw new Error(`Rated-title count unavailable (${rated.error.code})`);
  if ((rated.count ?? 0) > TASTE_BUDGET && !subset) throw new AiFailure("oversized");
  return account;
}

async function taste(account: Account, subset: boolean) {
  const { client, user } = account;
  const [rated, profile] = await Promise.all([
    client.from("library_entries").select(entryColumns).eq("owner", user.id).not("reaction", "is", null)
      .order("updated_at", { ascending: false }).order("media_type").order("tmdb_id").limit(TASTE_BUDGET + 1),
    aiStatus(account),
  ]);
  if (rated.error) throw new Error(`Rated titles unavailable (${rated.error.code})`);
  const entries = z.array(entrySchema).max(TASTE_BUDGET + 1).parse(rated.data);
  // Never silently truncate: a larger history needs the user's explicit consent to the disclosed subset.
  if (entries.length > TASTE_BUDGET && !subset) throw new AiFailure("oversized");
  const labelled = await catalogLabels(entries.slice(0, TASTE_BUDGET));
  if (labelled.some(row => !row.title)) throw new AiFailure("catalog_unavailable");
  const names = await genreNames();
  const titles = labelled.map(row => ({ title: row.title!.title, media_type: row.media_type, year: row.title!.date.slice(0, 4), reaction: row.reaction!, meaning: reactionMeaning(row.reaction!) }));
  const chosen = profile.preferences.map(id => names.get(id)).filter(Boolean);
  const fingerprint = createHash("sha256").update(JSON.stringify([labelled.map(row => `${row.media_type}:${row.tmdb_id}:${row.reaction}`).sort(), profile.preferences, subset])).digest("hex");
  return { titles, chosen, fingerprint, ratedCount: titles.length, subset: entries.length > TASTE_BUDGET };
}

async function genreNames() {
  try { return new Map((await genres()).map(genre => [genre.id, genre.name])); } catch { throw new AiFailure("catalog_unavailable"); }
}

async function userKey(account: Account) {
  const row = await account.client.from("provider_credentials").select(credentialColumns).eq("owner", account.user.id).maybeSingle();
  if (row.error) throw new Error(`Vault unavailable (${row.error.code})`);
  if (!row.data) throw new AiFailure("missing_key");
  return unseal(account.user.id, credentialSchema.parse(row.data));
}

// Atomic per-user limit around the expensive part; every exit records the request as finished.
async function limited(account: Account, action: "verdict" | "finder", requestKey: string, work: () => Promise<string>): Promise<Outcome> {
  const begun = await account.client.rpc("begin_ai_request", { p_action: action, p_key: requestKey });
  if (begun.error) {
    const code = ({ IW001: "duplicate", IW002: "busy", IW003: "quota" } as const)[begun.error.code as "IW001"];
    if (code) return { ok: false, code };
    throw new Error(`Request limits unavailable (${begun.error.code})`); // fail closed
  }
  let ok = false;
  try {
    const id = await work();
    ok = true;
    return { ok: true, id };
  } catch (error) {
    if (error instanceof AiFailure || error instanceof GeminiError) return { ok: false, code: error.code };
    if (error instanceof CatalogError) return { ok: false, code: "catalog_unavailable" };
    if (error instanceof VaultError) return { ok: false, code: "missing_key" };
    throw error;
  } finally {
    await account.client.rpc("finish_ai_request", { p_id: z.string().uuid().parse(begun.data), p_ok: ok });
  }
}

async function save(account: Account, row: { action: "verdict" | "finder"; media_type: MediaType; tmdb_id: number | null; result: object; taste_fingerprint: string }) {
  // Key deletion or consent withdrawal during the provider call discards the answer instead of saving it.
  const status = await aiStatus(account);
  if (!status.consented) throw new AiFailure("consent_required");
  if (!status.keyHint) throw new AiFailure("missing_key");
  const saved = await account.client.from("ai_results").insert({ owner: account.user.id, ...row, model: GEMINI_MODEL, prompt_version: PROMPT_VERSION, schema_version: SCHEMA_VERSION })
    .select("id").single();
  if (saved.error) throw new Error(`Result not saved (${saved.error.code})`);
  return z.string().uuid().parse(saved.data.id);
}

const snapshot = (title: CatalogTitle) => ({ id: title.id, mediaType: title.mediaType, title: title.title, year: title.date.slice(0, 4), posterPath: title.posterPath });

export async function runVerdict(input: { mediaType: MediaType; id: number; requestKey: string; subset: boolean }): Promise<Outcome> {
  let account;
  try { account = await gate(input.subset); } catch (error) { if (error instanceof AiFailure) return { ok: false, code: error.code }; throw error; }
  return limited(account, "verdict", input.requestKey, async () => {
    const subject = await detail(input.mediaType, String(input.id));
    if (!subject) throw new AiFailure("invalid_input");
    const profile = await taste(account, input.subset);
    const output = verdictOutputSchema.safeParse(await generate(await userKey(account), {
      task: "verdict", reaction_scale: "1 Hated it, 2 Disliked it, 3 It was okay, 4 Liked it, 5 Loved it",
      subject: { title: subject.title, media_type: subject.mediaType, year: subject.date.slice(0, 4), genres: subject.genres, overview: subject.overview.slice(0, 1500) },
      rated_titles: profile.titles, chosen_genres: profile.chosen,
    }, verdictResponseSchema));
    if (!output.success) { diagnose("verdict output rejected", issues(output.error)); throw new AiFailure("invalid_response"); }
    return save(account, { action: "verdict", media_type: subject.mediaType, tmdb_id: subject.id, taste_fingerprint: profile.fingerprint,
      result: { ...output.data, subject: snapshot(subject), ratedCount: profile.ratedCount, subset: profile.subset } });
  });
}

export async function runFinder(input: FinderInput): Promise<Outcome> {
  let account;
  try { account = await gate(input.subset); } catch (error) { if (error instanceof AiFailure) return { ok: false, code: error.code }; throw error; }
  return limited(account, "finder", input.requestKey, async () => {
    const names = await genreNames();
    if (input.genres.some(id => !names.has(id))) throw new AiFailure("invalid_input");
    const options = { genreIds: input.genres, language: input.language || undefined, maxRuntime: input.maxRuntime || undefined };
    const pages = await Promise.all([1, 2].map(page => discover(input.mediaType, { ...options, page }).catch(error => { if (page === 1) throw error; return null; })));
    const listed = [...new Map(pages.flatMap(page => page?.titles ?? []).map(title => [title.id, title])).values()];
    const ids = listed.map(title => title.id);
    const empty = { data: [], error: null };
    const { client, user } = account;
    // Exclusions are enforced here, never left to the model.
    const [saved, dismissed] = ids.length ? await Promise.all([
      client.from("library_entries").select("tmdb_id,status").eq("owner", user.id).eq("media_type", input.mediaType).in("tmdb_id", ids),
      client.from("dismissals").select("tmdb_id").eq("owner", user.id).eq("media_type", input.mediaType).in("tmdb_id", ids),
    ]) : [empty, empty];
    if (saved.error || dismissed.error) throw new Error(`Finder exclusions unavailable (${saved.error?.code ?? dismissed.error?.code})`);
    const excluded = new Set([...input.exclude,
      ...z.array(z.object({ tmdb_id: z.number(), status: z.string() })).parse(saved.data).filter(row => row.status !== "want_to_watch").map(row => row.tmdb_id),
      ...z.array(z.object({ tmdb_id: z.number() })).parse(dismissed.data).map(row => row.tmdb_id)]);
    const pool = listed.filter(title => !excluded.has(title.id)).slice(0, 30);
    if (!pool.length) throw new AiFailure("no_matches"); // no billable call when nothing can match
    const profile = await taste(account, input.subset);
    const output = finderOutputSchema.safeParse(await generate(await userKey(account), {
      task: "finder", media_type: input.mediaType, reaction_scale: "1 Hated it, 2 Disliked it, 3 It was okay, 4 Liked it, 5 Loved it",
      filters: { genres: input.genres.map(id => names.get(id)), original_language: input.language || null, max_runtime_minutes: input.maxRuntime || null },
      mood: input.mood || null,
      candidates: pool.map(title => ({ id: title.id, title: title.title, year: title.date.slice(0, 4), genres: title.genreIds.map(id => names.get(id)).filter(Boolean), overview: title.overview.slice(0, 300) })),
      rated_titles: profile.titles, chosen_genres: profile.chosen,
    }, finderResponseSchema));
    if (!output.success) { diagnose("finder output rejected", issues(output.error)); throw new AiFailure("invalid_response"); }
    const checked = checkFinder(output.data, new Set(pool.map(title => title.id)));
    if (!checked) { diagnose("finder picked IDs outside the candidates"); throw new AiFailure("invalid_response"); }
    if (!checked.picks.length) throw new AiFailure("no_matches");
    const byId = new Map(pool.map(title => [title.id, title]));
    return save(account, { action: "finder", media_type: input.mediaType, tmdb_id: null, taste_fingerprint: profile.fingerprint, result: {
      picks: checked.picks.map(pick => ({ ...snapshot(byId.get(pick.id)!), reason: pick.reason })),
      request: { mediaType: input.mediaType, genres: input.genres, language: input.language, maxRuntime: input.maxRuntime, mood: input.mood, exclude: input.exclude },
      ratedCount: profile.ratedCount, subset: profile.subset } });
  });
}

// Saved verdicts as display data for the inline card. Reading a saved verdict never calls Gemini.
const verdictColumns = "id,action,created_at,model,prompt_version,result";
function toVerdictView(data: unknown): VerdictView | null {
  const row = savedRowSchema.safeParse(data);
  if (!row.success) return null;
  const saved = parseSaved(row.data);
  if (saved?.kind !== "verdict") return null;
  return { id: row.data.id, verdict: saved.verdict, summary: saved.summary, reasonsFor: saved.reasons_for, reasonsAgainst: saved.reasons_against,
    when: `${new Date(row.data.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`,
    model: row.data.model, promptVersion: row.data.prompt_version, subset: saved.subset, ratedCount: saved.ratedCount, budget: TASTE_BUDGET };
}

export async function verdictById(account: Account, id: string) {
  const row = await account.client.from("ai_results").select(verdictColumns).eq("owner", account.user.id).eq("id", id).maybeSingle();
  return row.error ? null : toVerdictView(row.data);
}

export async function latestVerdict(account: Account, mediaType: MediaType, id: number) {
  const row = await account.client.from("ai_results").select(verdictColumns).eq("owner", account.user.id).eq("action", "verdict")
    .eq("media_type", mediaType).eq("tmdb_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return row.error ? null : toVerdictView(row.data);
}

// Which fields failed and how (e.g. "summary too_big"), never the values.
const issues = (error: z.ZodError) => error.issues.slice(0, 5).map(issue => `${issue.path.join(".") || "root"} ${issue.code}`);
