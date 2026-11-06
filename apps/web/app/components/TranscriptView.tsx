"use client";

import { useState } from "react";
import type { TranscriptInfo } from "../lib/api";

interface TranscriptViewProps {
  transcript: TranscriptInfo | null;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function TranscriptView({ transcript }: TranscriptViewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"segments" | "full">("segments");

  if (!transcript || (!transcript.full_text && (!transcript.segments || transcript.segments.length === 0))) {
    return null;
  }

  const segments = transcript.segments || [];

  return (
    <section className="panel w-full" aria-label="Transkrip audio">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[var(--yellow)] sm:p-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-[var(--line)] bg-[var(--green)] text-[var(--ink)]">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-[14px] font-bold sm:text-[15px]">
              Transcript
            </h3>
            <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
              {transcript.language ? `Language: ${transcript.language.toUpperCase()} • ` : ""}
              {segments.length > 0 ? `${segments.length} segments` : "Full transcript text"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase" style={{ color: "var(--ink-soft)" }}>
            {isOpen ? "Hide" : "Show"}
          </span>
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="border-t-2 border-[var(--line)] px-4 pb-5 pt-3 sm:px-5">
          {/* View toggle if segments exist */}
          {segments.length > 0 && transcript.full_text && (
            <div className="mb-4 flex gap-2 border-b-2 border-[var(--line)] pb-3">
              <button
                type="button"
                onClick={() => setActiveTab("segments")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  activeTab === "segments"
                    ? "border-2 border-[var(--line)] bg-[var(--line)] text-[var(--yellow)]"
                    : "border-2 border-[var(--line)] bg-[var(--paper)] hover:bg-[var(--yellow)]"
                }`}
              >
                Timed Segments
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("full")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  activeTab === "full"
                    ? "border-2 border-[var(--line)] bg-[var(--line)] text-[var(--yellow)]"
                    : "border-2 border-[var(--line)] bg-[var(--paper)] hover:bg-[var(--yellow)]"
                }`}
              >
                Full Text
              </button>
            </div>
          )}

          {/* Segment View */}
          {activeTab === "segments" && segments.length > 0 ? (
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {segments.map((seg, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 border-2 border-[var(--line)] bg-[var(--sunken)] p-2.5 text-[12px] transition-colors hover:bg-[var(--yellow)]"
                >
                  <span className="shrink-0 border-2 border-[var(--line)] bg-[var(--yellow)] px-1.5 py-0.5 font-mono text-[10px] font-medium">
                    {formatTime(seg.start)} - {formatTime(seg.end)}
                  </span>
                  <p className="flex-1" style={{ color: "var(--ink-soft)" }}>{seg.text}</p>
                </div>
              ))}
            </div>
          ) : (
            /* Full text view */
            <div className="max-h-[360px] overflow-y-auto border-2 border-[var(--line)] bg-[var(--sunken)] p-4 text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              {transcript.full_text || "No full transcript text available."}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
