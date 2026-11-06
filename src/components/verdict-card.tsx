import Link from "next/link";
import { verdictLabels } from "@/lib/taste";

// Display data only (validated and formatted on the server); shared by the title page and /ai/<id>.
export type VerdictView = {
  id: string;
  verdict: keyof typeof verdictLabels;
  summary: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  when: string;
  model: string;
  promptVersion: string;
  subset: boolean;
  ratedCount: number;
  budget: number;
};

export function VerdictCard({ view }: { view: VerdictView }) {
  return (
    <article className="verdict-card" aria-labelledby={`verdict-${view.id}`}>
      <p className="eyebrow">GEMINI VERDICT</p>
      <h3 id={`verdict-${view.id}`} tabIndex={-1}>
        {verdictLabels[view.verdict]}
      </h3>
      {view.ratedCount === 0 && (
        <p className="notice small">
          There isn’t enough personal rating history yet, so this used only your chosen genres (if
          any). Rate titles to improve it.
        </p>
      )}
      <p>{view.summary}</p>
      {(view.reasonsFor.length > 0 || view.reasonsAgainst.length > 0) && (
        <div className="verdict-reasons">
          {view.reasonsFor.length > 0 && (
            <div>
              <h4>Why you might like it</h4>
              <ul>
                {view.reasonsFor.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {view.reasonsAgainst.length > 0 && (
            <div>
              <h4>Why you might not</h4>
              <ul>
                {view.reasonsAgainst.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="muted small">
        Gemini opinion, not fact · {view.model} · prompt {view.promptVersion} · {view.when}.
        {view.subset && ` Based on your ${view.budget} most recently updated ratings.`} Instructed
        to be spoiler-free; that can’t be guaranteed.{" "}
        <Link className="text-link" href={`/ai/${view.id}`}>
          Saved to your AI results →
        </Link>
      </p>
    </article>
  );
}
