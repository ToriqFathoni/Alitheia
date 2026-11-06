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
    <section className="panel w-full" aria-label="Hasil OCR">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[var(--yellow)] sm:p-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-[var(--line)] bg-[var(--coral)] text-[var(--ink)]">
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
            <h3 className="text-[14px] font-bold sm:text-[15px]">
              OCR Results
            </h3>
            <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
              {ocrResults.length} text frame{ocrResults.length === 1 ? "" : "s"} extracted from media
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
        <div className="border-t-2 border-[var(--line)] px-4 pb-5 pt-4 sm:px-5">
          <div className="space-y-4">
            {groupKeys.map((groupKey) => {
              const items = grouped[groupKey];
              return (
                <div key={groupKey} className="border-2 border-[var(--line)] bg-[var(--sunken)] p-3.5">
                  <div className="mb-2 flex items-center justify-between border-b-2 border-[var(--line)] pb-2">
                    <span className="text-[12px] font-bold uppercase tracking-wider">
                      {formatSourceName(groupKey)}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                      {items.length} item{items.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      const timeStr = formatTime(item.frame_time_sec);
                      return (
                        <div
                          key={item.id || idx}
                          className="border-2 border-[var(--line)] bg-[var(--paper)] p-3 text-[12px]"
                        >
                          {timeStr && (
                            <span className="mb-1 inline-block border-2 border-[var(--line)] bg-[var(--yellow)] px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                              Frame @ {timeStr}
                            </span>
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "var(--ink-soft)" }}>
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
    </section>
  );
}
