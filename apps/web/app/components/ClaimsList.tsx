"use client";

import type { ClaimInfo, SourceInfo } from "../lib/api";

interface ClaimsListProps {
  claims: ClaimInfo[];
  sources?: SourceInfo[];
}

function MiniVerdictBadge({ verdict }: { verdict: string }) {
  const norm = (verdict || "").toLowerCase().trim();

  let label = verdict || "—";
  let bg = "var(--sunken)";
  let fg = "var(--ink)";

  if (["true", "real", "verified", "benar"].includes(norm)) {
    label = "Benar";
    bg = "var(--verdict-true)";
    fg = "#fff";
  } else if (["false", "hoax", "salah"].includes(norm)) {
    label = "Hoax";
    bg = "var(--verdict-false)";
    fg = "#fff";
  } else if (["misleading", "sebagian", "mixed"].includes(norm)) {
    label = "Sebagian";
    bg = "var(--verdict-mixed)";
    fg = "var(--ink)";
  } else if (["unverified", "tidak_pasti"].includes(norm)) {
    label = "Tidak pasti";
    bg = "var(--verdict-none)";
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

export default function ClaimsList({ claims = [], sources = [] }: ClaimsListProps) {
  if (!claims || claims.length === 0) return null;

  const sourcesMap = new Map<string, SourceInfo>();
  sources.forEach((s) => {
    if (s.id) sourcesMap.set(s.id, s);
  });

  return (
    <section aria-label="Klaim yang teridentifikasi">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="display-title text-lg">Klaim teridentifikasi ({claims.length})</h3>
        <span className="text-xs" style={{ color: "var(--ink-mute)" }}>Dianalisis satu per satu</span>
      </div>

      <div className="flex flex-col gap-4">
        {claims.map((claim, index) => {
          const linked = (claim.source_ids || [])
            .map((id) => sourcesMap.get(id))
            .filter((s): s is SourceInfo => s !== undefined);

          return (
            <article key={index} className="panel p-5">
              <div
                className="flex flex-wrap items-center justify-between gap-2"
                style={{ borderBottom: "2px solid var(--line-soft)", paddingBottom: "0.75rem" }}
              >
                <span className="eyebrow">Klaim #{index + 1}</span>
                <MiniVerdictBadge verdict={claim.verdict} />
              </div>

              <blockquote className="mt-3 text-base font-semibold leading-snug">
                &ldquo;{claim.text}&rdquo;
              </blockquote>

              {claim.explanation && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {claim.explanation}
                </p>
              )}

              {linked.length > 0 && (
                <div className="mt-4" style={{ borderTop: "2px solid var(--line-soft)", paddingTop: "0.75rem" }}>
                  <span className="eyebrow">Sumber rujukan</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {linked.map((source) => (
                      <a
                        key={source.id}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium"
                        style={{ border: "2px solid var(--line)", background: "var(--sunken)" }}
                      >
                        <span className="max-w-[220px] truncate">
                          {source.publisher || source.title || "Sumber eksternal"}
                        </span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
