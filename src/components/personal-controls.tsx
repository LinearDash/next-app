"use client";

import { useActionState, useId, useState } from "react";
import { changeEntry, savePreferences } from "@/app/library/actions";
import { statuses, statusLabels, reactionLabels, tags, type PersonalEntry, type ActionState } from "@/lib/taste";

const initial: ActionState = { ok: false, message: "" };

export function PersonalControls({ mediaType, id, entry }: { mediaType: "movie" | "tv"; id: number; entry: PersonalEntry | null }) {
  const [state, action, pending] = useActionState(changeEntry, initial);
  const uid = useId();
  const [status, setStatus] = useState(entry?.status || "want_to_watch");
  const [reaction, setReaction] = useState(String(entry?.reaction ?? ""));
  const [selectedTags, setSelectedTags] = useState(entry?.tags || []);
  // React action forms reset automatically; keep edits intact when the server reports failure.
  return <form action={action} onReset={event => event.preventDefault()} className="personal-form" aria-label="Personal library entry">
    <input type="hidden" name="mediaType" value={mediaType} /><input type="hidden" name="id" value={id} />
    <fieldset disabled={pending}><legend>Your personal reaction</legend><p className="small muted">You can rate before finishing, or save without a rating.</p>
      <div className="personal-fields"><div><label htmlFor={`${uid}-status`}>Watch status</label><select id={`${uid}-status`} name="status" value={status} onChange={event => setStatus(event.target.value as PersonalEntry["status"])}>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div>
      <div><label htmlFor={`${uid}-reaction`}>Your reaction</label><select id={`${uid}-reaction`} name="reaction" value={reaction} onChange={event => setReaction(event.target.value)}><option value="">Not rated</option>{reactionLabels.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></div></div>
      <fieldset className="tag-choices"><legend>Optional descriptive tags</legend>{tags.map(tag => <label key={tag}><input name="tags" type="checkbox" value={tag} checked={selectedTags.includes(tag)} onChange={event => setSelectedTags(event.target.checked ? [...selectedTags, tag] : selectedTags.filter(value => value !== tag))} />{tag}</label>)}</fieldset>
      <div className="actions"><button className="button primary" name="intent" value="save">{pending ? "Saving…" : "Save to library"}</button>{entry && <button className="button secondary" name="intent" value="remove">Remove from library</button>}</div>
    </fieldset>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "action-success" : "notice"}>{state.message}</p>}
  </form>;
}

export function DismissControl({ mediaType, id, dismissed }: { mediaType: "movie" | "tv"; id: number; dismissed: boolean }) {
  const [state, action, pending] = useActionState(changeEntry, initial);
  return <form action={action} className="dismiss-form">
    <input type="hidden" name="mediaType" value={mediaType} /><input type="hidden" name="id" value={id} />
    <button disabled={pending} className="button secondary" name="intent" value={dismissed ? "restore" : "dismiss"}>{pending ? "Updating…" : dismissed ? "Undo not interested" : "Not interested"}</button>
    <p className="small muted">{dismissed ? "Excluded from future recommendations. Your library entry is kept." : "Exclude from future recommendations without removing your library entry."}</p>
    {state.message && <p role={state.ok ? "status" : "alert"}>{state.message}</p>}
  </form>;
}

export function PreferencesForm({ genres, selected }: { genres: { id: number; name: string }[]; selected: number[] }) {
  const [state, action, pending] = useActionState(savePreferences, initial);
  const [selectedGenres, setSelectedGenres] = useState(selected);
  return <form action={action} onReset={event => event.preventDefault()} className="preferences-form"><fieldset disabled={pending}><legend>Genres you enjoy (optional)</legend>
    <div className="genre-choices">{genres.map(genre => <label key={genre.id}><input type="checkbox" name="genres" value={genre.id} checked={selectedGenres.includes(genre.id)} onChange={event => setSelectedGenres(event.target.checked ? [...selectedGenres, genre.id] : selectedGenres.filter(id => id !== genre.id))} />{genre.name}</label>)}</div>
    {!genres.length && <p className="muted">Genre choices are temporarily unavailable. You can skip and return later.</p>}
    <div className="actions"><button className="button primary" name="intent" value="save" disabled={!genres.length}>{pending ? "Saving…" : "Save preferences"}</button><button className="button secondary" name="intent" value="skip" formNoValidate>Skip for now</button></div>
    </fieldset>{state.message && <p role="alert" className="notice">{state.message}</p>}
  </form>;
}
