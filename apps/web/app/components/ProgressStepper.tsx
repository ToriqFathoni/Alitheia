"use client";

export interface PipelineStep {
  name: string;
  status: string; // 'started' | 'succeeded' | 'failed' | 'pending'
}

interface ProgressStepperProps {
  steps: PipelineStep[];
}

interface StepDefinition {
  id: string;
  label: string;
  sublabel: string;
  matchKeys: string[];
}

const CANONICAL_STEPS: StepDefinition[] = [
  {
    id: "download",
    label: "Mengunduh",
    sublabel: "Download media",
    matchKeys: ["download", "downloading", "mengunduh", "queued"],
  },
  {
    id: "extract",
    label: "Mengekstrak",
    sublabel: "Extract audio & text",
    matchKeys: ["extract", "extracting", "mengekstrak", "ocr", "transcription", "transcript"],
  },
  {
    id: "analyze",
    label: "Menganalisis",
    sublabel: "Verify & synthesize",
    matchKeys: ["analyze", "analyzing", "menganalisis", "analysis"],
  },
];

export default function ProgressStepper({ steps = [] }: ProgressStepperProps) {
  // Determine status for each canonical step
  const resolvedSteps = CANONICAL_STEPS.map((canon, index) => {
    // 1. Try finding by matchKeys
    const found = steps.find((s) => {
      const sName = (s.name || "").toLowerCase();
      return canon.matchKeys.some((k) => sName.includes(k));
    });

    if (found) {
      return {
        ...canon,
        status: (found.status || "pending").toLowerCase(),
      };
    }

    // 2. Fallback to index if steps array matches positional order
    if (steps[index]) {
      return {
        ...canon,
        status: (steps[index].status || "pending").toLowerCase(),
      };
    }

    return {
      ...canon,
      status: "pending",
    };
  });

  return (
    <div className="w-full py-4">
      <div className="relative flex items-center justify-between">
        {resolvedSteps.map((step, idx) => {
          const isStarted = step.status === "started" || step.status === "running" || step.status === "processing";
          const isSucceeded = step.status === "succeeded" || step.status === "completed" || step.status === "success";
          const isFailed = step.status === "failed" || step.status === "error";
          const isPending = !isStarted && !isSucceeded && !isFailed;

          const isLast = idx === resolvedSteps.length - 1;

          return (
            <div key={step.id} className="relative flex flex-1 items-center">
              {/* Stepper Node */}
              <div className="relative z-10 flex flex-col items-center">
                {/* Node Icon */}
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 ${
                    isSucceeded
                      ? "bg-[#059669] text-white shadow-[0_2px_8px_rgba(5,150,105,0.3)]"
                      : isFailed
                      ? "bg-[#DC2626] text-white shadow-[0_2px_8px_rgba(220,38,38,0.3)]"
                      : isStarted
                      ? "border-2 border-[#4338CA] bg-white text-[#4338CA] ring-4 ring-[#4338CA]/15"
                      : "border-2 border-[#CBD5E1] bg-[#F8FAFC] text-[#94A3B8]"
                  }`}
                >
                  {isStarted && (
                    <svg
                      className="h-5 w-5 animate-spin text-[#4338CA]"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}

                  {isSucceeded && (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}

                  {isFailed && (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}

                  {isPending && (
                    <span className="text-[13px] font-semibold text-[#64748B]">{idx + 1}</span>
                  )}
                </div>

                {/* Labels */}
                <div className="mt-2.5 flex flex-col items-center text-center">
                  <span
                    className={`text-[13px] font-semibold tracking-tight transition-colors ${
                      isStarted
                        ? "text-[#4338CA]"
                        : isSucceeded
                        ? "text-[#059669]"
                        : isFailed
                        ? "text-[#DC2626]"
                        : "text-[#64748B]"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] text-[#94A3B8]">{step.sublabel}</span>
                </div>
              </div>

              {/* Connecting Line (drawn to the right of node if not last) */}
              {!isLast && (
                <div className="absolute left-1/2 top-[22px] -z-0 h-0.5 w-full -translate-y-1/2">
                  <div
                    className={`h-full w-full transition-colors duration-300 ${
                      isSucceeded
                        ? "bg-[#059669]"
                        : isStarted
                        ? "bg-gradient-to-r from-[#4338CA] to-[#CBD5E1]"
                        : "bg-[#E2E8F0]"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
