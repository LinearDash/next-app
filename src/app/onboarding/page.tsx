import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { genres, popular } from "@/lib/tmdb";
import { entrySchema } from "@/lib/library-input";
import { entryColumns } from "@/lib/library";
import { PreferencesForm, PersonalControls } from "@/components/personal-controls";

export const metadata = { title: "Your taste", robots: { index: false, follow: false } };

export default async function Onboarding() {
  const { client, user } = await requireAccount();
  const [profile, rated, choices, movies] = await Promise.all([
    client.from("profiles").select("genre_preferences").eq("owner", user.id).single(),
    client
      .from("library_entries")
      .select("tmdb_id", { count: "exact", head: true })
      .eq("owner", user.id)
      .not("reaction", "is", null),
    genres().catch(() => []),
    popular("movie").catch(() => null),
  ]);
  const ids = movies?.titles.slice(0, 5).map((title) => title.id) || [];
  const saved = ids.length
    ? await client
        .from("library_entries")
        .select(entryColumns)
        .eq("owner", user.id)
        .eq("media_type", "movie")
        .in("tmdb_id", ids)
    : { data: [], error: null };
  if (profile.error || rated.error || saved.error) throw new Error("Taste preferences unavailable");
  const selected = z
    .object({ genre_preferences: z.array(z.number().int().positive()).max(30) })
    .parse(profile.data).genre_preferences;
  const entries = z.array(entrySchema).parse(saved.data);
  return (
    <section className="catalog-page">
      <p className="eyebrow">OPTIONAL / MAKE IT YOURS</p>
      <h1>
        Start with <em>what you love.</em>
      </h1>
      <p className="intro">
        Choose a few genres and rate roughly five titles. Skip anything; you can always return
        later.
      </p>
      <PreferencesForm genres={choices} selected={selected} />
      <section className="onboarding-titles">
        <h2>A few titles to get you started</h2>
        <p className="muted" role="status">
          You’ve rated {rated.count || 0} titles. Five is a starting point, never a requirement.
        </p>
        <Link className="text-link" href="/discover">
          Search for something you know →
        </Link>
        {movies?.titles.slice(0, 5).map((title) => (
          <article key={title.id} className="library-card">
            <h3>
              <Link href={`/title/movie/${title.id}`}>{title.title}</Link>
            </h3>
            <PersonalControls
              mediaType="movie"
              id={title.id}
              entry={entries.find((entry) => entry.tmdb_id === title.id) || null}
            />
          </article>
        ))}
        {!movies && (
          <p className="notice">
            Suggested titles are temporarily unavailable. Your saved ratings are kept.
          </p>
        )}
      </section>
    </section>
  );
}
