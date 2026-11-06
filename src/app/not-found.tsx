import Link from "next/link";
export default function NotFound() {
  return (
    <section className="account-panel">
      <p className="eyebrow">404 / MISSING SCENE</p>
      <h1>
        This one
        <br />
        <em>got away.</em>
      </h1>
      <p>We couldn’t find that page.</p>
      <Link className="button primary" href="/">
        Back to home
      </Link>
    </section>
  );
}
