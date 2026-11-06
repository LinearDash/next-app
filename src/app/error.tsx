"use client";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="account-panel">
      <p className="eyebrow">A BRIEF INTERMISSION</p>
      <h1>
        Let’s try
        <br />
        <em>that again.</em>
      </h1>
      <Alert className="app-error">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          <p>The service is temporarily unavailable. Please try again in a moment.</p>
        </AlertDescription>
      </Alert>
      <div className="actions">
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <Link className="text-link" href="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}
