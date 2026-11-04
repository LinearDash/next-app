import { connection } from "next/server";
import { popular } from "@/lib/tmdb";
import { TitleGrid, SearchForm, CatalogNotice } from "@/components/catalog";

export const metadata = { title: "Discover" };

export default async function Discover() {
  await connection();
  const [movies, tv] = await Promise.allSettled([popular("movie"), popular("tv")]);
  return <section className="catalog-page"><p className="eyebrow">FIND YOUR NEXT GOOD WATCH</p><h1>Discover <em>something good.</em></h1><p className="intro">Popular movies and TV, ready to explore. No sign-in needed.</p><SearchForm />
    <section className="catalog-section" aria-labelledby="popular-movies"><h2 id="popular-movies">Popular movies</h2>{movies.status === "fulfilled" ? <TitleGrid titles={movies.value.titles} /> : <CatalogNotice retry="/discover" />}</section>
    <section className="catalog-section" aria-labelledby="popular-tv"><h2 id="popular-tv">Popular TV series</h2>{tv.status === "fulfilled" ? <TitleGrid titles={tv.value.titles} /> : <CatalogNotice retry="/discover" />}</section>
  </section>;
}
