import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { libraryFiltersSchema, entrySchema, dismissalSchema } from "@/lib/library-input";
import { catalogLabels, entryColumns } from "@/lib/library";
import { statuses, statusLabels, reactionLabels } from "@/lib/taste";
import { Poster } from "@/components/poster";
import { PersonalControls, DismissControl } from "@/components/personal-controls";

export const metadata = { title: "Your library", robots: { index: false, follow: false } };
const PAGE_SIZE = 12;

export default async function Library({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { client, user } = await requireAccount();
  const raw = await searchParams;
  const parsed = libraryFiltersSchema.safeParse({ view: raw.view, type: raw.type, status: raw.status, reaction: raw.reaction, page: raw.page });
  if (!parsed.success) return <section className="catalog-page"><h1>Your <em>library.</em></h1><p className="notice" role="alert">These filters aren’t valid.</p><Link href="/library" className="button secondary">Reset filters</Link></section>;
  const filters = parsed.data;
  const dismissed = filters.view === "dismissed";
  let query = client.from(dismissed ? "dismissals" : "library_entries").select(dismissed ? "tmdb_id,media_type" : entryColumns, { count: "exact" }).eq("owner", user.id);
  if (filters.type !== "all") query = query.eq("media_type", filters.type);
  if (!dismissed) {
    if (filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.reaction === "unrated") query = query.is("reaction", null);
    else if (filters.reaction !== "all") query = query.eq("reaction", Number(filters.reaction));
  }
  const start = (filters.page - 1) * PAGE_SIZE;
  const result = await query.order(dismissed ? "created_at" : "updated_at", { ascending: false }).order("media_type").order("tmdb_id").range(start, start + PAGE_SIZE - 1);
  if (result.error) throw new Error("Library unavailable");
  const entries = dismissed ? [] : z.array(entrySchema).max(PAGE_SIZE).parse(result.data);
  const dismissals = dismissed ? z.array(dismissalSchema).max(PAGE_SIZE).parse(result.data) : [];
  const labels = await catalogLabels(dismissed ? dismissals : entries);
  const pageHref = (page: number) => `/library?${new URLSearchParams({ ...filters, page: String(page) })}`;
  return <section className="catalog-page"><p className="eyebrow">YOUR TASTE, YOUR SHELF</p><h1>Your <em>library.</em></h1>
    <div className="library-links"><Link href="/library">Saved titles</Link><Link href="/library?view=dismissed">Not interested</Link><Link href="/onboarding">Taste preferences</Link><Link href="/for-you">For you</Link><Link href="/discover">Find titles →</Link></div>
    <form method="get" action="/library" className="catalog-search library-filters"><input type="hidden" name="view" value={filters.view} />
      <div><label htmlFor="library-type">Media</label><select id="library-type" name="type" defaultValue={filters.type}><option value="all">Movies &amp; TV</option><option value="movie">Movies</option><option value="tv">TV series</option></select></div>
      {!dismissed && <><div><label htmlFor="library-status">Status</label><select id="library-status" name="status" defaultValue={filters.status}><option value="all">Any status</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div><div><label htmlFor="library-reaction">Reaction</label><select id="library-reaction" name="reaction" defaultValue={filters.reaction}><option value="all">Any reaction</option><option value="unrated">Not rated</option>{reactionLabels.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></div></>}
      <button className="button secondary">Apply filters</button>
    </form>
    <h2>{dismissed ? "Not interested" : "Saved titles"}</h2><p className="muted small" role="status">{result.count ?? 0} titles · Page {filters.page}</p>
    {!labels.length && <p className="notice">{dismissed ? "You haven’t dismissed any matching titles." : "No saved titles match these filters. Find a title and save it to start your library."}</p>}
    <div className="library-list">{labels.map(row => {
      const saved = entries.find(entry => entry.media_type === row.media_type && entry.tmdb_id === row.tmdb_id);
      return <article className="library-card" key={`${row.media_type}-${row.tmdb_id}`}><div className="library-summary"><Poster path={row.title?.posterPath ?? null} title={row.title?.title || "Saved title"} /><div><h3><Link href={`/title/${row.media_type}/${row.tmdb_id}`} prefetch={false}>{row.title?.title || `${row.media_type === "movie" ? "Movie" : "TV series"} #${row.tmdb_id}`}</Link></h3><p className="muted small">{row.media_type === "movie" ? "Movie" : "TV series"}{!row.title && " · Catalog details temporarily unavailable"}</p>{saved && <p>{statusLabels[saved.status]} · {saved.reaction ? reactionLabels[saved.reaction - 1] : "Not rated"}</p>}</div></div>
        {saved ? <PersonalControls mediaType={row.media_type} id={row.tmdb_id} entry={saved} /> : <DismissControl mediaType={row.media_type} id={row.tmdb_id} dismissed />}
      </article>;
    })}</div>
    <nav className="pagination" aria-label="Library pages">{filters.page > 1 && <Link className="button secondary" href={pageHref(filters.page - 1)} prefetch={false}>← Previous</Link>}{start + PAGE_SIZE < (result.count || 0) && filters.page < 10000 && <Link className="button secondary" href={pageHref(filters.page + 1)} prefetch={false}>Next →</Link>}</nav>
  </section>;
}
