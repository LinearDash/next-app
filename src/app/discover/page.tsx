import { connection } from "next/server";
import Link from "next/link";
import { popular, trending } from "@/lib/tmdb";
import { TitleGrid, SearchForm, CatalogNotice } from "@/components/catalog";

export const metadata = { title: "Discover" };

type DiscoverProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type TrendWindow = "day" | "week";

function pageNumber(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d?$/.test(value)) return 1;
  const page = Number(value);
  return page <= 20 ? page : 1;
}

function PageControls({
  media,
  page,
  totalPages,
  otherPage,
  window,
}: {
  media: "movie" | "tv";
  page: number;
  totalPages: number;
  otherPage: number;
  window: TrendWindow;
}) {
  const param = media === "movie" ? "movies" : "tv";
  const otherParam = media === "movie" ? "tv" : "movies";
  const sectionId = media === "movie" ? "popular-movies" : "popular-tv";
  const href = (target: number) =>
    `/discover?${new URLSearchParams({ trend: window, [param]: String(target), [otherParam]: String(otherPage) })}#${sectionId}`;
  return (
    <nav
      className="pagination"
      aria-label={`${media === "movie" ? "Popular movie" : "Popular TV"} pages`}
    >
      <span>
        Page {page}
        {totalPages ? ` of ${totalPages}` : ""}
      </span>
      {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
      {page < totalPages && <Link href={href(page + 1)}>Next page →</Link>}
    </nav>
  );
}

export default async function Discover({ searchParams }: DiscoverProps) {
  await connection();
  const params = await searchParams;
  const moviePage = pageNumber(params.movies);
  const tvPage = pageNumber(params.tv);
  const window: TrendWindow = params.trend === "week" ? "week" : "day";
  const [trendingTitles, movies, tv] = await Promise.allSettled([
    trending(window),
    popular("movie", moviePage),
    popular("tv", tvPage),
  ]);
  const trendHref = (value: TrendWindow) =>
    `/discover?${new URLSearchParams({ trend: value, movies: String(moviePage), tv: String(tvPage) })}#trending-today`;
  return (
    <section className="catalog-page">
      <p className="eyebrow">FIND YOUR NEXT GOOD WATCH</p>
      <h1>
        Discover <em>something good.</em>
      </h1>
      <p className="intro">
        Find what’s trending today, or browse popular movies and shows. No sign-in needed.
      </p>
      <SearchForm />
      <section className="catalog-section" aria-labelledby="trending-today">
        <div className="catalog-heading">
          <h2 id="trending-today">Trending {window === "day" ? "today" : "this week"}</h2>
          <nav className="discover-tabs" aria-label="Trending time period">
            <Link href={trendHref("day")} aria-current={window === "day" ? "page" : undefined}>
              Today
            </Link>
            <Link href={trendHref("week")} aria-current={window === "week" ? "page" : undefined}>
              This week
            </Link>
          </nav>
        </div>
        {trendingTitles.status === "fulfilled" ? (
          <TitleGrid titles={trendingTitles.value.titles} badges />
        ) : (
          <CatalogNotice retry={trendHref(window)} />
        )}
      </section>
      <section className="catalog-section" aria-labelledby="popular-movies">
        <h2 id="popular-movies">Popular movies</h2>
        {movies.status === "fulfilled" ? (
          <>
            <TitleGrid titles={movies.value.titles} />
            <PageControls
              media="movie"
              page={moviePage}
              totalPages={movies.value.totalPages}
              otherPage={tvPage}
              window={window}
            />
          </>
        ) : (
          <CatalogNotice retry={trendHref(window)} />
        )}
      </section>
      <section className="catalog-section" aria-labelledby="popular-tv">
        <h2 id="popular-tv">Popular TV series</h2>
        {tv.status === "fulfilled" ? (
          <>
            <TitleGrid titles={tv.value.titles} />
            <PageControls
              media="tv"
              page={tvPage}
              totalPages={tv.value.totalPages}
              otherPage={moviePage}
              window={window}
            />
          </>
        ) : (
          <CatalogNotice retry={trendHref(window)} />
        )}
      </section>
    </section>
  );
}
