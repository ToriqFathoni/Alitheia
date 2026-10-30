"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  return (
    <Suspense fallback={<NavbarShell />}>
      <NavbarContent />
    </Suspense>
  );
}

function NavbarShell() {
  return (
    <header className="border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex h-[50px] w-full max-w-[1400px] items-center justify-between px-6 sm:px-7">
        <div className="flex items-center gap-6 sm:gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0F172A] text-[13px] font-bold leading-none text-white">a.</span>
            <span className="text-[17px] font-medium tracking-tight text-[#0F172A]">alitheia</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavbarContent() {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isHistory = pathname === "/history";

  return (
    <header className="border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex h-[50px] w-full max-w-[1400px] items-center justify-between px-6 sm:px-7">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/"
            id="nav-logo"
            className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338CA]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0F172A] text-[13px] font-bold leading-none text-white">
              a.
            </span>
            <span className="text-[17px] font-medium tracking-tight text-[#0F172A]">alitheia</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-5 sm:flex">
            <Link
              href="/"
              id="nav-fact-check"
              aria-current={isHome ? "page" : undefined}
              className={`text-[12px] transition-colors hover:text-[#0F172A] ${
                isHome ? "font-bold text-[#0F172A]" : "font-normal text-[#64748B]"
              }`}
            >
              Fact check
            </Link>

            <Link
              href="/history"
              id="nav-history"
              aria-current={isHistory ? "page" : undefined}
              className={`text-[12px] transition-colors hover:text-[#0F172A] ${
                isHistory ? "font-bold text-[#0F172A]" : "font-normal text-[#64748B]"
              }`}
            >
              History
            </Link>

            <span
              id="nav-methodology"
              className="text-[12px] font-normal text-[#94A3B8] cursor-not-allowed"
              title="Methodology documentation coming soon"
            >
              Methodology
            </span>
          </nav>
        </div>

        {/* Right: workspace + avatar */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            id="workspace-switcher"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <rect width="16" height="20" x="4" y="2" rx="2" />
              <path d="M9 22v-4h6v4" />
              <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
            </svg>
            <span className="hidden sm:inline">Editorial workspace</span>
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <span className="hidden h-5 w-px bg-[#E5E7EB] sm:block" />
          <button
            type="button"
            id="user-avatar"
            aria-label="Account: ER"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F5F9] text-[10px] font-semibold text-[#475569] transition-colors hover:bg-[#E2E8F0]"
          >
            ER
          </button>
        </div>
      </div>
    </header>
  );
}
