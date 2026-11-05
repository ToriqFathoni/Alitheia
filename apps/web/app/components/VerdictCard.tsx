"use client";

import type { ReactNode } from "react";

interface VerdictCardProps {
  verdict: string;
  confidence: number | null;
}

interface VerdictConfig {
  label: string;
  bgBadge: string;
  textColor: string;
  accentBg: string;
  barColor: string;
  icon: ReactNode;
}

export default function VerdictCard({ verdict, confidence }: VerdictCardProps) {
  const normVerdict = (verdict || "").toLowerCase().trim();

  let config: VerdictConfig;

  switch (normVerdict) {
    case "hoax":
    case "false":
      config = {
        label: "Hoax",
        bgBadge: "bg-[#DC2626]",
        textColor: "text-[#DC2626]",
        accentBg: "bg-red-50 border-red-200",
        barColor: "#DC2626",
        icon: (
          <svg
            className="h-10 w-10 text-[#DC2626]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
      };
      break;

    case "real":
    case "verified":
    case "true":
      config = {
        label: "Verified",
        bgBadge: "bg-[#059669]",
        textColor: "text-[#059669]",
        accentBg: "bg-emerald-50 border-emerald-200",
        barColor: "#059669",
        icon: (
          <svg
            className="h-10 w-10 text-[#059669]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ),
      };
      break;

    case "misleading":
      config = {
        label: "Misleading",
        bgBadge: "bg-[#D97706]",
        textColor: "text-[#D97706]",
        accentBg: "bg-amber-50 border-amber-200",
        barColor: "#D97706",
        icon: (
          <svg
            className="h-10 w-10 text-[#D97706]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        ),
      };
      break;

    case "unverified":
    default:
      config = {
        label: normVerdict === "unverified" ? "Unverified" : verdict || "Unverified",
        bgBadge: "bg-[#6B7280]",
        textColor: "text-[#6B7280]",
        accentBg: "bg-slate-50 border-slate-200",
        barColor: "#6B7280",
        icon: (
          <svg
            className="h-10 w-10 text-[#6B7280]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M12 21a9 9 0 100-18 9 9 0 000 18z"
            />
          </svg>
        ),
      };
      break;
  }

  const confidencePercent =
    confidence !== null && confidence !== undefined
      ? Math.min(100, Math.max(0, Math.round(confidence <= 1 ? confidence * 100 : confidence)))
      : null;

  return (
    <div className="mx-auto w-full max-w-[612px] rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      {/* Icon */}
      <div
        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border ${config.accentBg}`}
      >
        {config.icon}
      </div>

      {/* Verdict Label */}
      <div className="mt-4">
        <span
          className={`inline-block rounded-full px-4 py-1 text-[13px] font-bold uppercase tracking-wider text-white ${config.bgBadge}`}
        >
          {config.label}
        </span>
      </div>

      <h2 className="mt-2 text-[26px] font-bold tracking-tight text-[#0F172A] sm:text-[30px]">
        {config.label === "Verified"
          ? "Information Verified"
          : config.label === "Hoax"
          ? "Potential Hoax Detected"
          : config.label === "Misleading"
          ? "Misleading Information"
          : "Verdict Unverified"}
      </h2>

      {/* Confidence Bar */}
      {confidencePercent !== null && (
        <div className="mx-auto mt-6 max-w-[320px]">
          <div className="mb-2 flex items-center justify-between text-[12px] font-medium text-[#475569]">
            <span>Confidence score</span>
            <span className="font-bold text-[#0F172A]">{confidencePercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${confidencePercent}%`, backgroundColor: config.barColor }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
