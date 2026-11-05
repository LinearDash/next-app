"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Highlights the section you're in; /search and /title pages belong to Discover.
const links = [["/discover", "Discover", ["/discover", "/search", "/title"]], ["/for-you", "For you", ["/for-you", "/ai"]], ["/library", "Library", ["/library", "/onboarding"]], ["/settings", "My account", ["/settings"]]] as const;

export function MainNav() {
  const path = usePathname();
  return <nav aria-label="Main navigation">{links.map(([href, label, sections]) =>
    <Link key={href} href={href} aria-current={sections.some(section => path === section || path.startsWith(`${section}/`)) ? "page" : undefined}>
      {label}{href === "/settings" && <span aria-hidden="true"> ↗</span>}
    </Link>)}</nav>;
}
