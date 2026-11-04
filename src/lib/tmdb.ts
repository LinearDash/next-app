import "server-only";
import { z } from "zod";
import { mediaTypeSchema, idSchema, searchSchema, parseList, parseDetail, type MediaType } from "./catalog";

export class CatalogError extends Error {
  constructor(public code: "configuration" | "unavailable" | "busy" | "invalid") {
    super("Catalog request could not be completed");
  }
}

function providerConfig() {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  if (!token) throw new CatalogError("configuration");
  const simulation = process.env.TMDB_SIMULATION_URL;
  if (simulation) {
    const url = new URL(simulation);
    // Tests may target a loopback stand-in, but must never forward a real credential.
    if (token !== "catalog-simulation-token" || !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.protocol !== "http:" || url.username || url.password || url.search || url.hash) {
      throw new CatalogError("configuration");
    }
    return { token, base: simulation.replace(/\/$/, ""), simulation: true };
  }
  return { token, base: "https://api.themoviedb.org/3", simulation: false };
}

let activeRequests = 0;
let searches = 0;
let searchWindow = 0;

async function request(path: string, params: URLSearchParams, ttl: number) {
  const config = providerConfig();
  const now = Date.now();
  // ponytail: per-instance MVP guard; use distributed/platform limits before public launch.
  if (now - searchWindow >= 60000) { searchWindow = now; searches = 0; }
  if (activeRequests >= 8 || (path.startsWith("/search/") && searches >= 60)) throw new CatalogError("busy");
  if (path.startsWith("/search/")) searches++;
  params.set("language", "en-US");
  activeRequests++;
  try {
    const response = await fetch(`${config.base}${path}?${params}`, {
      headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(6000), redirect: "error",
      ...(config.simulation ? { cache: "no-store" as const } : { next: { revalidate: ttl } }),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new CatalogError(response.status === 429 ? "busy" : "unavailable");
    const reader = response.body?.getReader();
    if (!reader) throw new CatalogError("unavailable");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1048576) throw new CatalogError("unavailable");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError("unavailable");
  } finally { activeRequests--; }
}

export async function popular(mediaType: MediaType) {
  mediaTypeSchema.parse(mediaType);
  const value = await request(`/${mediaType}/popular`, new URLSearchParams({ page: "1" }), 3600);
  try { return parseList(value, mediaType); } catch { throw new CatalogError("unavailable"); }
}

const discoverSchema = z.object({
  genreIds: z.array(z.number().int().positive().max(999999)).max(5).default([]),
  language: z.string().regex(/^[a-z]{2}$/).optional(),
  maxRuntime: z.number().int().min(60).max(240).optional(),
  page: z.number().int().min(1).max(3).default(1),
});

export async function discover(mediaType: MediaType, options: z.input<typeof discoverSchema>) {
  mediaTypeSchema.parse(mediaType);
  const { genreIds, language, maxRuntime, page } = discoverSchema.parse(options);
  // "|" means any of these genres; a vote floor keeps obscure, unrated titles out of suggestions.
  const params = new URLSearchParams({ sort_by: "popularity.desc", include_adult: "false", "vote_count.gte": "50", page: String(page) });
  if (genreIds.length) params.set("with_genres", genreIds.join("|"));
  if (language) params.set("with_original_language", language);
  if (maxRuntime && mediaType === "movie") params.set("with_runtime.lte", String(maxRuntime));
  const value = await request(`/discover/${mediaType}`, params, 3600);
  try { return parseList(value, mediaType); } catch { throw new CatalogError("unavailable"); }
}

export async function search(input: { q: string; type?: string; page?: string }) {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) throw new CatalogError("invalid");
  const { q, type, page } = parsed.data;
  const value = await request(`/search/${type}`, new URLSearchParams({ query: q, page: String(page), include_adult: "false" }), 60);
  try {
    const result = parseList(value, type);
    if (result.page !== page) throw new Error("Mismatched page");
    return result;
  } catch { throw new CatalogError("unavailable"); }
}

export async function detail(type: string, id: string) {
  const mediaType = mediaTypeSchema.safeParse(type);
  const parsedId = idSchema.safeParse(id);
  if (!mediaType.success || !parsedId.success) return null;
  const value = await request(`/${mediaType.data}/${parsedId.data}`, new URLSearchParams(), 21600);
  if (value === null) return null;
  try {
    const title = parseDetail(value, mediaType.data);
    if (title && title.id !== parsedId.data) throw new Error("Mismatched title identity");
    return title;
  } catch { throw new CatalogError("unavailable"); }
}

export async function genres() {
  const schema = z.object({ genres: z.array(z.object({ id: z.number().int().positive(), name: z.string().min(1).max(100) })).max(30) });
  const lists = await Promise.all(["movie", "tv"].map(async type => {
    const value = await request(`/genre/${type}/list`, new URLSearchParams(), 86400);
    try { return schema.parse(value).genres; } catch { throw new CatalogError("unavailable"); }
  }));
  return [...new Map(lists.flat().map(genre => [genre.id, genre])).values()].sort((a, b) => a.name.localeCompare(b.name));
}
