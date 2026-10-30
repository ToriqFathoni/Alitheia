"use client";

import type { ClaimInfo, SourceInfo } from "../lib/api";

interface ClaimsListProps {
  claims: ClaimInfo[];
  sources?: SourceInfo[];
}

function MiniVerdictBadge({ verdict }: { verdict: string }) {
  const norm = (verdict || "").toLowerCase().trim();

  let label = verdict;
  let bgClass = "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]";

  if (norm === "hoax" || norm === "false") {
    label = "Hoax";
    bgClass = "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]";
  } else if (norm === "real" || norm === "verified" || norm === "true") {
    label = "Verified";
    bgClass = "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]";
  } else if (norm === "misleading") {
    label = "Misleading";
    bgClass = "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]";
  } else if (norm === "unverified") {
    label = "Unverified";
    bgClass = "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]";
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${bgClass}`}
    >
      {label}
    </span>
  );
}

export default function ClaimsList({ claims = [], sources = [] }: ClaimsListProps) {
  if (!claims || claims.length === 0) {
    return null;
  }

  // Create a fast lookup map for sources by ID
  const sourcesMap = new Map<string, SourceInfo>();
  sources.forEach((s) => {
    if (s.id) sourcesMap.set(s.id, s);
  });

  return (
    <section className="w-full" aria-label="Extracted claims analysis">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[16px] font-bold text-[#0F172A]">
          Identified Claims ({claims.length})
        </h3>
        <span className="text-[11px] text-[#64748B]">Analyzed individually</span>
      </div>

      <div className="flex flex-col gap-3.5">
        {claims.map((claim, index) => {
          // Resolve linked sources
          const linkedSources = (claim.source_ids || [])
            .map((id) => sourcesMap.get(id))
            .filter((s): s is SourceInfo => s !== undefined);

          return (
            <div
              key={index}
              className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition-all hover:border-[#CBD5E1]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#94A3B8]">
                  Claim #{index + 1}
                </span>
                <MiniVerdictBadge verdict={claim.verdict} />
              </div>

              <blockquote className="mt-3 text-[14px] font-semibold leading-snug text-[#0F172A]">
                &ldquo;{claim.text}&rdquo;
              </blockquote>

              {claim.explanation && (
                <p className="mt-2 text-[13px] leading-relaxed text-[#475569]">
                  {claim.explanation}
                </p>
              )}

              {linkedSources.length > 0 && (
                <div className="mt-4 border-t border-[#F1F5F9] pt-3">
                  <span className="text-[11px] font-medium text-[#64748B]">
                    Referenced Sources:
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {linkedSources.map((source) => (
                      <a
                        key={source.id}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] text-[#334155] transition-colors hover:border-[#4338CA]/30 hover:bg-[#EEF2FF] hover:text-[#4338CA]"
                      >
                        <span className="max-w-[220px] truncate font-medium">
                          {source.publisher || source.title || "External Source"}
                        </span>
                        <svg
                          className="h-3 w-3 shrink-0 text-[#94A3B8]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
