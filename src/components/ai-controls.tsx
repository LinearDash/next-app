"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { askVerdict, changeConsent, deleteKey, findTitles, saveKey, type AiActionState } from "@/app/ai/actions";

const initial: AiActionState = { ok: false, message: "" };

function Message({ state }: { state: AiActionState }) {
  if (!state.message) return null;
  const fix = state.code === "consent_required" || state.code === "missing_key" || state.code === "provider_auth";
  return <p role={state.ok ? "status" : "alert"} className={state.ok ? "action-success" : "notice"}>{state.message}
    {fix && <> <Link className="text-link" href="/settings#ai">Open AI settings →</Link></>}</p>;
}

// Shown after an "oversized" answer: the user must explicitly agree to the disclosed subset.
function SubsetConsent({ state, budget }: { state: AiActionState; budget: number }) {
  if (state.code !== "oversized") return null;
  return <label className="consent-check"><input type="checkbox" name="subset" value="1" required />Send only my {budget} most recently updated ratings for this request</label>;
}

// allowSave=false (AI unavailable): only deletion is offered, but the form stays mounted so its result stays visible.
export function KeyForm({ keyHint, allowSave }: { keyHint: string | null; allowSave: boolean }) {
  const [state, action, pending] = useActionState(saveKey, initial);
  const [removed, remove, removing] = useActionState(deleteKey, initial);
  const uid = useId();
  return <div className="ai-form">
    <p>{keyHint ? <>A Gemini key ending in <strong>••••{keyHint}</strong> is saved.</> : "No Gemini key saved."}</p>
    {allowSave && <form action={action}><fieldset disabled={pending}>
      <label htmlFor={`${uid}-key`}>{keyHint ? "Replace Gemini API key" : "Gemini API key"}</label>
      <input id={`${uid}-key`} name="apiKey" type="password" autoComplete="off" spellCheck={false} required minLength={20} maxLength={200} />
      <p className="small muted">Stored encrypted. It’s used only for requests you make and can’t be viewed again. Usage is billed to your Google account.</p>
      <button className="button primary">{pending ? "Saving…" : keyHint ? "Replace key" : "Save key"}</button>
    </fieldset></form>}
    {keyHint && <form action={remove}><button className="button secondary" disabled={removing}>{removing ? "Deleting…" : "Delete key"}</button></form>}
    <Message state={state} /><Message state={removed} />
  </div>;
}

export function ConsentForm({ consented, allowAccept }: { consented: boolean; allowAccept: boolean }) {
  const [state, action, pending] = useActionState(changeConsent, initial);
  if (!consented && !allowAccept) return <div className="ai-form"><p>AI consent is off.</p><Message state={state} /></div>;
  if (consented) return <form action={action} className="ai-form"><p>You’ve agreed to the AI data-sharing notice.</p>
    <button className="button secondary" name="intent" value="withdraw" disabled={pending}>{pending ? "Updating…" : "Withdraw consent"}</button><Message state={state} /></form>;
  return <form action={action} className="ai-form"><fieldset disabled={pending}><legend>Before using AI features</legend>
    <ul className="disclosure">
      <li>AI features are optional and run only when you press a button.</li>
      <li>Each request sends Google Gemini your rated titles (title, movie/TV, your reaction), your chosen genres, and the request details. That can include the title you’re asking about, your filters and the mood you type. It never includes your name, email or account ID.</li>
      <li>Requests use your own Gemini API key, under Google’s Gemini API terms. Google’s data use depends on your key’s plan.</li>
      <li>Answers are AI opinions. They’re instructed to be spoiler-free, but that can’t be guaranteed.</li>
      <li>Results are saved privately to your account until you delete them.</li>
    </ul>
    <label className="consent-check"><input type="checkbox" name="adult" value="yes" required />I am 18 or older.</label>
    <label className="consent-check"><input type="checkbox" name="understood" value="yes" required />I understand what is shared and agree to send it to Google Gemini.</label>
    <button className="button primary" name="intent" value="accept">{pending ? "Saving…" : "Turn on AI features"}</button>
  </fieldset><Message state={state} /></form>;
}

export function VerdictForm({ mediaType, id, requestKey, budget, label = "Ask for a verdict" }: { mediaType: "movie" | "tv"; id: number; requestKey: string; budget: number; label?: string }) {
  const [state, action, pending] = useActionState(askVerdict, initial);
  return <form action={action} className="ai-form verdict-form" aria-label="Ask Gemini for a verdict">
    <input type="hidden" name="mediaType" value={mediaType} /><input type="hidden" name="id" value={id} />
    <input type="hidden" name="requestKey" value={state.nextKey ?? requestKey} />
    <fieldset disabled={pending}><SubsetConsent state={state} budget={budget} />
      <button className="button secondary">{pending ? "Asking Gemini…" : label}</button>
      <p className="small muted">Uses your Gemini key. Opinion, not fact.</p></fieldset>
    <Message state={state} />
  </form>;
}

type FinderDefaults = { mediaType: "movie" | "tv"; genres: number[]; language: string; maxRuntime: number | ""; mood: string; exclude: number[] };

export function FinderForm({ genres, requestKey, budget, defaults, label = "Find me something" }: { genres: { id: number; name: string }[]; requestKey: string; budget: number; defaults?: FinderDefaults; label?: string }) {
  const [state, action, pending] = useActionState(findTitles, initial);
  const uid = useId();
  return <form action={action} className="ai-form finder-form" aria-label="Find titles with Gemini" onReset={event => event.preventDefault()}>
    <input type="hidden" name="requestKey" value={state.nextKey ?? requestKey} />
    {defaults?.exclude.map(id => <input key={id} type="hidden" name="exclude" value={id} />)}
    <fieldset disabled={pending}>
      <div className="finder-fields">
        <div><label htmlFor={`${uid}-type`}>Looking for</label><select id={`${uid}-type`} name="mediaType" defaultValue={defaults?.mediaType ?? "movie"}><option value="movie">A movie</option><option value="tv">A TV series</option></select></div>
        <div><label htmlFor={`${uid}-language`}>Original language</label><select id={`${uid}-language`} name="language" defaultValue={defaults?.language ?? ""}>
          <option value="">Any language</option>{[["en", "English"], ["fr", "French"], ["es", "Spanish"], ["de", "German"], ["it", "Italian"], ["ja", "Japanese"], ["ko", "Korean"], ["hi", "Hindi"], ["zh", "Chinese"]].map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></div>
        <div><label htmlFor={`${uid}-runtime`}>Max movie runtime (minutes)</label><input id={`${uid}-runtime`} name="maxRuntime" type="number" min={60} max={240} step={1} defaultValue={defaults?.maxRuntime ?? ""} /></div>
      </div>
      <fieldset className="genre-choices"><legend>Genres (up to 3, optional)</legend>{genres.map(genre => <label key={genre.id}><input type="checkbox" name="genres" value={genre.id} defaultChecked={defaults?.genres.includes(genre.id)} />{genre.name}</label>)}</fieldset>
      <label htmlFor={`${uid}-mood`}>Mood (optional)</label>
      <textarea id={`${uid}-mood`} name="mood" maxLength={200} rows={2} defaultValue={defaults?.mood ?? ""} placeholder="e.g. something cosy for a rainy evening" />
      <SubsetConsent state={state} budget={budget} />
      <button className="button primary">{pending ? "Asking Gemini…" : label}</button>
      <p className="small muted">Gemini chooses up to three titles from real catalog results. Fewer picks beat invented ones.</p>
    </fieldset>
    <Message state={state} />
  </form>;
}
