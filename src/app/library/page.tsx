import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { libraryFiltersSchema, entrySchema, dismissalSchema } from "@/lib/library-input";
import { catalogLabels, entryColumns } from "@/lib/library";
import { statuses, statusLabels, reactionLabels } from "@/lib/taste";
import { Poster } from "@/components/poster";
import { PersonalControls, DismissControl } from "@/components/personal-controls";
import { EditorFocus } from "@/components/editor-focus";

export const metadata = { title: "Your library", robots: { index: false, follow: false } };
const PAGE_SIZE = 20;
const badges = { want_to_watch: "Watchlist", watching: "Watching", watched: "Watched", dropped: "Dropped" };

export default async function Library({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { client, user } = await requireAccount();
  const raw = await searchParams;
  const parsed = libraryFiltersSchema.safeParse({ view: raw.view, type: raw.type, status: raw.status, reaction: raw.reaction, page: raw.page, edit: raw.edit });
  if (!parsed.success) return <section className="catalog-page"><h1>Your <em>library.</em></h1><p className="notice" role="alert">These filters aren’t valid.</p><Link href="/library" className="button secondary">Reset filters</Link></section>;
  const { edit, ...filters } = parsed.data;
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
  const libraryHref = (extra: Record<string, string>) => `/library?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, String(value)])), ...extra })}`;
  const rows = labels.map(row => {
    const id = `${row.media_type}-${row.tmdb_id}`;
    const saved = entries.find(entry => entry.media_type === row.media_type && entry.tmdb_id === row.tmdb_id);
    return { ...row, id, saved, name: row.title?.title || `${row.media_type === "movie" ? "Movie" : "TV series"} #${row.tmdb_id}`,
      badge: saved ? badges[saved.status] : "Not interested",
      note: saved ? (saved.reaction ? reactionLabels[saved.reaction - 1] : "Not rated") : row.media_type === "movie" ? "Movie" : "TV series" };
  });
  const selected = rows.find(row => row.id === edit);

  return <section className="catalog-page"><p className="eyebrow">YOUR TASTE, YOUR SHELF</p><h1>Your <em>library.</em></h1>
    <div className="library-links"><Link href="/library">Saved titles</Link><Link href="/library?view=dismissed">Not interested</Link><Link href="/onboarding">Taste preferences</Link><Link href="/for-you">For you</Link><Link href="/discover">Find titles →</Link></div>
    <form method="get" action="/library" className="catalog-search library-filters"><input type="hidden" name="view" value={filters.view} />
      <div><label htmlFor="library-type">Media</label><select id="library-type" name="type" defaultValue={filters.type}><option value="all">Movies &amp; TV</option><option value="movie">Movies</option><option value="tv">TV series</option></select></div>
      {!dismissed && <><div><label htmlFor="library-status">Status</label><select id="library-status" name="status" defaultValue={filters.status}><option value="all">Any status</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div><div><label htmlFor="library-reaction">Reaction</label><select id="library-reaction" name="reaction" defaultValue={filters.reaction}><option value="all">Any reaction</option><option value="unrated">Not rated</option>{reactionLabels.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></div></>}
      <button className="button secondary">Apply filters</button>
    </form>
    <h2>{dismissed ? "Not interested" : "Saved titles"}</h2><p className="muted small" role="status">{result.count ?? 0} titles · Page {filters.page}{rows.length > 0 && " · Select a poster to edit"}</p>
    {!rows.length && <p className="notice">{dismissed ? "You haven’t dismissed any matching titles." : "No saved titles match these filters. Find a title and save it to start your library."}</p>}
    {rows.length > 0 && <div className="library-layout">
      <ul className="shelf">{rows.map(row => <li key={row.id}>
        <Link href={`${libraryHref({ edit: row.id })}#editor`} prefetch={false} className="shelf-card" aria-current={row.id === edit ? "true" : undefined} aria-label={`Edit ${row.name}: ${row.badge}, ${row.note}`}>
          <span className="shelf-poster"><Poster path={row.title?.posterPath ?? null} title={row.name} /><span className="shelf-badge">{row.badge}</span></span>
          <span className="shelf-title">{row.name}</span>
          <span className={row.saved?.reaction ? "shelf-reaction" : "shelf-reaction muted"}>{row.note}</span>
        </Link>
      </li>)}</ul>
      <aside id="editor" className={selected ? "library-editor" : "library-editor empty"} aria-labelledby="editor-heading">
        {selected ? <>
          <EditorFocus id={selected.id} /><p className="eyebrow">EDITING</p><h2 id="editor-heading" tabIndex={-1}>{selected.name}</h2>
          <p className="muted small">{selected.media_type === "movie" ? "Movie" : "TV series"}{selected.title?.date ? ` · ${selected.title.date.slice(0, 4)}` : ""}{!selected.title && " · Catalog details temporarily unavailable"}</p>
          {/* key resets the form's local state when another title is selected */}
          {selected.saved ? <PersonalControls key={selected.id} compact mediaType={selected.media_type} id={selected.tmdb_id} entry={selected.saved} />
            : <DismissControl key={selected.id} mediaType={selected.media_type} id={selected.tmdb_id} dismissed />}
          <div className="editor-links"><Link className="text-link" href={`/title/${selected.media_type}/${selected.tmdb_id}`} prefetch={false}>Open title page →</Link><Link className="text-link" href={libraryHref({})} scroll={false}>Close</Link></div>
        </> : <><h2 id="editor-heading">Edit a title</h2><p className="muted small">Select a poster to change its status, reaction or tags.</p></>}
      </aside>
    </div>}
    <nav className="pagination" aria-label="Library pages">{filters.page > 1 && <Link className="button secondary" href={libraryHref({ page: String(filters.page - 1) })} prefetch={false}>← Previous</Link>}{start + PAGE_SIZE < (result.count || 0) && filters.page < 10000 && <Link className="button secondary" href={libraryHref({ page: String(filters.page + 1) })} prefetch={false}>Next →</Link>}</nav>
  </section>;
}
