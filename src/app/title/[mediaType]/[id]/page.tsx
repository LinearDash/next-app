import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { detail } from "@/lib/tmdb";
import { CatalogNotice } from "@/components/catalog";
import { Suspense } from "react";
import { PersonalPanel } from "./_components/personal-panel";
import { Poster } from "@/components/poster";

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
    <section className="catalog-page">
      <Link className="text-link" href="/discover">
        ← Discover
      </Link>
      <article className="title-detail">
        <Poster path={title.posterPath} title={title.title} />
        <div>
          <p className="eyebrow">{title.mediaType === "movie" ? "MOVIE" : "TV SERIES"}</p>
          <h1>{title.title}</h1>
          <dl className="title-facts">
            <div>
              <dt>{title.mediaType === "movie" ? "Release date" : "First aired"}</dt>
              <dd>{title.date || "Unknown"}</dd>
            </div>
            <div>
              <dt>Original language</dt>
              <dd>{title.language || "Unknown"}</dd>
            </div>
            {title.mediaType === "movie" ? (
              <div>
                <dt>Runtime</dt>
                <dd>{title.runtime ? `${title.runtime} minutes` : "Unknown"}</dd>
              </div>
            ) : (
              <div>
                <dt>Seasons</dt>
                <dd>{title.seasons ?? "Unknown"}</dd>
              </div>
            )}
          </dl>
          <p>{title.genres.join(" · ") || "Genres unavailable"}</p>
          <h2>Overview</h2>
          <p className="title-overview">{title.overview || "No overview available yet."}</p>
          <div className="community-detail">
            <h2>TMDB community score</h2>
            <p>
              {title.voteCount
                ? `${title.communityScore.toFixed(1)}/10 · ${title.voteCount.toLocaleString("en-US")} votes`
                : "No community score yet."}
            </p>
            <p className="muted small">
              This is the TMDB community’s score, not your personal reaction.
            </p>
          </div>
          <Suspense fallback={<p role="status">Loading your library…</p>}>
            <PersonalPanel mediaType={title.mediaType} id={title.id} />
          </Suspense>
          <a
            className="text-link"
            href={`https://www.themoviedb.org/${title.mediaType}/${title.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on TMDB ↗
          </a>
        </div>
      </article>
    </section>
  );
}
