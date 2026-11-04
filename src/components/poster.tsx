"use client";

import { useState } from "react";
import { posterUrl } from "@/lib/poster";

export function Poster({ path, title }: { path: string | null; title: string }) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const url = posterUrl(path);
  return <div className="poster">
    {url && failedPath !== path ?
      // Direct CDN images are bounded to TMDB; avoid charging the app's image optimizer for public posters.
      // eslint-disable-next-line @next/next/no-img-element
      <img ref={image => {
        // A failed cached/early image can finish before React attaches onError.
        if (image?.complete && image.naturalWidth === 0) setFailedPath(path);
      }} src={url} alt={`${title} poster`} width={342} height={513} loading="lazy" onError={() => setFailedPath(path)} /> :
      <span className="poster-fallback" role="img" aria-label={`${title}: poster unavailable`}><span aria-hidden="true">▧</span>Poster unavailable</span>}
  </div>;
}
