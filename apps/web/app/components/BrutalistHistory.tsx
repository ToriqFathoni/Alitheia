"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrutalistNavbar from "./BrutalistNavbar";
import { deleteCheck, listChecks } from "../lib/api";
import type { CheckListItem } from "../lib/api";

const PAGE_SIZE = 20;

function inputLabel(item: CheckListItem) {
  const type = (item.input_type || "").toLowerCase();
  if (type.includes("text")) return { label: "TEKS", cls: "type-text" };
  if (type.includes("doc") || type.includes("upload") || type.includes("file")) {
    return { label: "DOKUMEN", cls: "type-upload" };
  }
  return { label: "LINK", cls: "type-link" };
}

/**
 * Maps the stored verdict to a display tag.
 *
 * The database holds `True` / `False` / `Unverified` (and the newer analyzer
 * writes `Verified` / `Hoax`), so every spelling from both writers is matched
 * here. Anything else falls back to the processing state rather than
 * mislabelling a finished check as still running.
 */
function verdictTag(verdict?: string | null, status?: string) {
  const v = (verdict || "").toLowerCase().trim();

  if (["true", "real", "verified", "benar"].includes(v)) {
    return { label: "BENAR", cls: "verdict-true" };
  }
  if (["false", "hoax", "salah"].includes(v)) {
    return { label: "HOAX", cls: "verdict-false" };
  }
  if (["misleading", "sebagian", "mixed"].includes(v)) {
    return { label: "SEBAGIAN", cls: "verdict-mixed" };
  }
  if (["unverified", "tidak_pasti"].includes(v)) {
    return { label: "TIDAK PASTI", cls: "verdict-mixed" };
  }

  const s = (status || "").toLowerCase();
  if (s === "failed") return { label: "GAGAL", cls: "verdict-false" };
  return { label: "PROSES", cls: "verdict-pending" };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FILTERS = [
  { label: "Semua", value: "" },
  { label: "Teks", value: "text" },
  { label: "Link", value: "url" },
  { label: "Dokumen", value: "document" },
];

export default function BrutalistHistory() {
  const router = useRouter();
  const [items, setItems] = useState<CheckListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [inputType, setInputType] = useState("");
  const [verdict, setVerdict] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    let active = true;
    listChecks({
      page,
      page_size: PAGE_SIZE,
      q: search.trim() || undefined,
      input_type: inputType || undefined,
      verdict: verdict || undefined,
    })
      .then((response) => {
        if (!active) return;
        setItems(response.data || []);
        setTotal(response.total || 0);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Gagal memuat riwayat");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [inputType, page, search, verdict]);

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteCheck(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Gagal menghapus riwayat");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="shell">
      <BrutalistNavbar />

      <div className="history-grid history-page-grid">
        <section className="history-rail" aria-label="Filter riwayat">
          <p className="intake-kicker">Arsip verifikasi</p>
          <h1>Riwayat pemeriksaan</h1>

          <div className="history-field">
            <label htmlFor="history-search" className="sr-only">Cari riwayat</label>
            <input
              id="history-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Cari klaim atau link..."
            />
          </div>

          <div className="history-field">
            <span id="filter-type-label">Jenis input</span>
            <div className="filter-pills" role="group" aria-labelledby="filter-type-label">
              {FILTERS.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  aria-pressed={inputType === filter.value}
                  onClick={() => {
                    setInputType(filter.value);
                    setPage(1);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="history-field">
            <label htmlFor="history-verdict">Verdict</label>
            <select
              id="history-verdict"
              value={verdict}
              onChange={(event) => {
                setVerdict(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua hasil</option>
              {/* Values match the stored verdict strings exactly. */}
              <option value="True">Benar</option>
              <option value="False">Hoax</option>
              <option value="Unverified">Tidak pasti</option>
            </select>
          </div>

          <Link className="btn-primary" href="/">+ Pemeriksaan baru</Link>
        </section>

        <section className="history-list" aria-label="Daftar hasil pemeriksaan">
          <div className="history-list-head">
            <b>Semua pemeriksaan</b>
            <span>{total.toLocaleString("id-ID")} catatan</span>
          </div>

          {error && <div className="notice notice-error mt-4" role="alert">{error}</div>}

          {loading ? (
            <div className="history-empty">Memuat riwayat...</div>
          ) : items.length === 0 ? (
            <div className="history-empty">
              Belum ada pemeriksaan yang cocok.
            </div>
          ) : (
            items.map((item) => {
              const type = inputLabel(item);
              const result = verdictTag(item.verdict, item.status);
              const source = item.input_text || item.source_url || "(tanpa judul)";

              return (
                <div key={item.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className="history-row flex-1"
                    onClick={() => router.push(`/checks/${item.id}`)}
                  >
                    <span className={`type-tag ${type.cls}`}>{type.label}</span>
                    <span className="history-source" title={source}>{source}</span>
                    <span className={`verdict-tag ${result.cls}`}>{result.label}</span>
                    <span className="history-date">{formatDate(item.created_at)}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus riwayat ${source}`}
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id)}
                    className="btn-secondary shrink-0 px-3 text-xs"
                    style={{ minHeight: "auto" }}
                  >
                    {deletingId === item.id ? "..." : "Hapus"}
                  </button>
                </div>
              );
            })
          )}

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                className="btn-secondary text-xs"
                style={{ minHeight: "40px" }}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Sebelumnya
              </button>
              <span className="text-xs font-bold" style={{ color: "var(--ink-soft)" }}>
                Halaman {page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary text-xs"
                style={{ minHeight: "40px" }}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya →
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
