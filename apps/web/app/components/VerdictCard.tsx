"use client";

interface VerdictCardProps {
  verdict: string;
  confidence: number | null;
}

interface VerdictConfig {
  label: string;
  headline: string;
  accent: string;
  onAccent: string;
  glyph: string;
}

export default function VerdictCard({ verdict, confidence }: VerdictCardProps) {
  const norm = (verdict || "").toLowerCase().trim();

  let config: VerdictConfig;

  if (["true", "real", "verified", "benar"].includes(norm)) {
    config = {
      label: "BENAR",
      headline: "Informasi terverifikasi",
      accent: "var(--verdict-true)",
      onAccent: "#fff",
      glyph: "✓",
    };
  } else if (["false", "hoax", "salah"].includes(norm)) {
    config = {
      label: "HOAX",
      headline: "Terdeteksi potensi hoax",
      accent: "var(--verdict-false)",
      onAccent: "#fff",
      glyph: "✕",
    };
  } else if (["misleading", "sebagian", "mixed"].includes(norm)) {
    config = {
      label: "SEBAGIAN",
      headline: "Informasi menyesatkan",
      accent: "var(--verdict-mixed)",
      onAccent: "var(--ink)",
      glyph: "!",
    };
  } else {
    config = {
      label: "TIDAK PASTI",
      headline: "Belum dapat dipastikan",
      accent: "var(--verdict-none)",
      onAccent: "#fff",
      glyph: "?",
    };
  }

  // Confidence arrives either as a 0–1 ratio or an already-scaled percentage;
  // clamp so a stray out-of-range value cannot overflow the bar.
  const percent =
    confidence === null || confidence === undefined
      ? null
      : Math.min(100, Math.max(0, Math.round(confidence <= 1 ? confidence * 100 : confidence)));

  return (
    <section className="verdict-panel p-6 sm:p-8" aria-label="Hasil verifikasi">
      <div className="flex flex-wrap items-center gap-5">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center text-3xl font-bold"
          style={{ background: config.accent, color: config.onAccent, border: "3px solid var(--line)" }}
        >
          {config.glyph}
        </span>

        <div className="min-w-0 flex-1">
          <span
            className="inline-block px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ background: config.accent, color: config.onAccent, border: "2px solid var(--line)" }}
          >
            {config.label}
          </span>
          <h2 className="display-title mt-2 text-2xl sm:text-3xl">{config.headline}</h2>
        </div>
      </div>

      {percent !== null && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <span>Tingkat keyakinan</span>
            <span>{percent}%</span>
          </div>
          {/* role=meter conveys the value to assistive tech, which a styled div
              alone does not. */}
          <div
            role="meter"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tingkat keyakinan"
            className="h-4 w-full"
            style={{ border: "2px solid var(--line)", background: "var(--sunken)" }}
          >
            <div
              className="h-full transition-[width] duration-700 ease-out"
              style={{ width: `${percent}%`, background: config.accent }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
