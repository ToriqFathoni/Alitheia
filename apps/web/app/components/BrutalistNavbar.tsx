"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/", label: "Cek" },
  { href: "/history", label: "Riwayat" },
];

export default function BrutalistNavbar() {
  return (
    <Suspense fallback={<NavbarLinks pathname="" />}>
      <NavbarContent />
    </Suspense>
  );
}

function NavbarContent() {
  const pathname = usePathname();
  return <NavbarLinks pathname={pathname} />;
}

function NavbarLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="site-nav" aria-label="Navigasi utama">
      <Link href="/" className="site-logo">CekFakta</Link>
      <span className="site-nav-spacer" />
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`site-nav-link ${active ? "site-nav-active" : ""}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
