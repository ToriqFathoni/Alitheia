"use client";

import type { SourceInfo } from "../lib/api";

interface SourcesListProps {
  sources?: SourceInfo[];
}

function StanceBadge({ stance }: { stance?: string | null }) {
  const norm = (stance || "").toLowerCase().trim();

  let label = "Neutral";
  let bgClass = "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]";

  if (norm === "supports" || norm === "support" || norm === "entailment") {
    label = "Supports";
    bgClass = "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]";
  } else if (norm === "refutes" || norm === "refute" || norm === "contradiction") {
    label = "Refutes";
    bgClass = "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]";
  } else if (norm === "neutral") {
    label = "Neutral";
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

export default function SourcesList({ sources = [] }: SourcesListProps) {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <section className="w-full" aria-label="Reference sources">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[16px] font-bold text-[#0F172A]">
          Reference Sources ({sources.length})
        </h3>
        <span className="text-[11px] text-[#64748B]">External evidence retrieved</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="divide-y divide-[#E5E7EB]">
          {sources.map((source, index) => {
            const formattedDate = source.published_at
              ? new Date(source.published_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : null;

            return (
              <div
                key={source.id || index}
                className="flex flex-col gap-2 p-4 transition-colors hover:bg-[#F8FAFC] sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0F172A] hover:text-[#4338CA]"
                    >
                      <span className="break-words group-hover:underline">
                        {source.title || source.url}
                      </span>
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#4338CA]"
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

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                      {source.publisher && (
                        <span className="font-medium text-[#334155]">{source.publisher}</span>
                      )}
                      {source.publisher && formattedDate && <span>•</span>}
                      {formattedDate && <span>{formattedDate}</span>}
                      <span>•</span>
                      <span className="max-w-[200px] truncate text-[#94A3B8] sm:max-w-[300px]">
                        {source.url}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StanceBadge stance={source.stance} />
                  </div>
                </div>

                {source.snippet && (
                  <p className="mt-1 text-[12px] leading-relaxed text-[#475569]">
                    {source.snippet}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
