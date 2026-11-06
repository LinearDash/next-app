import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return <section className="settings" role="status">
    <span className="sr-only">Loading your account settings…</span>
    <div aria-hidden="true">
      <Skeleton className="mb-4 h-3 w-40" />
      <Skeleton className="h-14 w-96 max-w-full" />
      <Skeleton className="mt-5 h-5 w-full max-w-xl" />
      <div className="settings-row mt-8">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-12 w-28" />
      </div>
      <div className="settings-row">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-12 w-52 max-w-full" />
      </div>
      <section className="settings-ai space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-11 w-full max-w-xl" />
        <Skeleton className="h-11 w-full max-w-xl" />
        <Skeleton className="h-12 w-36" />
      </section>
    </div>
  </section>;
}
