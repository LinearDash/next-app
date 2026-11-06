import { Skeleton } from "@/components/ui/skeleton";

function ShelfPoster() {
  return (
    <li aria-hidden="true">
      <Skeleton className="aspect-[2/3] w-full rounded-md" />
      <Skeleton className="mt-3 h-4 w-4/5" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </li>
  );
}

export default function LibraryLoading() {
  return (
    <section className="catalog-page" role="status">
      <span className="sr-only">Loading your library…</span>
      <div aria-hidden="true">
        <Skeleton className="mb-4 h-3 w-40" />
        <Skeleton className="h-14 w-96 max-w-full" />
        <div className="library-links">
          {["saved", "dismissed", "preferences", "recommendations", "discover"].map((item) => (
            <Skeleton key={item} className="h-8 w-28 rounded-full" />
          ))}
        </div>
        <div className="catalog-search library-filters">
          {["media", "status", "reaction"].map((item) => (
            <Skeleton key={item} className="h-12 min-w-40 flex-1" />
          ))}
          <Skeleton className="h-12 w-32" />
        </div>
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-5 h-3 w-36" />
        <div className="library-layout">
          <ul className="shelf">
            {Array.from({ length: 10 }, (_, index) => (
              <ShelfPoster key={index} />
            ))}
          </ul>
          <aside className="library-editor space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </aside>
        </div>
      </div>
    </section>
  );
}
