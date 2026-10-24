"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/ai-agents", label: "课程", exact: true },
  { href: "/ai-agents/checkins", label: "每日打卡" },
  { href: "/ai-agents/stats", label: "打卡统计" },
];

export function AiSubnav() {
  const pathname = usePathname();
  return <nav className="home-tabs ai-subnav" aria-label="残酷AI群导航">{links.map((link) => <Link href={link.href} aria-current={(link.exact ? pathname === link.href : pathname.startsWith(link.href)) ? "page" : undefined} key={link.href}>{link.label}</Link>)}</nav>;
}
