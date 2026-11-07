import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { CatalogNotice } from "@/components/catalog";
import { Poster } from "@/components/poster";
import { Skeleton } from "@/components/ui/skeleton";
import { detail } from "@/lib/tmdb";

import { PersonalPanel } from "./_components/personal-panel";

export const metadata = { title: "Title details" };

export default async function Title({
  params,
}: {
  params: Promise<{ mediaType: string; id: string }>;
}) {
  await connection();
  const { mediaType, id } = await params;
  let title;
  try {
    title = await detail(mediaType, id);
  } catch {
    return (
      <section className="catalog-page">
        <Link className="text-link" href="/discover">
          ← Discover
        </Link>
        <CatalogNotice
          retry={`/title/${encodeURIComponent(mediaType)}/${encodeURIComponent(id)}`}
        />
      </section>
    );
  }
  if (!title) notFound();
  return (
    <section className="catalog-page title-page">
      <Link className="title-breadcrumb" href="/discover">
        ← Discover
      </Link>
      <article className="title-detail">
        <div className="title-poster">
          <Poster path={title.posterPath} title={title.title} />
        </div>
        <div className="title-content">
          <p className="eyebrow">{title.mediaType === "movie" ? "MOVIE" : "TV SERIES"}</p>
          <h1>{title.title}</h1>
          <dl className="title-facts">
            <div>
              <dt className="sr-only">
                {title.mediaType === "movie" ? "Release date" : "First aired"}
              </dt>
              <dd>{title.date || "Date unknown"}</dd>
            </div>
            <div>
              <dt className="sr-only">Original language</dt>
              <dd>{title.language || "Language unknown"}</dd>
            </div>
            {title.mediaType === "movie" ? (
              <div>
                <dt className="sr-only">Runtime</dt>
                <dd>{title.runtime ? `${title.runtime} min` : "Runtime unknown"}</dd>
              </div>
            ) : (
              <div>
                <dt className="sr-only">Seasons</dt>
                <dd>{title.seasons == null ? "Seasons unknown" : `${title.seasons} seasons`}</dd>
              </div>
            )}
          </dl>
          <ul className="title-genres" aria-label="Genres">
            {title.genres.length ? (
              title.genres.map((genre) => <li key={genre}>{genre}</li>)
            ) : (
              <li>Genres unavailable</li>
            )}
          </ul>
          <section className="title-overview-block" aria-labelledby="title-overview-heading">
            <h2 id="title-overview-heading">Overview</h2>
            <p className="title-overview">{title.overview || "No overview available yet."}</p>
          </section>
          <div className="title-community" aria-label="TMDB community score">
            <span className="title-community-label">TMDB COMMUNITY</span>
            <strong>{title.voteCount ? title.communityScore.toFixed(1) : "—"}</strong>
            <span>{title.voteCount ? "/ 10" : "No score yet"}</span>
            {title.voteCount > 0 && (
              <span className="title-vote-count">
                · {title.voteCount.toLocaleString("en-US")} votes
              </span>
            )}
            <span className="sr-only">
              This is the community score, not your personal reaction.
            </span>
          </div>
          <a
            className="title-source"
            href={`https://www.themoviedb.org/${title.mediaType}/${title.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on TMDB ↗
          </a>
        </div>
        <Suspense
          fallback={
            <aside className="title-personal-panel title-panel-loading" role="status">
              <span className="sr-only">Loading your library…</span>
              <Skeleton className="h-8 w-40" />
              <Skeleton className="mt-5 h-12 w-full" />
              <Skeleton className="mt-3 h-12 w-full" />
              <Skeleton className="mt-5 h-24 w-full" />
              <Skeleton className="mt-5 h-12 w-full" />
            </aside>
          }
        >
          <PersonalPanel mediaType={title.mediaType} id={title.id} />
        </Suspense>
      </article>
    </section>
  );
}
