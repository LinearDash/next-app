"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#151812",
          color: "#f1f2eb",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 600 }}>
          <p style={{ color: "#c8e68b", letterSpacing: 2, fontSize: 12 }}>A BRIEF INTERMISSION</p>
          <h1 style={{ fontSize: 48, lineHeight: 1.1 }}>Something went wrong.</h1>
          <p style={{ color: "#c5c9bc", lineHeight: 1.7 }}>
            The app couldn’t load this page. Please try again in a moment.
          </p>
          <button
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 5,
              padding: "13px 21px",
              background: "#c8e68b",
              color: "#151812",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
