"use client";

import { useMemo, useState } from "react";
import type { ReactNode, SVGProps } from "react";

/* -------------------------------------------------------------------------- */
/*  Design tokens (from Figma selection colors)                               */
/* -------------------------------------------------------------------------- */
const MAX_WORDS = 15000;

/*
  bg page      #F9FAFB   border   #E5E7EB   heading  #0F172A
  primary      #4338CA   text-2   #475569 / #64748B
  false badge  #FFF1F2 / #BE123C            true badge #ECFDF5 / #047857
*/

/* -------------------------------------------------------------------------- */
/*  Inline SVG icons (lucide-style, no extra dependency)                      */
/* -------------------------------------------------------------------------- */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

const AlignLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 12H3" />
    <path d="M17 18H3" />
    <path d="M21 6H3" />
  </Icon>
);
const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
);
const FileUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M12 18v-6" />
    <path d="m9 15 3-3 3 3" />
  </Icon>
);
const BuildingIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
  </Icon>
);
const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);
const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
);
const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Icon>
);
const ArrowUpRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </Icon>
);
const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);
const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

/* -------------------------------------------------------------------------- */
/*  Static data                                                               */
/* -------------------------------------------------------------------------- */
type TabId = "text" | "url" | "upload";

const TABS: { id: TabId; label: string; icon: (p: IconProps) => ReactNode }[] = [
  { id: "text", label: "Paste text", icon: AlignLeftIcon },
  { id: "url", label: "Article URL", icon: LinkIcon },
  { id: "upload", label: "Upload document", icon: FileUpIcon },
];

const NAV_LINKS = [
  { label: "Fact check", active: true },
  { label: "History", active: false },
  { label: "Methodology", active: false },
];

type Verdict = "False" | "True";

const LIVE_CHECKS: { verdict: Verdict; title: string; time?: string }[] = [
  { verdict: "False", title: "Eastbridge transit: ridership claims", time: "2 min ago" },
  { verdict: "True", title: "Library hours expansion" },
];

const SAMPLE_TEXT =
  "Eastbridge's electric bus pilot cut average commute times by 20% in its first year, and the city says ridership doubled across all routes since launch.";

/* -------------------------------------------------------------------------- */
/*  Small presentational components                                           */
/* -------------------------------------------------------------------------- */
function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const isFalse = verdict === "False";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
        isFalse ? "bg-[#FFF1F2] text-[#BE123C]" : "bg-[#ECFDF5] text-[#047857]"
      }`}
    >
      {isFalse ? <XIcon size={11} strokeWidth={2.5} /> : <CheckIcon size={11} strokeWidth={2.5} />}
      {verdict}
    </span>
  );
}

function Navbar() {
  return (
    <header className="border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex h-[50px] w-full max-w-[1400px] items-center justify-between px-6 sm:px-7">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-6 sm:gap-8">
          <a
            href="#"
            id="nav-logo"
            className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338CA]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0F172A] text-[13px] font-bold leading-none text-white">
              a.
            </span>
            <span className="text-[17px] font-medium tracking-tight text-[#0F172A]">alitheia</span>
          </a>

          <nav aria-label="Primary" className="hidden items-center gap-5 sm:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                id={`nav-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                href="#"
                aria-current={link.active ? "page" : undefined}
                className={`text-[12px] transition-colors hover:text-[#0F172A] ${
                  link.active ? "font-bold text-[#0F172A]" : "font-normal text-[#64748B]"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Right: workspace + avatar */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            id="workspace-switcher"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <BuildingIcon size={14} />
            <span className="hidden sm:inline">Editorial workspace</span>
            <ChevronDownIcon size={13} />
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

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */
export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const wordCount = useMemo(() => {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [text]);

  const overLimit = wordCount > MAX_WORDS;
  const formattedCount = wordCount.toLocaleString("en-US");
  const formattedMax = MAX_WORDS.toLocaleString("en-US");

  return (
    <div className="flex min-h-screen flex-col bg-[#F9FAFB] font-sans text-[#0F172A]">
      <Navbar />

      <main className="flex-1">
        {/* ------------------------------ HERO ------------------------------ */}
        <section className="mx-auto w-full max-w-[640px] px-6 pt-16 text-center sm:pt-[72px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#64748B]">
            The editorial verification workspace
          </p>
          <h1 className="mx-auto mt-6 max-w-[600px] text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0F172A] sm:text-[52px]">
            Before you publish, know the facts.
          </h1>
          <p className="mx-auto mt-6 max-w-[430px] text-[15px] leading-relaxed text-[#475569]">
            Check claims against source evidence. See what holds up and what doesn&apos;t.
          </p>
        </section>

        {/* --------------------------- INPUT CARD --------------------------- */}
        <section className="mx-auto mt-12 w-full max-w-[612px] px-6" aria-label="Fact check input">
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] transition-shadow focus-within:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(67,56,202,0.18)]">
            {/* Tabs */}
            <div role="tablist" aria-label="Input method" className="flex items-center gap-6 border-b border-[#E5E7EB] px-4">
              {TABS.map(({ id, label, icon: TabIcon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`tab-${id}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${id}`}
                    onClick={() => setActiveTab(id)}
                    className={`-mb-px flex items-center gap-2 border-b-2 py-3.5 text-[12px] transition-colors ${
                      isActive
                        ? "border-[#4338CA] font-semibold text-[#4338CA]"
                        : "border-transparent font-normal text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    <TabIcon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Panels */}
            <div className="h-[156px] px-4 pt-4">
              {activeTab === "text" && (
                <div role="tabpanel" id="panel-text" aria-labelledby="tab-text" className="relative h-full">
                  <label htmlFor="claim-text" className="sr-only">
                    Text to verify
                  </label>
                  <textarea
                    id="claim-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="peer h-full w-full resize-none border-0 bg-transparent p-0 text-[13px] leading-relaxed text-[#0F172A] outline-none ring-0 focus:outline-none focus:ring-0"
                    spellCheck
                  />
                  {text.length === 0 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 top-0 select-none"
                    >
                      <p className="text-[13px] text-[#94A3B8]">
                        Paste an article, a statement, or a claim to verify...
                      </p>
                      <p className="mt-2 text-[11px] text-[#64748B]">
                        Include the full context for a more reliable assessment.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "url" && (
                <div role="tabpanel" id="panel-url" aria-labelledby="tab-url" className="h-full">
                  <label htmlFor="article-url" className="sr-only">
                    Article URL
                  </label>
                  <input
                    id="article-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/news/article"
                    className="w-full border-0 bg-transparent p-0 text-[13px] text-[#0F172A] outline-none ring-0 placeholder:text-[#94A3B8] focus:outline-none focus:ring-0"
                  />
                  <p className="mt-2 text-[11px] text-[#64748B]">
                    We&apos;ll extract the article body and check the claims it contains.
                  </p>
                </div>
              )}

              {activeTab === "upload" && (
                <div role="tabpanel" id="panel-upload" aria-labelledby="tab-upload" className="h-full pb-4">
                  <label
                    htmlFor="document-file"
                    className="flex h-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] text-center transition-colors hover:border-[#4338CA]/50 hover:bg-[#EEF2FF]/40"
                  >
                    <FileUpIcon size={20} className="text-[#64748B]" />
                    <span className="mt-2 text-[12px] font-medium text-[#0F172A]">
                      {fileName ?? "Drop a document or click to browse"}
                    </span>
                    <span className="mt-0.5 text-[11px] text-[#64748B]">PDF, DOCX or TXT</span>
                    <input
                      id="document-file"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="sr-only"
                      onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Card footer */}
            <div className="flex items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3 text-[10px] text-[#64748B]">
                <span className={`whitespace-nowrap ${overLimit ? "font-semibold text-[#BE123C]" : ""}`}>
                  {formattedCount} / {formattedMax} words
                </span>
                <span className="h-3.5 w-px bg-[#E5E7EB]" />
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <LockIcon size={11} />
                  <span className="hidden sm:inline">Private to your workspace</span>
                  <span className="sm:hidden">Private</span>
                </span>
              </div>

              <button
                type="button"
                id="analyze-verify"
                disabled={overLimit}
                className="group flex shrink-0 items-center gap-2 rounded-xl bg-[#4338CA] px-5 py-3 text-[12px] font-semibold text-[#FFFFFF] shadow-[0_6px_16px_-6px_rgba(67,56,202,0.6)] transition-all hover:-translate-y-px hover:bg-[#3730A3] hover:shadow-[0_10px_20px_-6px_rgba(67,56,202,0.65)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <ArrowRightIcon size={14} className="transition-transform group-hover:translate-x-0.5" />
                Analyze &amp; Verify
              </button>
            </div>
          </div>

          {/* Below card */}
          <div className="mt-6 flex flex-col items-start justify-between gap-2 text-[11px] text-[#64748B] sm:flex-row sm:items-center">
            <p>
              Just exploring the workspace?{" "}
              <button
                type="button"
                id="try-sample"
                onClick={() => {
                  setActiveTab("text");
                  setText(SAMPLE_TEXT);
                }}
                className="inline-flex items-center gap-1 font-semibold text-[#4338CA] transition-colors hover:text-[#3730A3] hover:underline"
              >
                Try a sample fact check
                <ArrowUpRightIcon size={11} />
              </button>
            </p>
            <p>Your text is never used for training.</p>
          </div>
        </section>

        {/* ------------------------ LIVE FACT CHECKS ------------------------ */}
        <section className="mx-auto mb-16 mt-10 w-full max-w-[612px] px-6" aria-label="Live fact checks">
          <div className="border-y border-[#E5E7EB] py-3.5">
            <div className="flex items-center gap-4">
              <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.06em] text-[#64748B]">
                Live fact checks
              </span>

              <ul className="scrollbar-none flex min-w-0 flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap">
                {LIVE_CHECKS.map((item, index) => (
                  <li key={item.title} className="flex shrink-0 items-center gap-4">
                    <a
                      href="#"
                      className="group flex items-center gap-2.5 rounded-md text-[11px] text-[#475569] transition-colors hover:text-[#0F172A]"
                    >
                      <VerdictBadge verdict={item.verdict} />
                      <span className="group-hover:underline group-hover:underline-offset-2">{item.title}</span>
                      {item.time && <span className="text-[10px] text-[#94A3B8]">{item.time}</span>}
                    </a>
                    {index < LIVE_CHECKS.length - 1 && <span className="h-3.5 w-px bg-[#E5E7EB]" />}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                id="live-checks-next"
                aria-label="Show more live fact checks"
                className="shrink-0 rounded-md p-1 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <ChevronRightIcon size={14} />
              </button>
            </div>
          </div>
          <p className="mt-3 text-[9px] text-[#94A3B8]">
            Demonstration workspace · All sample articles and source documents are fictional.
          </p>
        </section>
      </main>

      {/* ------------------------------ FOOTER ------------------------------ */}
      <footer className="border-t border-[#E5E7EB] bg-[#F9FAFB]">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-start justify-between gap-3 px-6 py-5 text-[10px] text-[#64748B] sm:flex-row sm:items-center sm:px-7">
          <p>© 2026 Alitheia · Evidence first. Editorial judgment always.</p>
          <nav aria-label="Footer" className="flex items-center gap-6">
            {["Privacy & security", "Help center", "System status"].map((label) => (
              <a key={label} href="#" className="transition-colors hover:text-[#0F172A]">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
