import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { genres } from "@/lib/tmdb";
import { parseSaved, savedRowSchema, TASTE_BUDGET, verdictLabels } from "@/lib/ai-contract";
import { Poster } from "@/components/poster";
import { FinderForm, VerdictForm } from "@/components/ai-controls";
import { VerdictCard } from "@/components/verdict-card";
import { verdictById } from "@/lib/ai";
import { deleteResults } from "../actions";

export const metadata = { title: "AI result", robots: { index: false, follow: false } };

export default async function AiResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { client, user } = await requireAccount();
  const row = await client.from("ai_results").select("id,action,created_at,model,prompt_version,result").eq("owner", user.id).eq("id", id).maybeSingle();
  if (row.error) throw new Error("AI result unavailable");
  if (!row.data) notFound();
  const meta = savedRowSchema.parse(row.data);
  const saved = parseSaved(meta);
  const footer = <p className="muted small">Gemini opinion, not fact · {meta.model} · prompt {meta.prompt_version} · {new Date(meta.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC.
    {saved?.subset && ` Based on your ${TASTE_BUDGET} most recently updated ratings.`} Instructed to be spoiler-free; that can’t be guaranteed.</p>;
  const remove = <form action={deleteResults}><input type="hidden" name="id" value={meta.id} /><button className="button secondary">Delete this result</button></form>;
  if (!saved) return <section className="catalog-page"><h1>AI <em>result.</em></h1><p className="notice">This saved result can’t be displayed.</p>{remove}</section>;
  const sparse = saved.ratedCount === 0 && <p className="notice" role="status">There isn’t enough personal rating history yet, so this used only your chosen genres (if any). Rate titles to improve it.</p>;

  const view = saved.kind === "verdict" ? await verdictById({ client, user }, meta.id) : null;
  if (saved.kind === "verdict") return <section className="catalog-page"><Link className="text-link" href="/ai">← AI results</Link>
    <p className="eyebrow">VERDICT</p><h1>{verdictLabels[saved.verdict]}</h1>
    <div className="library-summary"><Poster path={saved.subject.posterPath} title={saved.subject.title} /><div><h2><Link href={`/title/${saved.subject.mediaType}/${saved.subject.id}`}>{saved.subject.title}</Link></h2>
      <p className="muted small">{saved.subject.mediaType === "movie" ? "Movie" : "TV series"} · {saved.subject.year || "Date unknown"}</p></div></div>
    {view ? <VerdictCard view={view} /> : <>{sparse}<p className="title-overview">{saved.summary}</p>{footer}</>}
    <VerdictForm mediaType={saved.subject.mediaType} id={saved.subject.id} requestKey={randomUUID()} budget={TASTE_BUDGET} label="Regenerate verdict (new Gemini request)" />
    {remove}
  </section>;

  const genreList = await genres().catch(() => []);
  const exclude = [...saved.request.exclude, ...saved.picks.map(pick => pick.id)].slice(-30);
  return <section className="catalog-page"><Link className="text-link" href="/ai">← AI results</Link>
    <p className="eyebrow">PICKED BY GEMINI FROM REAL CATALOG TITLES</p><h1>Your <em>picks.</em></h1>{sparse}
    {saved.request.mood && <p className="muted">Mood: “{saved.request.mood}”</p>}
    <div className="library-list">{saved.picks.map(pick => <article className="library-card" key={pick.id}><div className="library-summary">
      <Poster path={pick.posterPath} title={pick.title} /><div><h3><Link href={`/title/${pick.mediaType}/${pick.id}`}>{pick.title}</Link></h3>
        <p className="muted small">{pick.mediaType === "movie" ? "Movie" : "TV series"} · {pick.year || "Date unknown"}</p><p>{pick.reason}</p></div></div></article>)}</div>
    {footer}
    <details className="danger-zone"><summary>Show different picks</summary>
      <FinderForm genres={genreList} requestKey={randomUUID()} budget={TASTE_BUDGET} label="Show different picks (new Gemini request)" defaults={{ ...saved.request, exclude }} /></details>
    {remove}
  </section>;
}
