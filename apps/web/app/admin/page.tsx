"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import BrutalistNavbar from "../components/BrutalistNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { getAdminOverview } from "../lib/api";
import type { AdminOverviewResponse } from "../lib/api";

export default function AdminPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminDashboard />
    </Suspense>
  );
}

function AdminDashboard() {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    getAdminOverview()
      .then((res) => {
        if (!active) return;
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal memuat data auditor");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleReload = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="shell">
      <BrutalistNavbar />

      <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="intake-kicker">Panel Auditor & Monitoring</p>
            <h1 className="display-title mt-1 text-3xl sm:text-4xl">Dasbor Evaluasi Sistem</h1>
          </div>
          <button type="button" onClick={handleReload} disabled={loading} className="btn-secondary">
            {loading ? "Memuat..." : "Muat ulang"}
          </button>
        </div>

        {error && (
          <div className="notice notice-error mb-6" role="alert">
            {error}
          </div>
        )}

        {loading && !data && <div className="history-empty">Memuat ringkasan analitik...</div>}

        {data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan statistik">
              <article className="panel p-5" style={{ background: "var(--yellow)" }}>
                <span className="eyebrow">Total Pemeriksaan</span>
                <p className="display-title mt-2 text-4xl">{data.totals.checks}</p>
                <p className="mt-1 text-xs font-semibold">
                  {data.totals.completed} selesai · {data.totals.failed} gagal
                </p>
              </article>

              <article className="panel p-5">
                <span className="eyebrow">Distribusi Vonis</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="verdict-tag verdict-true">BENAR: {data.totals.verdicts.true}</span>
                  <span className="verdict-tag verdict-false">HOAX: {data.totals.verdicts.false}</span>
                  <span className="verdict-tag verdict-mixed">
                    TIDAK PASTI: {data.totals.verdicts.unverified}
                  </span>
                </div>
              </article>

              <article className="panel p-5">
                <span className="eyebrow">Umpan Balik Masuk</span>
                <p className="display-title mt-2 text-4xl">{data.feedback.length}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                  {data.feedback.filter((f) => f.rating === "accurate").length} akurat ·{" "}
                  {data.feedback.filter((f) => f.rating === "inaccurate").length} keliru
                </p>
              </article>

              <article className="panel p-5">
                <span className="eyebrow">Buffer Data Latih FIFO</span>
                <p className="display-title mt-2 text-3xl">
                  {data.totals.training_data_rows.toLocaleString("id-ID")}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                  Kapasitas maks {data.totals.training_data_max.toLocaleString("id-ID")} baris
                </p>
              </article>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="panel p-6">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="display-title text-xl">Umpan Balik Pengguna</h2>
                  <span className="eyebrow">{data.feedback.length} item</span>
                </div>

                {data.feedback.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                    Belum ada umpan balik pengguna yang masuk.
                  </p>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
                    {data.feedback.map((item) => (
                      <div key={item.id} className="py-3" style={{ borderColor: "var(--line-soft)" }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`verdict-tag ${
                              item.rating === "accurate" ? "verdict-true" : "verdict-false"
                            }`}
                          >
                            {item.rating === "accurate" ? "AKURAT" : "KELIRU"}
                          </span>
                          <Link
                            href={`/checks/${item.check_id}`}
                            className="text-xs font-bold underline"
                          >
                            Buka pemeriksaan →
                          </Link>
                        </div>
                        {item.comment && (
                          <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                            &ldquo;{item.comment}&rdquo;
                          </p>
                        )}
                        <p className="mt-1 text-[11px]" style={{ color: "var(--ink-mute)" }}>
                          {new Date(item.created_at).toLocaleString("id-ID")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel p-6">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="display-title text-xl">Log Kegagalan Pemeriksaan</h2>
                  <span className="eyebrow">{data.errors.length} error</span>
                </div>

                {data.errors.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                    Tidak ada kegagalan pemeriksaan yang tercatat.
                  </p>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
                    {data.errors.map((err) => (
                      <div key={err.id} className="py-3" style={{ borderColor: "var(--line-soft)" }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="verdict-tag verdict-false">
                            {err.error_code || "ERROR"}
                          </span>
                          <Link href={`/checks/${err.id}`} className="text-xs font-bold underline">
                            Detail →
                          </Link>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold">{err.source_url}</p>
                        {err.error_message && (
                          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                            {err.error_message}
                          </p>
                        )}
                        <p className="mt-1 text-[11px]" style={{ color: "var(--ink-mute)" }}>
                          {new Date(err.created_at).toLocaleString("id-ID")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
