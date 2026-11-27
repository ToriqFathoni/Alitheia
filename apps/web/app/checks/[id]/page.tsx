"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCheck, submitCheck, submitFeedback } from "../../lib/api";
import type { CheckDetail } from "../../lib/api";
import BrutalistNavbar from "../../components/BrutalistNavbar";
import PlatformBadge from "../../components/PlatformBadge";
import VerdictCard from "../../components/VerdictCard";
import ClaimsList from "../../components/ClaimsList";
import SourcesList from "../../components/SourcesList";
import TranscriptView from "../../components/TranscriptView";
import OcrView from "../../components/OcrView";
import LoadingScreen from "../../components/LoadingScreen";

const POLL_MS = 3000;

/** True once the check can no longer change, so polling should stop. */
function isTerminal(status: string | undefined) {
  return status === "completed" || status === "failed";
}

export default function CheckDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CheckDetailContent />
    </Suspense>
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
  const [feedbackRating, setFeedbackRating] = useState<"accurate" | "inaccurate" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);

  const handleDownloadJson = () => {
    if (!check) return;
    const blob = new Blob([JSON.stringify(check, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alitheia-report-${check.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (!check) return;
    const escapeCsv = (val: unknown) => {
      const s = String(val ?? "").replace(/"/g, '""');
      return `"${s}"`;
    };
    const header = ["Check ID", "Verdict", "Confidence", "Claim", "Claim Verdict", "Explanation", "Source URLs"];
    const sourceUrls = (check.result?.sources || []).map((s) => s.url).join(" | ");
    const claims = check.result?.claims || [];
    const rows =
      claims.length > 0
        ? claims.map((c) => [
            check.id,
            check.result?.verdict || "",
            check.result?.confidence ?? "",
            c.text,
            c.verdict,
            c.explanation,
            sourceUrls,
          ])
        : [
            [
              check.id,
              check.result?.verdict || "",
              check.result?.confidence ?? "",
              check.input_text || check.source_url,
              check.result?.verdict || "",
              check.result?.explanation || "",
              sourceUrls,
            ],
          ];
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alitheia-report-${check.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendFeedback = async (rating: "accurate" | "inaccurate") => {
    if (!id || feedbackSubmitting) return;
    setFeedbackRating(rating);
    setFeedbackSubmitting(true);
    try {
      await submitFeedback(id, rating, feedbackComment);
      setFeedbackSent(
        rating === "accurate"
          ? "Terima kasih! Penilaian 'Akurat' Anda telah dicatat untuk evaluasi sistem."
          : "Terima kasih! Laporan 'Keliru' Anda telah dicatat untuk ditinjau auditor."
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengirim umpan balik");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchCheckData = useCallback(async () => {
    if (!id) return null;
    try {
      const data = await getCheck(id);
      setCheck(data);
      setLoading(false);
      setNotFound(false);
      setErrorMsg(null);
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
    let active = true;

    (async () => {
      const initial = await fetchCheckData();
      if (!active || !initial) return;
      if (isTerminal(initial.status)) return;

      pollRef.current = setInterval(async () => {
        const updated = await fetchCheckData();
        if (updated && isTerminal(updated.status)) stopPolling();
      }, POLL_MS);
    })();

    return () => {
      active = false;
      stopPolling();
    };
  }, [id, fetchCheckData, stopPolling]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMsg("Tidak dapat menyalin tautan. Salin manual dari bilah alamat.");
    }
  };

  const handleRecheck = async () => {
    if (rechecking) return;
    if (!check?.source_url) {
      setErrorMsg("Pemeriksaan teks tidak dapat diulang dari sini. Kirim ulang teksnya di halaman Cek.");
      return;
    }
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
      setErrorMsg(err instanceof Error ? err.message : "Gagal memulai pemeriksaan ulang");
    } finally {
      setRechecking(false);
    }
  };

  const steps = check ? computeSteps(check) : [];
  const inProgress = check && !isTerminal(check.status);

  return (
    <div className="shell">
      <BrutalistNavbar />

      <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="btn-secondary">
            ← Kembali
          </Link>

          {check && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleCopyLink} className="btn-secondary">
                {copied ? "Tersalin!" : "Salin tautan"}
              </button>
              <button
                type="button"
                onClick={handleRecheck}
                disabled={rechecking}
                className="btn-secondary"
              >
                {rechecking ? "Memeriksa ulang..." : "Periksa ulang"}
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="notice notice-error mb-5" role="alert">{errorMsg}</div>
        )}

        {loading && <div className="history-empty">Memuat pemeriksaan...</div>}

        {!loading && notFound && (
          <div className="panel p-8 text-center sm:p-12">
            <h2 className="display-title text-2xl">Pemeriksaan tidak ditemukan</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              ID pemeriksaan tidak terdaftar atau telah dihapus.
            </p>
            <Link href="/" className="btn-primary mt-6">Kembali ke Beranda</Link>
          </div>
        )}

        {!loading && inProgress && check && (
          <div className="process-screen">
            <section className="process-banner">
              <p className="intake-kicker">Pemeriksaan sedang berjalan</p>
              <h1>Sedang memeriksa klaim Anda...</h1>
              <div className="process-progress" role="progressbar" aria-label="Progres pemeriksaan">
                <span style={{ width: `${Math.max(12, Math.round((steps.filter((step) => step.status === "succeeded").length / steps.length) * 100))}%` }} />
              </div>
              <SourceHeader check={check} />
            </section>
            <section className="process-stage-grid" aria-label="Tahapan pemeriksaan">
              {steps.map((step, index) => (
                <article key={step.name} className={`process-stage process-stage-${index + 1}`}>
                  <span className="process-stage-number">{index + 1}</span>
                  <h2>{step.name}</h2>
                  <p>{index === 0 ? "Mengambil konten sumber." : index === 1 ? "Menyiapkan teks, audio, dan konteks." : "Membandingkan klaim dengan bukti."}</p>
                  <span className="process-stage-status">{step.status === "succeeded" ? "Selesai" : step.status === "started" ? "Berjalan" : step.status === "failed" ? "Gagal" : "Menunggu"}</span>
                </article>
              ))}
              <article className="process-stage process-stage-4">
                <span className="process-stage-number">4</span>
                <h2>Hasil</h2>
                <p>Menarik kesimpulan dan menyiapkan bukti.</p>
                <span className="process-stage-status">Menunggu</span>
              </article>
            </section>
            <div className="process-claim-strip">
              <b>Klaim ditemukan</b>
              <span>{check.input_text ? `“${check.input_text}”` : "Klaim dari konten akan tampil di sini."}</span>
            </div>
          </div>
        )}

        {!loading && check && check.status === "failed" && (
          <div className="panel p-8 text-center sm:p-12">
            <h2 className="display-title text-2xl">Pemeriksaan gagal</h2>
            <div
              className="mx-auto mt-4 max-w-md p-3 text-sm"
              style={{ border: "2px solid var(--line)", background: "var(--sunken)" }}
            >
              <p className="font-bold">{check.error?.code || "PROCESSING_ERROR"}</p>
              <p className="mt-1">
                {check.error?.message || "Terjadi kesalahan saat memproses konten sumber."}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleRecheck}
                disabled={rechecking}
                className="btn-primary"
              >
                {rechecking ? "Mencoba lagi..." : "Coba lagi"}
              </button>
              <Link href="/" className="btn-secondary">Kembali ke Beranda</Link>
            </div>
          </div>
        )}

        {!loading && check && check.status === "completed" && (
          <div className="result-screen">
            <div className="result-grid">
              <div className="result-verdict-column">
                <SourceHeader check={check} completed />
                {check.result && (
                  <VerdictCard verdict={check.result.verdict} confidence={check.result.confidence} />
                )}
                {check.result && (
                  <section className="result-reason">
                    <h2>Alasan</h2>
                    <p>{check.result.summary || check.result.explanation}</p>
                  </section>
                )}
              </div>
              <section className="result-evidence-column" aria-label="Bukti dan sumber">
                <h2>Bukti dan sumber</h2>
                {check.result?.claims && check.result.claims.length > 0 && (
                  <ClaimsList claims={check.result.claims} sources={check.result.sources || []} />
                )}
                {check.result?.sources && check.result.sources.length > 0 && (
                  <SourcesList sources={check.result.sources} />
                )}
                {check.result && !check.result.claims?.length && !check.result.sources?.length && (
                  <p className="history-empty">Sumber bukti belum tersedia.</p>
                )}
                <div className="result-followup">
                  {check.transcript && <TranscriptView transcript={check.transcript} />}
                  {check.ocr && check.ocr.length > 0 && <OcrView ocrResults={check.ocr} />}

                  <section className="panel p-5" aria-label="Umpan balik pengguna">
                    <span className="eyebrow">Umpan Balik</span>
                    <h3 className="display-title mt-1 text-base">Apakah hasil analisis ini akurat?</h3>
                    {feedbackSent ? (
                      <p className="mt-2 text-sm font-semibold" style={{ color: "var(--verdict-true)" }}>
                        {feedbackSent}
                      </p>
                    ) : (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={feedbackSubmitting}
                            onClick={() => handleSendFeedback("accurate")}
                            className="btn-secondary text-xs"
                            style={{
                              minHeight: "40px",
                              background: feedbackRating === "accurate" ? "var(--verdict-true)" : undefined,
                              color: feedbackRating === "accurate" ? "#fff" : undefined,
                            }}
                          >
                            ✓ Akurat
                          </button>
                          <button
                            type="button"
                            disabled={feedbackSubmitting}
                            onClick={() => handleSendFeedback("inaccurate")}
                            className="btn-secondary text-xs"
                            style={{
                              minHeight: "40px",
                              background: feedbackRating === "inaccurate" ? "var(--verdict-false)" : undefined,
                              color: feedbackRating === "inaccurate" ? "#fff" : undefined,
                            }}
                          >
                            ✕ Keliru / Perlu Tinjauan
                          </button>
                        </div>
                        <label htmlFor="feedback-comment" className="sr-only">Catatan tambahan</label>
                        <input
                          id="feedback-comment"
                          type="text"
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          placeholder="Catatan opsional untuk auditor (tulis sebelum klik tombol di atas)..."
                          className="mt-3 w-full px-3 py-2 text-xs"
                          style={{ border: "2px solid var(--line)", background: "var(--sunken)" }}
                        />
                      </>
                    )}
                  </section>

                  <div className="panel result-actions">
                    <Link href="/" className="btn-secondary">Periksa yang lain</Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={handleDownloadJson} className="btn-secondary text-xs">
                        Ekspor JSON
                      </button>
                      <button type="button" onClick={handleDownloadCsv} className="btn-secondary text-xs">
                        Ekspor CSV
                      </button>
                      <button type="button" onClick={() => window.print()} className="btn-secondary text-xs">
                        Cetak / PDF
                      </button>
                      <button type="button" onClick={handleCopyLink} className="btn-secondary">
                        {copied ? "Tersalin!" : "Salin tautan"}
                      </button>
                      <button
                        type="button"
                        onClick={handleRecheck}
                        disabled={rechecking}
                        className="btn-primary"
                      >
                        {rechecking ? "Memeriksa ulang..." : "Periksa ulang"}
                      </button>
                    </div>
                  </div>

                  <p className="disclaimer">
                    Hasil dihasilkan oleh sistem otomatis dan dapat keliru. Periksa sumber yang dirujuk.
                  </p>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SourceHeader({ check, completed }: { check: CheckDetail; completed?: boolean }) {
  const when = completed ? check.completed_at || check.created_at : check.created_at;

  return (
    <section className="panel p-5 sm:p-6">
      <div
        className="flex flex-wrap items-center justify-between gap-2"
        style={{ borderBottom: "2px solid var(--line-soft)", paddingBottom: "0.75rem" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <PlatformBadge platform={check.platform} />
          <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
            {completed ? "Diperiksa" : "Dikirim"} {new Date(when).toLocaleString("id-ID")}
          </span>
        </div>
        <span className={`verdict-tag ${completed ? "verdict-true" : "verdict-pending"}`}>
          {completed ? "SELESAI" : "DIPROSES"}
        </span>
      </div>

      <div className="mt-3">
        <span className="eyebrow">Sumber</span>
        {check.source_url ? (
          <a
            href={check.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block truncate text-sm font-semibold underline"
          >
            {check.source_url}
          </a>
        ) : (
          <p className="mt-0.5 text-sm font-semibold">Masukan teks langsung</p>
        )}
      </div>

      {check.input_text && (
        <blockquote
          className="mt-4 p-3 text-sm leading-relaxed"
          style={{ border: "2px solid var(--line-soft)", background: "var(--sunken)" }}
        >
          &ldquo;{check.input_text}&rdquo;
        </blockquote>
      )}

      {check.media && (check.media.caption || check.media.author_handle) && (
        <div
          className="mt-4 p-3 text-xs"
          style={{ border: "2px solid var(--line-soft)", background: "var(--sunken)" }}
        >
          {check.media.author_handle && (
            <p className="font-semibold">Penulis: @{check.media.author_handle}</p>
          )}
          {check.media.caption && (
            <p className="mt-1 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              &ldquo;{check.media.caption}&rdquo;
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Derives the three pipeline stages from the check status and its recorded
 * events. Later stages imply earlier ones, so a single pass from the most
 * advanced signal outward keeps the stepper from ever showing a completed
 * analysis above a pending download.
 */
function computeSteps(c: CheckDetail) {
  const status = (c.status || "").toLowerCase();
  const events = c.progress?.steps || [];

  const eventStatus = (keywords: string[]) => {
    const found = events.find((e) =>
      keywords.some((k) => (e.stage || "").toLowerCase().includes(k))
    );
    return found ? (found.status || "").toLowerCase() : null;
  };

  const done = (s: string | null) => s === "succeeded" || s === "completed" || s === "success";

  const dl = eventStatus(["download"]);
  const ext = eventStatus(["extract", "ocr", "transcription"]);
  const ana = eventStatus(["analyze", "analysis"]);

  let download = "pending";
  if (done(dl) || ["extracting", "analyzing", "completed"].includes(status)) download = "succeeded";
  else if (dl === "started" || ["downloading", "queued"].includes(status)) download = "started";
  else if (status === "failed" && dl === "failed") download = "failed";

  let extract = "pending";
  if (done(ext) || ["analyzing", "completed"].includes(status)) extract = "succeeded";
  else if (ext === "started" || status === "extracting") extract = "started";
  else if (status === "failed" && ext === "failed") extract = "failed";

  let analyze = "pending";
  if (status === "completed" || done(ana)) analyze = "succeeded";
  else if (status === "analyzing" || ana === "started") analyze = "started";
  else if (status === "failed") analyze = "failed";

  // A failed stage must not leave a later stage looking finished.
  if (extract === "failed") analyze = "pending";
  if (download === "failed") {
    extract = "pending";
    analyze = "pending";
  }

  return [
    { name: "Mengunduh", status: download },
    { name: "Mengekstrak", status: extract },
    { name: "Menganalisis", status: analyze },
  ];
}
