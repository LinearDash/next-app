import Link from "next/link";
import type { CatalogTitle } from "@/lib/catalog";
import { Poster } from "./poster";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

// badges: show MOVIE / TV on each poster (used when results mix both).
export function TitleGrid({
  titles,
  badges = false,
}: {
  titles: CatalogTitle[];
  badges?: boolean;
}) {
  if (!titles.length)
    return (
      <p className="notice" role="status">
        No titles found. Try another search.
      </p>
    );
  return (
    <ul className="title-grid">
      {titles.map((title) => (
        <li key={`${title.mediaType}-${title.id}`}>
          <Link
            href={`/title/${title.mediaType}/${title.id}`}
            prefetch={false}
            className="title-card"
          >
            <span className="title-poster">
              <Poster path={title.posterPath} title={title.title} />
              {badges && (
                <span className="poster-badge">{title.mediaType === "movie" ? "Movie" : "TV"}</span>
              )}
            </span>
            <h3>{title.title}</h3>
            <p className="muted">
              {title.mediaType === "movie" ? "Movie" : "TV series"} ·{" "}
              {title.date.slice(0, 4) || "Date unknown"}
            </p>
            <p className="community">
              {title.voteCount
                ? `TMDB community ${title.communityScore.toFixed(1)}`
                : "No community score yet"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const searchScopes = [
  ["all", "All"],
  ["movie", "Movies"],
  ["tv", "TV series"],
] as const;

export function SearchForm({ query = "", type = "all" }: { query?: string; type?: string }) {
  return (
    <form action="/search" method="get" className="catalog-search" role="search">
      <div>
        <label htmlFor="catalog-query">Title</label>
        <input
          id="catalog-query"
          name="q"
          type="search"
          defaultValue={query}
          minLength={2}
          maxLength={100}
          placeholder="Search movies and TV…"
          required
        />
      </div>
      <fieldset className="segmented">
        <legend>Search in</legend>
        <div>
          {searchScopes.map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="type" value={value} defaultChecked={type === value} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="button primary" type="submit">
        Search
      </button>
    </form>
  );
}

export function CatalogNotice({ retry }: { retry: string }) {
  return (
    <Alert className="catalog-error">
      <AlertTitle>The catalog is taking an intermission.</AlertTitle>
      <AlertDescription>
        <p>We couldn’t load these titles right now. Please try again in a moment.</p>
        <a className="text-link" href={retry}>
          Try again →
        </a>
      </AlertDescription>
    </Alert>
  );
}
