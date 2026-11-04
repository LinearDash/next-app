import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Is It Worth It?", template: "%s · Is It Worth It?" },
  description: "A quieter way to discover your next great movie or show.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <a className="skip" href="#main">Skip to content</a>
    <header className="header"><Link className="brand" href="/" aria-label="Is It Worth It? Home"><span className="brand-icon" aria-hidden="true">✳</span> is it worth it<span className="accent">?</span></Link>
      <nav aria-label="Main navigation"><Link href="/discover">Discover</Link><Link href="/for-you">For you</Link><Link href="/library">Library</Link><Link href="/settings">My account <span aria-hidden="true">↗</span></Link></nav>
    </header>
    <main id="main">{children}</main>
    <footer><span>Good stories. Your own taste.</span><span>Independent. Personal. Ad-free. · <Link href="/credits">Credits &amp; TMDB attribution</Link></span></footer>
  </body></html>;
}
