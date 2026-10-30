"use client";

import { useState } from "react";
import type { OcrResultInfo } from "../lib/api";

interface OcrViewProps {
  ocrResults: OcrResultInfo[] | null;
}

function formatTime(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatSourceName(source: string): string {
  if (!source) return "Extracted Text";
  return source
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OcrView({ ocrResults }: OcrViewProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!ocrResults || ocrResults.length === 0) {
    return null;
  }

  // Group by source type
  const grouped = ocrResults.reduce<Record<string, OcrResultInfo[]>>((acc, item) => {
    const key = item.source || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped);

  return (
    <div className="w-full rounded-xl border border-[#E5E7EB] bg-white shadow-sm transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[#F8FAFC] sm:p-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FDF4FF] text-[#A21CAF]">
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
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[#0F172A] sm:text-[15px]">
              OCR Results
            </h3>
            <p className="text-[11px] text-[#64748B]">
              {ocrResults.length} text frame{ocrResults.length === 1 ? "" : "s"} extracted from media
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
        <div className="border-t border-[#E5E7EB] px-4 pb-5 pt-4 sm:px-5">
          <div className="space-y-4">
            {groupKeys.map((groupKey) => {
              const items = grouped[groupKey];
              return (
                <div key={groupKey} className="rounded-lg border border-[#F1F5F9] bg-[#FAFAFA] p-3.5">
                  <div className="mb-2 flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#475569]">
                      {formatSourceName(groupKey)}
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      {items.length} item{items.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      const timeStr = formatTime(item.frame_time_sec);
                      return (
                        <div
                          key={item.id || idx}
                          className="rounded-md border border-[#E5E7EB] bg-white p-3 text-[12px]"
                        >
                          {timeStr && (
                            <span className="mb-1 inline-block rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#475569]">
                              Frame @ {timeStr}
                            </span>
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed text-[#334155]">
                            {item.full_text || "(No text recognized)"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
