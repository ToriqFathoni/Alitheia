"use client";

export interface PipelineStep {
  name: string;
  /** 'started' | 'succeeded' | 'failed' | 'pending' */
  status: string;
}

interface ProgressStepperProps {
  steps: PipelineStep[];
}

const CANONICAL = [
  { id: "download", label: "Mengunduh", sublabel: "Ambil konten", keys: ["download", "downloading", "mengunduh", "queued"] },
  { id: "extract", label: "Mengekstrak", sublabel: "Teks & audio", keys: ["extract", "extracting", "mengekstrak", "ocr", "transcription", "transcript"] },
  { id: "analyze", label: "Menganalisis", sublabel: "Verifikasi klaim", keys: ["analyze", "analyzing", "menganalisis", "analysis"] },
];

type Phase = "pending" | "started" | "succeeded" | "failed";

function phaseOf(raw: string | undefined): Phase {
  const s = (raw || "").toLowerCase();
  if (["succeeded", "completed", "success"].includes(s)) return "succeeded";
  if (["failed", "error"].includes(s)) return "failed";
  if (["started", "running", "processing"].includes(s)) return "started";
  return "pending";
}

export default function ProgressStepper({ steps = [] }: ProgressStepperProps) {
  const resolved = CANONICAL.map((canon, index) => {
    // Match by stage name first, then fall back to positional order so the
    // stepper still renders sensibly if the producer renames its stages.
    const byName = steps.find((s) =>
      canon.keys.some((k) => (s.name || "").toLowerCase().includes(k))
    );
    const status = phaseOf(byName ? byName.status : steps[index]?.status);
    return { ...canon, status };
  });

  return (
    <ol className="flex w-full list-none flex-col gap-5 p-0 sm:flex-row sm:gap-0">
      {resolved.map((step, idx) => {
        const isLast = idx === resolved.length - 1;

        const badge =
          step.status === "succeeded"
            ? { bg: "var(--verdict-true)", fg: "#fff", glyph: "✓" }
            : step.status === "failed"
              ? { bg: "var(--verdict-false)", fg: "#fff", glyph: "✕" }
              : step.status === "started"
                ? { bg: "var(--yellow)", fg: "var(--ink)", glyph: String(idx + 1) }
                : { bg: "var(--sunken)", fg: "var(--ink-mute)", glyph: String(idx + 1) };

        return (
          <li key={step.id} className="relative flex flex-1 items-center gap-3 sm:flex-col sm:gap-0">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center text-sm font-bold"
              style={{ background: badge.bg, color: badge.fg, border: "3px solid var(--line)" }}
              aria-hidden="true"
            >
              {badge.glyph}
            </span>

            <div className="sm:mt-2.5 sm:text-center">
              <span className="block text-sm font-bold">{step.label}</span>
              <span className="block text-[11px]" style={{ color: "var(--ink-mute)" }}>
                {step.sublabel}
              </span>
            </div>

            {/* Connector: vertical on phones, horizontal from the tablet
                breakpoint up. Decorative only. */}
            {!isLast && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute left-[21px] top-11 h-[calc(100%-1rem)] w-[3px] sm:hidden"
                  style={{ background: step.status === "succeeded" ? "var(--verdict-true)" : "var(--line-soft)" }}
                />
                <span
                  aria-hidden="true"
                  className="absolute left-[calc(50%+2rem)] top-[21px] hidden h-[3px] w-[calc(100%-4rem)] sm:block"
                  style={{ background: step.status === "succeeded" ? "var(--verdict-true)" : "var(--line-soft)" }}
                />
              </>
            )}

            <span className="sr-only">
              {step.label}: {step.status}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
