import Link from "next/link";
import type { CatalogTitle } from "@/lib/catalog";
import { Poster } from "./poster";

export function TitleGrid({ titles }: { titles: CatalogTitle[] }) {
  if (!titles.length) return <p className="notice" role="status">No titles found. Try another search.</p>;
  return <ul className="title-grid">{titles.map(title => <li key={`${title.mediaType}-${title.id}`}>
    <Link href={`/title/${title.mediaType}/${title.id}`} prefetch={false} className="title-card">
      <Poster path={title.posterPath} title={title.title} />
      <h3>{title.title}</h3><p className="muted">{title.mediaType === "movie" ? "Movie" : "TV series"} · {title.date.slice(0, 4) || "Date unknown"}</p>
      <p className="community">{title.voteCount ? `TMDB community: ${title.communityScore.toFixed(1)}/10` : "No community score yet"}</p>
    </Link>
  </li>)}</ul>;
}

export function SearchForm({ query = "", type = "movie" }: { query?: string; type?: string }) {
  return <form action="/search" method="get" className="catalog-search" role="search">
    <div><label htmlFor="catalog-query">Title</label><input id="catalog-query" name="q" type="search" defaultValue={query} minLength={2} maxLength={100} placeholder="Search movies and TV…" required /></div>
    <div><label htmlFor="catalog-type">Search in</label><select id="catalog-type" name="type" defaultValue={type}><option value="movie">Movies</option><option value="tv">TV series</option></select></div>
    <button className="button primary" type="submit">Search</button>
  </form>;
}

export function CatalogNotice({ retry }: { retry: string }) {
  return <div className="notice" role="status"><h2>The catalog is taking an intermission.</h2><p>We couldn’t load these titles right now. Please try again in a moment.</p><a className="text-link" href={retry}>Try again →</a></div>;
}
