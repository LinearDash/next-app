import type { Metadata } from "next";
import Link from "next/link";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import { MainNav } from "@/components/main-nav";
import "./globals.css";
import { cn } from "@/lib/utils";

// Self-hosted at build time by next/font: no runtime requests to Google, so the CSP stays font-src 'self'.
const display = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Is It Worth It?", template: "%s · Is It Worth It?" },
  description: "A quieter way to discover your next great movie or show.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={cn(display.variable, body.variable, "dark")}><body>
    <a className="skip" href="#main">Skip to content</a>
    <header className="header"><Link className="brand" href="/" aria-label="Is It Worth It? Home"><span className="brand-icon" aria-hidden="true">✳</span> is it worth it<span className="accent">?</span></Link>
      <MainNav />
    </header>
    <main id="main">{children}</main>
    <footer><span>Good stories. Your own taste.</span><span>Independent. Personal. Ad-free. · <Link href="/credits">Credits &amp; TMDB attribution</Link></span></footer>
  </body></html>;
}
