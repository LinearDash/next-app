import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { entrySchema, dismissalSchema } from "@/lib/library-input";
import { catalogLabels, entryColumns } from "@/lib/library";
import { discover, genres, popular } from "@/lib/tmdb";
import { buildTaste, key, recommend, topGenres, type Pick } from "@/lib/recommend";
import type { MediaType } from "@/lib/catalog";
import { statuses } from "@/lib/taste";
import { Poster } from "@/components/poster";
import { DismissControl } from "@/components/personal-controls";
import { CatalogNotice } from "@/components/catalog";

export const metadata = { title: "For you", robots: { index: false, follow: false } };
// ponytail: genres come from live detail lookups of recent ratings; store genre IDs on entries if libraries grow large.
const RATED_SAMPLE = 24;

async function candidates(type: MediaType, top: number[]) {
  const [matched, fallback] = await Promise.all([
    top.length ? discover(type, { genreIds: top }).catch(() => null) : null,
    popular(type).catch(() => null),
  ]);
  if (!matched && !fallback) throw new Error("Catalog unavailable");
  return [...(matched?.titles ?? []), ...(fallback?.titles ?? [])];
}

export default async function ForYou() {
  const { client, user } = await requireAccount();
  const [profile, rated] = await Promise.all([
    client.from("profiles").select("genre_preferences").eq("owner", user.id).single(),
    client
      .from("library_entries")
      .select(entryColumns)
      .eq("owner", user.id)
      .not("reaction", "is", null)
      .order("updated_at", { ascending: false })
      .order("media_type")
      .order("tmdb_id")
      .limit(RATED_SAMPLE),
  ]);
  if (profile.error || rated.error) throw new Error("Recommendations unavailable");
  const preferred = z
    .object({ genre_preferences: z.array(z.number().int().positive()).max(30) })
    .parse(profile.data).genre_preferences;
  const ratedEntries = z.array(entrySchema).max(RATED_SAMPLE).parse(rated.data);
  const [labelled, genreList] = await Promise.all([
    catalogLabels(ratedEntries),
    genres().catch(() => []),
  ]);
  const known = labelled.filter((row) => row.title && row.reaction);
  const taste = buildTaste(
    known.map((row) => ({ genreIds: row.title!.genreIds, reaction: row.reaction! })),
    preferred,
  );
  const top = topGenres(taste);

  const types = ["movie", "tv"] as const;
  const lists = await Promise.allSettled(types.map((type) => candidates(type, top)));
  const ids = [
    ...new Set(
      lists.flatMap((list) =>
        list.status === "fulfilled" ? list.value.map((title) => title.id) : [],
      ),
    ),
  ];
  const empty = { data: [], error: null };
  const [saved, dismissed] = ids.length
    ? await Promise.all([
        client
          .from("library_entries")
          .select("tmdb_id,media_type,status")
          .eq("owner", user.id)
          .in("tmdb_id", ids),
        client
          .from("dismissals")
          .select("tmdb_id,media_type")
          .eq("owner", user.id)
          .in("tmdb_id", ids),
      ])
    : [empty, empty];
  if (saved.error || dismissed.error) throw new Error("Recommendations unavailable");
  const savedRows = z
    .array(dismissalSchema.extend({ status: z.enum(statuses) }))
    .max(ids.length * 2)
    .parse(saved.data);
  const excluded = new Set([
    ...z
      .array(dismissalSchema)
      .max(ids.length * 2)
      .parse(dismissed.data)
      .map(key),
    ...savedRows.filter((row) => row.status !== "want_to_watch").map(key),
  ]);
  const watchlist = new Set(savedRows.filter((row) => row.status === "want_to_watch").map(key));
  const names = new Map(genreList.map((genre) => [genre.id, genre.name]));
  const picks = lists.map((list) =>
    list.status === "fulfilled" ? recommend(list.value, taste, excluded, watchlist, names) : null,
  );

  return (
    <section className="catalog-page">
      <p className="eyebrow">PICKED FROM YOUR OWN TASTE</p>
      <h1>
        For <em>you.</em>
      </h1>
      <p className="intro">
        Suggestions come from a simple match between title genres and your reactions and chosen
        genres. They are not a prediction of how much you’ll enjoy something.
      </p>
      {!top.length ? (
        <p className="notice" role="status">
          There isn’t enough rating history yet, so these are popular titles.{" "}
          <Link className="text-link" href="/onboarding">
            Rate a few titles or choose genres →
          </Link>
        </p>
      ) : (
        !known.length && (
          <p className="notice" role="status">
            Based on the genres you chose. Rate titles you’ve seen to refine these suggestions.
          </p>
        )
      )}
      {ratedEntries.length === RATED_SAMPLE && (
        <p className="muted small">Using your {RATED_SAMPLE} most recently updated ratings.</p>
      )}
      {known.length < ratedEntries.length && (
        <p className="muted small">
          Some rated titles couldn’t be loaded from the catalog and were left out this time.
        </p>
      )}
      <div className="library-links">
        <Link href="/library">Your library</Link>
        <Link href="/library?view=dismissed">Not interested</Link>
        <Link href="/onboarding">Taste preferences</Link>
        <Link href="/ai/find">Find me a movie with Gemini</Link>
      </div>
      {types.map((type, index) => (
        <section className="catalog-section" key={type} aria-labelledby={`for-you-${type}`}>
          <h2 id={`for-you-${type}`}>
            {type === "movie" ? "Movies for you" : "TV series for you"}
          </h2>
          {picks[index] ? <PickList picks={picks[index]} /> : <CatalogNotice retry="/for-you" />}
        </section>
      ))}
    </section>
  );
}

function PickList({ picks }: { picks: Pick[] }) {
  if (!picks.length)
    return (
      <p className="notice" role="status">
        Nothing new to suggest right now. Titles you’ve watched, are watching, dropped or marked not
        interested are left out.
      </p>
    );
  return (
    <div className="library-list">
      {picks.map(({ title, reason, onWatchlist }) => (
        <article className="library-card" key={key(title)}>
          <div className="library-summary">
            <Poster path={title.posterPath} title={title.title} />
            <div>
              <h3>
                <Link href={`/title/${title.mediaType}/${title.id}`} prefetch={false}>
                  {title.title}
                </Link>
              </h3>
              <p className="muted small">
                {title.mediaType === "movie" ? "Movie" : "TV series"} ·{" "}
                {title.date.slice(0, 4) || "Date unknown"}
              </p>
              <p>{reason}</p>
              {onWatchlist && <span className="pill">On your watchlist</span>}
            </div>
          </div>
          <DismissControl mediaType={title.mediaType} id={title.id} dismissed={false} />
        </article>
      ))}
    </div>
  );
}
