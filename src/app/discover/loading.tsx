import { Skeleton } from "@/components/ui/skeleton";

function PosterShelf() {
  return <ul className="title-grid" aria-hidden="true">
    {Array.from({ length: 6 }, (_, index) => <li key={index}>
      <Skeleton className="aspect-[2/3] w-full rounded-md" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </li>)}
  </ul>;
}

export default function DiscoverLoading() {
  return <section className="catalog-page" role="status">
    <span className="sr-only">Loading movie and TV picks…</span>
    <div aria-hidden="true">
      <Skeleton className="mb-4 h-3 w-40" />
      <Skeleton className="h-14 w-80 max-w-full" />
      <Skeleton className="mt-4 h-5 w-96 max-w-full" />
      <Skeleton className="mt-8 h-12 w-full max-w-2xl" />
      <section className="catalog-section">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>
        <PosterShelf />
      </section>
      {["movies", "shows"].map(label => <section className="catalog-section" key={label}>
        <Skeleton className="mb-5 h-8 w-48" />
        <PosterShelf />
      </section>)}
    </div>
  </section>;
}
