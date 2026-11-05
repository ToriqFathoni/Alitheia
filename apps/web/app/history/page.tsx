"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listChecks } from "../lib/api";
import type { CheckListItem } from "../lib/api";
import Navbar from "../components/Navbar";

function PlatformBadge({ platform }: { platform?: string | null }) {
  const p = (platform || "").toLowerCase();
  let bg = "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]";
  let label = platform || "Web";

  if (p === "tiktok") {
    bg = "bg-black text-white border-black";
    label = "TikTok";
  } else if (p === "instagram") {
    bg = "bg-gradient-to-r from-[#833ab4]/15 via-[#fd1d1d]/15 to-[#fcb045]/15 text-[#833ab4] border-[#fd1d1d]/30 font-semibold";
    label = "Instagram";
  } else if (p === "twitter" || p === "x") {
    bg = "bg-black text-white border-black";
    label = "X / Twitter";
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${bg}`}>
      {label}
    </span>
  );
}

function StatusOrVerdictBadge({ status, verdict }: { status: string; verdict?: string | null }) {
  const normVerdict = (verdict || "").toLowerCase().trim();

  if (normVerdict === "hoax" || normVerdict === "false") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#FECDD3] bg-[#FFF1F2] px-2 py-0.5 text-[11px] font-semibold text-[#BE123C]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#BE123C]" />
        Hoax
      </span>
    );
  }

  if (normVerdict === "real" || normVerdict === "verified" || normVerdict === "true") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#047857]" />
        Verified
      </span>
    );
  }

  if (normVerdict === "misleading") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-semibold text-[#B45309]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B45309]" />
        Misleading
      </span>
    );
  }

  if (normVerdict === "unverified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]" />
        Unverified
      </span>
    );
  }

  // Fallback to status badge
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-semibold text-[#475569]">
        Completed
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#FECDD3] bg-[#FFF1F2] px-2 py-0.5 text-[11px] font-semibold text-[#BE123C]">
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#C7D2FE] bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#4338CA]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4338CA]" />
      {status || "Processing"}
    </span>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB]"><Navbar /><main className="max-w-4xl mx-auto px-4 py-10"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/3" /><div className="h-12 bg-gray-200 rounded" /><div className="h-24 bg-gray-200 rounded" /><div className="h-24 bg-gray-200 rounded" /></div></main></div>}>
      <HistoryContent />
    </Suspense>
  );
}

function HistoryContent() {
  const router = useRouter();

  const [items, setItems] = useState<CheckListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listChecks({
        page,
        page_size: pageSize,
        q: search.trim() || undefined,
        verdict: verdictFilter || undefined,
        platform: platformFilter || undefined,
      });
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [page, search, verdictFilter, platformFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-screen flex-col bg-[#F9FAFB] font-sans text-[#0F172A]">
      <Navbar />

      <main className="flex-1 pb-16 pt-8">
        <div className="mx-auto w-full max-w-[800px] px-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A]">
                Check History
              </h1>
              <p className="mt-1 text-[13px] text-[#64748B]">
                View past fact-checking analysis and verification records.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-[#4338CA] px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-[#3730A3]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Check
            </Link>
          </div>

          {/* Filters Bar */}
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                placeholder="Search URL or topic..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] py-2 pl-9 pr-3 text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#4338CA] focus:bg-white"
              />
              <svg
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3" />
              </svg>
            </div>

            {/* Platform Filter */}
            <select
              value={platformFilter}
              onChange={(e) => {
                setPlatformFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-medium text-[#475569] outline-none focus:border-[#4338CA]"
            >
              <option value="">All Platforms</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="twitter">X / Twitter</option>
            </select>

            {/* Verdict Filter */}
            <select
              value={verdictFilter}
              onChange={(e) => {
                setVerdictFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-medium text-[#475569] outline-none focus:border-[#4338CA]"
            >
              <option value="">All Verdicts</option>
              <option value="hoax">Hoax</option>
              <option value="real">Verified</option>
              <option value="misleading">Misleading</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>

          {/* Error notice */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-[#991B1B]">
              {error}
            </div>
          )}

          {/* List Content */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-[#E2E8F0]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[#64748B]">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-[16px] font-bold text-[#0F172A]">
                Belum ada riwayat pengecekan
              </h3>
              <p className="mt-1 text-[13px] text-[#64748B]">
                Mulai verifikasi link media sosial atau sesuaikan filter pencarian Anda.
              </p>
              <div className="mt-5">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-xl bg-[#4338CA] px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-[#3730A3]"
                >
                  Mulai Pengecekan
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const dateStr = new Date(item.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/checks/${item.id}`)}
                    className="group cursor-pointer rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition-all hover:border-[#CBD5E1] hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-2.5">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={item.platform} />
                        <span className="text-[11px] text-[#94A3B8]">{dateStr}</span>
                      </div>
                      <StatusOrVerdictBadge status={item.status} verdict={item.verdict} />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[#0F172A] group-hover:text-[#4338CA]">
                          {item.source_url}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#64748B]">
                          ID: {item.id}
                        </p>
                      </div>

                      <svg
                        className="h-4 w-4 shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-1 group-hover:text-[#4338CA]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {total > pageSize && (
            <div className="mt-8 flex items-center justify-between border-t border-[#E5E7EB] pt-4 text-[12px] text-[#64748B]">
              <span>
                Showing page {page} of {totalPages} ({total} total)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 font-medium shadow-sm transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 font-medium shadow-sm transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
