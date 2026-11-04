import type { CatalogTitle } from "./catalog.ts";

// Plain, explainable genre heuristic. Reaction 3 ("It was okay") is neutral; it is an ordinal
// label, so these weights rank genres but never claim a match probability.
export type Taste = { rated: Map<number, number>; preferred: Set<number> };
export type Pick = { title: CatalogTitle; reason: string; onWatchlist: boolean };
export const key = (title: { mediaType?: string; media_type?: string; id?: number; tmdb_id?: number }) =>
  `${title.mediaType ?? title.media_type}:${title.id ?? title.tmdb_id}`;

export function buildTaste(rated: { genreIds: number[]; reaction: number }[], preferred: number[]): Taste {
  const weights = new Map<number, number>();
  for (const { genreIds, reaction } of rated) for (const genre of new Set(genreIds)) weights.set(genre, (weights.get(genre) ?? 0) + reaction - 3);
  return { rated: weights, preferred: new Set(preferred) };
}

const weight = (taste: Taste, genre: number) => (taste.rated.get(genre) ?? 0) + (taste.preferred.has(genre) ? 1 : 0);

export function topGenres(taste: Taste, count = 3) {
  return [...new Set([...taste.rated.keys(), ...taste.preferred])].filter(genre => weight(taste, genre) > 0)
    .sort((a, b) => weight(taste, b) - weight(taste, a) || a - b).slice(0, count);
}

export function recommend(candidates: CatalogTitle[], taste: Taste, excluded: Set<string>, watchlist: Set<string>,
  genreNames: Map<number, string>, limit = 12): Pick[] {
  const seen = new Set<string>();
  const pool = candidates.filter(title => !excluded.has(key(title)) && !seen.has(key(title)) && seen.add(key(title))).map(title => {
    const matched = [...new Set(title.genreIds)].filter(genre => weight(taste, genre) > 0).sort((a, b) => weight(taste, b) - weight(taste, a));
    return { title, matched, score: title.genreIds.reduce((sum, genre) => sum + weight(taste, genre), 0) };
  }).filter(item => item.score >= 0); // net-disliked genres are never suggested, even as popular fill
  const picks: Pick[] = [];
  const leads = new Map<number, number>();
  // Greedy diversity: each earlier pick with the same lead genre costs 2, so one loved genre cannot fill the list.
  while (picks.length < limit && pool.length) {
    const adjusted = (item: typeof pool[number]) => item.score - 2 * (leads.get(item.matched[0]) ?? 0);
    const best = pool.reduce((top, item, index) => adjusted(item) > adjusted(pool[top]) ? index : top, 0);
    const [item] = pool.splice(best, 1);
    if (item.matched.length) leads.set(item.matched[0], (leads.get(item.matched[0]) ?? 0) + 1);
    picks.push({ title: item.title, onWatchlist: watchlist.has(key(item.title)), reason: explain(item.matched, item.score, taste, genreNames) });
  }
  return picks;
}

function explain(matched: number[], score: number, taste: Taste, names: Map<number, string>) {
  if (!matched.length || score <= 0) return "Popular on TMDB right now";
  const label = (genres: number[]) => genres.map(genre => names.get(genre)).filter(Boolean).slice(0, 2).join(" and ");
  const rated = label(matched.filter(genre => (taste.rated.get(genre) ?? 0) > 0));
  const chosen = label(matched.filter(genre => taste.preferred.has(genre)));
  if (rated) return `Matches genres you rated highly: ${rated}`;
  if (chosen) return `Matches genres you chose: ${chosen}`;
  return "Shares genres with titles you rated highly";
}
