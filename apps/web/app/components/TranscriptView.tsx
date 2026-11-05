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
    <div className="w-full rounded-xl border border-[#E5E7EB] bg-white shadow-sm transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[#F8FAFC] sm:p-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4338CA]">
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
            <h3 className="text-[14px] font-bold text-[#0F172A] sm:text-[15px]">
              Transcript
            </h3>
            <p className="text-[11px] text-[#64748B]">
              {transcript.language ? `Language: ${transcript.language.toUpperCase()} • ` : ""}
              {segments.length > 0 ? `${segments.length} segments` : "Full transcript text"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#64748B]">
            {isOpen ? "Hide" : "Show"}
          </span>
          <svg
            className={`h-4 w-4 text-[#64748B] transition-transform duration-200 ${
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
        <div className="border-t border-[#E5E7EB] px-4 pb-5 pt-3 sm:px-5">
          {/* View toggle if segments exist */}
          {segments.length > 0 && transcript.full_text && (
            <div className="mb-4 flex gap-2 border-b border-[#F1F5F9] pb-3">
              <button
                type="button"
                onClick={() => setActiveTab("segments")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  activeTab === "segments"
                    ? "bg-[#4338CA] text-white"
                    : "bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Timed Segments
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("full")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  activeTab === "full"
                    ? "bg-[#4338CA] text-white"
                    : "bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]"
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
                  className="flex items-start gap-3 rounded-lg border border-[#F1F5F9] bg-[#FAFAFA] p-2.5 text-[12px] transition-colors hover:bg-white"
                >
                  <span className="shrink-0 rounded bg-[#E2E8F0] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#475569]">
                    {formatTime(seg.start)} - {formatTime(seg.end)}
                  </span>
                  <p className="flex-1 text-[#334155]">{seg.text}</p>
                </div>
              ))}
            </div>
          ) : (
            /* Full text view */
            <div className="max-h-[360px] overflow-y-auto rounded-lg bg-[#F8FAFC] p-4 text-[13px] leading-relaxed text-[#334155]">
              {transcript.full_text || "No full transcript text available."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
