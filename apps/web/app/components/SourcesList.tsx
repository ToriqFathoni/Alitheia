"use client";

import type { SourceInfo } from "../lib/api";

interface SourcesListProps {
  sources?: SourceInfo[];
}

function StanceBadge({ stance }: { stance?: string | null }) {
  const norm = (stance || "").toLowerCase().trim();

  let label = "Netral";
  let bg = "var(--sunken)";
  let fg = "var(--ink)";

  if (["supports", "support", "entailment"].includes(norm)) {
    label = "Mendukung";
    bg = "var(--verdict-true)";
    fg = "#fff";
  } else if (["refutes", "refute", "contradiction"].includes(norm)) {
    label = "Membantah";
    bg = "var(--verdict-false)";
    fg = "#fff";
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ background: bg, color: fg, border: "2px solid var(--line)" }}
    >
      {label}
    </span>
  );
}

/** Extracts a readable host without throwing on a malformed URL. */
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function SourcesList({ sources = [] }: SourcesListProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <section aria-label="Sumber rujukan">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="display-title text-lg">Sumber rujukan ({sources.length})</h3>
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>Bukti eksternal</span>
      </div>

      <div className="panel divide-y" style={{ borderColor: "var(--line-soft)" }}>
        {sources.map((source, index) => {
          const date = source.published_at
            ? new Date(source.published_at).toLocaleDateString("id-ID", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : null;

          return (
            <div
              key={source.id || index}
              className="flex flex-col gap-2 p-4"
              style={{ borderColor: "var(--line-soft)" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1.5 text-sm font-semibold underline"
                  >
                    <span className="break-words">{source.title || source.url}</span>
                    <span aria-hidden="true">↗</span>
                  </a>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--ink-mute)" }}>
                    {source.publisher && (
                      <span className="font-semibold" style={{ color: "var(--ink-soft)" }}>
                        {source.publisher}
                      </span>
                    )}
                    {date && <span>· {date}</span>}
                    <span className="truncate">· {hostOf(source.url)}</span>
                  </div>
                </div>

                <StanceBadge stance={source.stance} />
              </div>

              {source.snippet && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {source.snippet}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
