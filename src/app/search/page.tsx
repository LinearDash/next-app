import Link from "next/link";
import { searchSchema } from "@/lib/catalog";
import { search } from "@/lib/tmdb";
import { TitleGrid, SearchForm, CatalogNotice } from "@/components/catalog";

export const metadata = { title: "Search", robots: { index: false, follow: false } };

export default async function Search({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const parsed = searchSchema.safeParse({ q: params.q, type: params.type, page: params.page });
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const type = params.type === "tv" ? "tv" : "movie";
  let result: Awaited<ReturnType<typeof search>> | null = null;
  let failed = false;
  if (parsed.success) {
    try { result = await search({ q: parsed.data.q, type: parsed.data.type, page: String(parsed.data.page) }); }
    catch { failed = true; }
  }
  const href = (page: number) => `/search?${new URLSearchParams({ q: parsed.success ? parsed.data.q : "", type, page: String(page) })}`;
  return <section className="catalog-page"><p className="eyebrow">LESS SCROLLING, MORE STORIES</p><h1>Find <em>your next watch.</em></h1><SearchForm query={query} type={type} />
    {!parsed.success && <p className="notice" role="status">{Object.keys(params).length ? "Use a title of 2–100 characters, choose Movies or TV series, and a page from 1–20. Each search field must appear only once." : "Search for a movie or TV series by its title."}</p>}
    {failed && <CatalogNotice retry={href(parsed.success ? parsed.data.page : 1)} />}
    {result && <section aria-labelledby="search-results"><h2 id="search-results">{type === "movie" ? "Movies" : "TV series"} matching “{parsed.success ? parsed.data.q : query}”</h2><p className="muted small" role="status">Page {result.page}{result.totalPages ? ` of ${result.totalPages}` : ""}</p><TitleGrid titles={result.titles} />
      <nav className="pagination" aria-label="Search result pages">{result.page > 1 && <Link className="button secondary" href={href(result.page - 1)} prefetch={false}>← Previous</Link>}{result.page < result.totalPages && <Link className="button secondary" href={href(result.page + 1)} prefetch={false}>Next →</Link>}</nav>
    </section>}
  </section>;
}
