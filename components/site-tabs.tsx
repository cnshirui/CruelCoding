"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "排行榜", matches: (path: string) => path === "/" || path.startsWith("/ranks") },
  { href: "/checkins", label: "每日打卡", matches: (path: string) => path.startsWith("/checkins") },
  { href: "/users", label: "残酷群友", matches: (path: string) => path.startsWith("/users") },
  { href: "/rules", label: "群规", matches: (path: string) => path.startsWith("/rules") },
] as const;

export function SiteTabs() {
  const pathname = usePathname();

  return (
    <nav className="site-tabs" aria-label="主导航">
      {tabs.map((tab) => (
        <Link href={tab.href} aria-current={tab.matches(pathname) ? "page" : undefined} key={tab.href}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
