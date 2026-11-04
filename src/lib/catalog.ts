import { z } from "zod";

export const mediaTypeSchema = z.enum(["movie", "tv"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;
export const idSchema = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(z.number().int().max(2147483647));
export const searchSchema = z.object({
  q: z.string().trim().min(2).max(100),
  type: mediaTypeSchema.default("movie"),
  page: z.string().regex(/^[1-9]\d?$/).default("1").transform(Number).pipe(z.number().int().max(20)),
});

const posterPath = z.string().regex(/^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/).nullable().catch(null);
const common = {
  id: z.number().int().positive().max(2147483647),
  overview: z.string().max(20000).nullish().transform(value => value || ""),
  poster_path: posterPath,
  vote_average: z.number().min(0).max(10),
  vote_count: z.number().int().nonnegative(),
  adult: z.boolean().optional(),
  original_language: z.string().max(16).optional(),
  genre_ids: z.array(z.number().int().positive()).max(20).optional(),
};
const movieSchema = z.object({ ...common, title: z.string().trim().min(1).max(500), release_date: z.string().max(10).optional() });
const tvSchema = z.object({ ...common, name: z.string().trim().min(1).max(500), first_air_date: z.string().max(10).optional() });
const detailFields = {
  genres: z.array(z.object({ id: z.number().int().positive(), name: z.string().max(100) })).max(50),
};
const movieDetailSchema = movieSchema.extend({ ...detailFields, runtime: z.number().int().nonnegative().nullable() });
const tvDetailSchema = tvSchema.extend({ ...detailFields, number_of_seasons: z.number().int().nonnegative() });

export type CatalogTitle = {
  id: number; mediaType: MediaType; title: string; date: string; overview: string;
  posterPath: string | null; communityScore: number; voteCount: number; language: string; genreIds: number[];
};
export type CatalogDetail = CatalogTitle & { genres: string[]; runtime: number | null; seasons: number | null };

function normalize(raw: (z.infer<typeof movieSchema> | z.infer<typeof tvSchema>) & { genres?: { id: number }[] }, mediaType: MediaType): CatalogTitle {
  return {
    id: raw.id, mediaType, title: "title" in raw ? raw.title : raw.name,
    date: ("release_date" in raw ? raw.release_date : "first_air_date" in raw ? raw.first_air_date : "") || "",
    overview: raw.overview, posterPath: raw.poster_path,
    communityScore: raw.vote_average, voteCount: raw.vote_count, language: raw.original_language || "",
    genreIds: raw.genres?.map(genre => genre.id) ?? raw.genre_ids ?? [],
  };
}

export function parseList(value: unknown, mediaType: MediaType) {
  const item = mediaType === "movie" ? movieSchema : tvSchema;
  const parsed = z.object({
    page: z.number().int().positive(), total_pages: z.number().int().nonnegative(),
    results: z.array(item).max(20),
  }).parse(value);
  const seen = new Set<number>();
  return {
    page: parsed.page, totalPages: Math.min(parsed.total_pages, 20),
    titles: parsed.results.filter(title => {
      if (title.adult || seen.has(title.id)) return false;
      seen.add(title.id);
      return true;
    }).map(title => normalize(title, mediaType)),
  };
}

export function parseDetail(value: unknown, mediaType: MediaType): CatalogDetail | null {
  const raw = (mediaType === "movie" ? movieDetailSchema : tvDetailSchema).parse(value);
  if (raw.adult) return null;
  return { ...normalize(raw, mediaType), genres: raw.genres.map(genre => genre.name),
    runtime: "runtime" in raw ? raw.runtime : null, seasons: "number_of_seasons" in raw ? raw.number_of_seasons : null };
}

