"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrutalistNavbar from "./BrutalistNavbar";
import { listChecks } from "../lib/api";
import type { CheckListItem } from "../lib/api";

const PAGE_SIZE = 20;

function inputLabel(item: CheckListItem) {
  const type = (item.input_type || "").toLowerCase();
  if (type.includes("text")) return { label: "TEKS", cls: "type-text" };
  if (type.includes("upload") || type.includes("file")) return { label: "UNGGAH", cls: "type-upload" };
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
];

export default function BrutalistHistory() {
  const router = useRouter();
  const [items, setItems] = useState<CheckListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [inputType, setInputType] = useState("");
  const [verdict, setVerdict] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listChecks({
        page: 1,
        page_size: PAGE_SIZE,
        q: search.trim() || undefined,
        platform: inputType || undefined,
        verdict: verdict || undefined,
      });
      setItems(response.data || []);
      setTotal(response.total || 0);
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Gagal memuat riwayat");
    } finally {
      setLoading(false);
    }
  }, [inputType, search, verdict]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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
              onChange={(event) => setSearch(event.target.value)}
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
                  onClick={() => setInputType(filter.value)}
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
              onChange={(event) => setVerdict(event.target.value)}
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
                <button
                  key={item.id}
                  type="button"
                  className="history-row"
                  onClick={() => router.push(`/checks/${item.id}`)}
                >
                  <span className={`type-tag ${type.cls}`}>{type.label}</span>
                  <span className="history-source" title={source}>{source}</span>
                  <span className={`verdict-tag ${result.cls}`}>{result.label}</span>
                  <span className="history-date">{formatDate(item.created_at)}</span>
                </button>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
