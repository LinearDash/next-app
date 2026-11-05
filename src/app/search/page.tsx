import Link from "next/link";
import { searchSchema } from "@/lib/catalog";
import { search } from "@/lib/tmdb";
import { TitleGrid, SearchForm, CatalogNotice, searchScopes } from "@/components/catalog";

export const metadata = { title: "Search", robots: { index: false, follow: false } };

export default async function Search({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const parsed = searchSchema.safeParse({ q: params.q, type: params.type, page: params.page });
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const type = parsed.success ? parsed.data.type : params.type === "movie" || params.type === "tv" ? params.type : "all";
  let result: Awaited<ReturnType<typeof search>> | null = null;
  let failed = false;
  if (parsed.success) {
    try { result = await search({ q: parsed.data.q, type: parsed.data.type, page: String(parsed.data.page) }); }
    catch { failed = true; }
  }
  const q = parsed.success ? parsed.data.q : "";
  const href = (page: number, scope: string = type) => `/search?${new URLSearchParams({ q, type: scope, page: String(page) })}`;
  const noun = type === "movie" ? "movies" : type === "tv" ? "TV series" : "movies or TV series";
  return <section className="catalog-page"><p className="eyebrow">LESS SCROLLING, MORE STORIES</p><h1>Find <em>your next watch.</em></h1>{/* key: remount so the uncontrolled inputs reflect a new query/scope after client navigation (e.g. a filter chip) */}<SearchForm key={`${type}:${query}`} query={query} type={type} />
    {!parsed.success && <p className="notice" role="status">{Object.keys(params).length ? "Use a title of 2–100 characters, choose All, Movies or TV series, and a page from 1–20. Each search field must appear only once." : "Search for a movie or TV series by its title."}</p>}
    {failed && <CatalogNotice retry={href(parsed.success ? parsed.data.page : 1)} />}
    {result && <section aria-labelledby="search-results">
      <h2 id="search-results">Results for <em>“{q}”</em></h2>
      <div className="result-bar">
        <nav className="filter-chips" aria-label="Filter results">{searchScopes.map(([value, label]) =>
          <Link key={value} href={href(1, value)} prefetch={false} aria-current={type === value ? "true" : undefined}>{label}</Link>)}</nav>
        <p className="muted small" role="status">{type === "all" ? "Movies and TV series" : type === "movie" ? "Movies only" : "TV series only"} · Page {result.page}{result.totalPages ? ` of ${result.totalPages}` : ""}</p>
      </div>
      {result.titles.length ? <TitleGrid titles={result.titles} badges={type === "all"} /> : <p className="notice" role="status">No {noun} match “{q}”. Try another title.</p>}
      <nav className="pagination" aria-label="Search result pages">{result.page > 1 && <Link className="button secondary" href={href(result.page - 1)} prefetch={false}>← Previous</Link>}{result.page < result.totalPages && <Link className="button secondary" href={href(result.page + 1)} prefetch={false}>Next →</Link>}</nav>
    </section>}
  </section>;
}
