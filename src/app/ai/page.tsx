import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { parseSaved, savedRowSchema, verdictLabels } from "@/lib/ai-contract";
import { deleteResults } from "./actions";

export const metadata = { title: "AI results", robots: { index: false, follow: false } };

export default async function AiResults({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { client, user } = await requireAccount();
  const rows = await client.from("ai_results").select("id,action,created_at,model,prompt_version,result").eq("owner", user.id)
    .order("created_at", { ascending: false }).limit(50);
  if (rows.error) throw new Error("AI results unavailable");
  const results = z.array(savedRowSchema).max(50).parse(rows.data);
  const deleted = (await searchParams).deleted === "1";
  return <section className="catalog-page"><p className="eyebrow">SAVED, PRIVATE, YOURS</p><h1>AI <em>results.</em></h1>
    <p className="intro">Saved Gemini verdicts and picks. Reopening a result never calls Gemini again.</p>
    <div className="library-links"><Link href="/ai/find">Find me a movie</Link><Link href="/settings#ai">AI settings</Link></div>
    {deleted && <p className="action-success" role="status">Deleted.</p>}
    {!results.length && <p className="notice" role="status">No saved AI results yet. Ask for a verdict on any title, or use the finder.</p>}
    <ul className="ai-results">{results.map(row => {
      const saved = parseSaved(row);
      const label = !saved ? "This result can’t be displayed" : saved.kind === "verdict" ? `${verdictLabels[saved.verdict]} · ${saved.subject.title}`
        : `Picks: ${saved.picks.map(pick => pick.title).join(", ")}`;
      return <li key={row.id} className="library-card"><h3>{saved ? <Link href={`/ai/${row.id}`}>{label}</Link> : label}</h3>
        <p className="muted small">{row.action === "verdict" ? "Verdict" : "Finder"} · {new Date(row.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC · {row.model}</p>
        <form action={deleteResults}><input type="hidden" name="id" value={row.id} /><button className="button secondary">Delete</button></form>
      </li>;
    })}</ul>
    {results.length > 0 && <details className="danger-zone"><summary>Delete all saved AI results</summary>
      <form action={deleteResults}><input type="hidden" name="scope" value="all" /><p className="small muted">This can’t be undone. Your library and ratings are kept.</p><button className="button secondary">Delete all results</button></form></details>}
  </section>;
}
