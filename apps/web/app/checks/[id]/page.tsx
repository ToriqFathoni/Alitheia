"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCheck, submitCheck } from "../../lib/api";
import type { CheckDetail } from "../../lib/api";
import Navbar from "../../components/Navbar";
import VerdictCard from "../../components/VerdictCard";
import ProgressStepper from "../../components/ProgressStepper";
import ClaimsList from "../../components/ClaimsList";
import SourcesList from "../../components/SourcesList";
import TranscriptView from "../../components/TranscriptView";
import OcrView from "../../components/OcrView";

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
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${bg}`}>
      {label}
    </span>
  );
}

export default function CheckDetailPage() {
  return (
    <Suspense fallback={<CheckPageSkeleton />}>
      <CheckDetailContent />
    </Suspense>
  );
}

function CheckPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-40 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </main>
    </div>
  );
}

function CheckDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [check, setCheck] = useState<CheckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rechecking, setRechecking] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCheckData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCheck(id);
      setCheck(data);
      setLoading(false);
      setNotFound(false);
      return data;
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found") || msg.includes("404")) {
        setNotFound(true);
      } else {
        setErrorMsg(msg);
      }
      return null;
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    async function initialFetchAndPoll() {
      const initial = await fetchCheckData();
      if (!isMounted || !initial) return;

      const isTerminal = initial.status === "completed" || initial.status === "failed";
      if (!isTerminal) {
        pollIntervalRef.current = setInterval(async () => {
          const updated = await fetchCheckData();
          if (updated && (updated.status === "completed" || updated.status === "failed")) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        }, 3000);
      }
    }

    initialFetchAndPoll();

    return () => {
      isMounted = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [id, fetchCheckData]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRecheck = async () => {
    if (!check?.source_url || rechecking) return;
    setRechecking(true);
    try {
      const res = await submitCheck(check.source_url, true);
      if (res.id && res.id !== id) {
        router.push(`/checks/${res.id}`);
      } else {
        setLoading(true);
        await fetchCheckData();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to trigger re-check");
    } finally {
      setRechecking(false);
    }
  };

  // Derive stepper data from check status and events
  const computeSteps = (c: CheckDetail) => {
    const status = (c.status || "").toLowerCase();
    const eventSteps = c.progress?.steps || [];

    const findEventStatus = (keyword: string) => {
      const evt = eventSteps.find((e) => (e.stage || "").toLowerCase().includes(keyword));
      return evt ? evt.status : null;
    };

    let downloadStatus = "pending";
    let extractStatus = "pending";
    let analyzeStatus = "pending";

    // 1. Download stage
    const dlEvt = findEventStatus("download");
    if (dlEvt === "succeeded" || ["extracting", "analyzing", "completed"].includes(status)) {
      downloadStatus = "succeeded";
    } else if (dlEvt === "started" || status === "downloading" || status === "queued") {
      downloadStatus = "started";
    } else if (status === "failed" && dlEvt === "failed") {
      downloadStatus = "failed";
    }

    // 2. Extract stage
    const extEvt = findEventStatus("extract") || findEventStatus("ocr") || findEventStatus("transcription");
    if (extEvt === "succeeded" || ["analyzing", "completed"].includes(status)) {
      extractStatus = "succeeded";
    } else if (extEvt === "started" || status === "extracting") {
      extractStatus = "started";
    } else if (status === "failed" && extEvt === "failed") {
      extractStatus = "failed";
    }

    // 3. Analyze stage
    const anaEvt = findEventStatus("analyze") || findEventStatus("analysis");
    if (status === "completed" || anaEvt === "succeeded") {
      analyzeStatus = "succeeded";
    } else if (status === "analyzing" || anaEvt === "started") {
      analyzeStatus = "started";
    } else if (status === "failed") {
      analyzeStatus = "failed";
    }

    return [
      { name: "Mengunduh", status: downloadStatus },
      { name: "Mengekstrak", status: extractStatus },
      { name: "Menganalisis", status: analyzeStatus },
    ];
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F9FAFB] font-sans text-[#0F172A]">
      <Navbar />

      <main className="flex-1 pb-16 pt-8">
        <div className="mx-auto w-full max-w-[760px] px-6">
          {/* Breadcrumb / Back button */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#64748B] transition-colors hover:text-[#0F172A]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Fact Check
            </Link>

            {check && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-medium text-[#475569] shadow-sm transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                >
                  {copied ? (
                    <>
                      <svg className="h-3.5 w-3.5 text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[#059669]">Copied</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRecheck}
                  disabled={rechecking}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-medium text-[#475569] shadow-sm transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-50"
                >
                  <svg
                    className={`h-3.5 w-3.5 ${rechecking ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{rechecking ? "Re-checking..." : "Re-check"}</span>
                </button>
              </div>
            )}
          </div>

          {/* -------------------- 1. LOADING SKELETON -------------------- */}
          {loading && (
            <div className="space-y-6">
              <div className="h-8 w-2/3 animate-pulse rounded-lg bg-[#E2E8F0]" />
              <div className="h-64 w-full animate-pulse rounded-2xl bg-[#E2E8F0]" />
              <div className="h-32 w-full animate-pulse rounded-xl bg-[#E2E8F0]" />
            </div>
          )}

          {/* -------------------- 2. NOT FOUND (404) -------------------- */}
          {!loading && notFound && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-[#64748B]">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="mt-4 text-[20px] font-bold text-[#0F172A]">
                Pengecekan tidak ditemukan
              </h2>
              <p className="mt-2 text-[13px] text-[#64748B]">
                ID pengecekan tidak terdaftar atau telah dihapus.
              </p>
              <div className="mt-6">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-xl bg-[#4338CA] px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#3730A3]"
                >
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          )}

          {/* -------------------- 3. IN PROGRESS -------------------- */}
          {!loading && check && !["completed", "failed"].includes(check.status) && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-4">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={check.platform} />
                    <span className="text-[12px] text-[#64748B]">
                      Submitted on {new Date(check.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-3 py-0.5 text-[11px] font-semibold text-[#4338CA]">
                    <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#4338CA]" />
                    Processing
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#94A3B8]">
                    Source Link
                  </p>
                  <a
                    href={check.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-[14px] font-semibold text-[#0F172A] hover:text-[#4338CA] hover:underline"
                  >
                    {check.source_url}
                  </a>
                </div>
              </div>

              {/* Progress Stepper Card */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm text-center">
                <h2 className="text-[18px] font-bold text-[#0F172A]">
                  Sedang memproses...
                </h2>
                <p className="mt-1 text-[13px] text-[#64748B]">
                  Sistem AI Alitheia sedang menganalisis video/konten dan memverifikasi klaim fakta.
                </p>

                <div className="mt-8">
                  <ProgressStepper steps={computeSteps(check)} />
                </div>
              </div>
            </div>
          )}

          {/* -------------------- 4. FAILED -------------------- */}
          {!loading && check && check.status === "failed" && (
            <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-[#DC2626]">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h2 className="mt-4 text-[20px] font-bold text-[#0F172A]">
                Pengecekan Gagal
              </h2>

              <div className="mx-auto mt-3 max-w-md rounded-lg bg-red-50 p-3 text-[13px] text-[#991B1B]">
                <p className="font-semibold">
                  {check.error?.code || "PROCESSING_ERROR"}
                </p>
                <p className="mt-1">
                  {check.error?.message || "Terjadi kesalahan saat memproses konten sumber."}
                </p>
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleRecheck}
                  disabled={rechecking}
                  className="inline-flex items-center rounded-xl bg-[#4338CA] px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#3730A3] disabled:opacity-50"
                >
                  {rechecking ? "Mencoba lagi..." : "Coba Lagi (Re-check)"}
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#475569] shadow-sm hover:bg-[#F8FAFC]"
                >
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          )}

          {/* -------------------- 5. COMPLETED FULL RESULT -------------------- */}
          {!loading && check && check.status === "completed" && (
            <div className="space-y-6">
              {/* 1. Header: Source URL + platform badge + date */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={check.platform} />
                    <span className="text-[12px] text-[#64748B]">
                      Checked on {new Date(check.completed_at || check.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Completed
                  </span>
                </div>

                <div className="mt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                    Source Link
                  </span>
                  <a
                    href={check.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-[14px] font-semibold text-[#0F172A] hover:text-[#4338CA] hover:underline"
                  >
                    {check.source_url}
                  </a>
                </div>

                {/* 2. Media Info (caption, author) */}
                {check.media && (check.media.caption || check.media.author_handle) && (
                  <div className="mt-4 rounded-xl bg-[#F8FAFC] p-3.5 text-[12px]">
                    {check.media.author_handle && (
                      <p className="font-semibold text-[#334155]">
                        Author: <span className="text-[#4338CA]">@{check.media.author_handle}</span>
                      </p>
                    )}
                    {check.media.caption && (
                      <p className="mt-1 leading-relaxed text-[#475569]">
                        &ldquo;{check.media.caption}&rdquo;
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. VerdictCard */}
              {check.result && (
                <VerdictCard
                  verdict={check.result.verdict}
                  confidence={check.result.confidence}
                />
              )}

              {/* 4. Summary + Explanation */}
              {check.result && (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-7 shadow-sm">
                  {check.result.summary && (
                    <div className="border-b border-[#F1F5F9] pb-4">
                      <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Executive Summary
                      </h3>
                      <p className="mt-2 text-[15px] font-medium leading-relaxed text-[#0F172A]">
                        {check.result.summary}
                      </p>
                    </div>
                  )}

                  <div className={check.result.summary ? "pt-4" : ""}>
                    <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Detailed Analysis
                    </h3>
                    <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[#475569]">
                      {check.result.explanation}
                    </p>
                  </div>
                </div>
              )}

              {/* 5. ClaimsList */}
              {check.result?.claims && check.result.claims.length > 0 && (
                <ClaimsList
                  claims={check.result.claims}
                  sources={check.result.sources || []}
                />
              )}

              {/* 6. SourcesList */}
              {check.result?.sources && check.result.sources.length > 0 && (
                <SourcesList sources={check.result.sources} />
              )}

              {/* 7. TranscriptView */}
              {check.transcript && <TranscriptView transcript={check.transcript} />}

              {/* 8. OcrView */}
              {check.ocr && check.ocr.length > 0 && <OcrView ocrResults={check.ocr} />}

              {/* 9. Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-2 text-[12px] font-semibold text-[#475569] transition-colors hover:bg-[#EEF2FF] hover:text-[#4338CA]"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Check another link
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-[12px] font-semibold text-[#475569] shadow-sm transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  >
                    {copied ? "Copied!" : "Copy link"}
                  </button>

                  <button
                    type="button"
                    onClick={handleRecheck}
                    disabled={rechecking}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#4338CA] px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-[#3730A3] disabled:opacity-50"
                  >
                    {rechecking ? "Re-checking..." : "Re-check"}
                  </button>
                </div>
              </div>

              {/* 10. Disclaimer */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center">
                <p className="text-[11px] leading-relaxed text-[#64748B]">
                  Hasil dihasilkan oleh sistem otomatis dan dapat keliru. Periksa sumber yang dirujuk.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
