import Image from "next/image";
export const metadata = { title: "Credits" };
export default function Credits() {
  return (
    <section className="account-panel">
      <p className="eyebrow">CREDITS</p>
      <h1>
        Stories, <em>with sources.</em>
      </h1>
      <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
        <Image src="/tmdb-logo.svg" width={110} height={15} alt="The Movie Database (TMDB)" />
      </a>
      <h2>Catalog data and images</h2>
      <p>Movie and TV metadata, community scores, and poster artwork are provided by TMDB.</p>
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p className="muted small">
        Community scores belong to the catalog. Your personal reactions are separate.
      </p>
    </section>
  );
}
