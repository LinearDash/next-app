import { Skeleton } from "@/components/ui/skeleton";

function RecommendationCard() {
  return <article className="library-card" aria-hidden="true">
    <div className="library-summary">
      <Skeleton className="h-32 w-[75px] shrink-0" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
    <Skeleton className="h-10 w-36" />
  </article>;
}

export default function ForYouLoading() {
  return <section className="catalog-page" role="status">
    <span className="sr-only">Loading your recommendations…</span>
    <div aria-hidden="true">
      <Skeleton className="mb-4 h-3 w-44" />
      <Skeleton className="h-14 w-72 max-w-full" />
      <Skeleton className="mt-5 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="library-links">
        {["library", "dismissed", "preferences", "finder"].map(item => <Skeleton key={item} className="h-8 w-28 rounded-full" />)}
      </div>
      { ["movie", "tv"].map(type => <section className="catalog-section" key={type}>
        <Skeleton className="mb-5 h-8 w-52" />
        <div className="library-list"><RecommendationCard /><RecommendationCard /></div>
      </section>)}
    </div>
  </section>;
}
