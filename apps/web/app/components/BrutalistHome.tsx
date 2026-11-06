"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BrutalistNavbar from "./BrutalistNavbar";
import { submitCheck, submitTextCheck } from "../lib/api";

const MAX_WORDS = 15000;
const SAMPLE_TEXT =
  "Eastbridge's electric bus pilot cut average commute times by 20% in its first year, and the city says ridership doubled across all routes since launch.";

type Mark = "text" | "link" | "upload";

function MarkIcon({ type }: { type: Mark }) {
  const glyph = type === "text" ? "T" : type === "link" ? "↗" : "↑";
  return <span aria-hidden="true" className="intake-mark">{glyph}</span>;
}

export default function BrutalistHome() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const overLimit = wordCount > MAX_WORDS;

  const fail = (msg: string) => {
    setIsError(true);
    setMessage(msg);
  };

  const handleSubmit = async () => {
    setMessage(null);

    // Link takes precedence: if both fields hold content the user most likely
    // pasted a URL last, and a URL check is the more specific request.
    if (url.trim()) {
      setSubmitting(true);
      try {
        const result = await submitCheck(url.trim());
        if (!result.id) throw new Error("Respons server tidak valid");
        router.push(`/checks/${result.id}`);
      } catch (error: unknown) {
        fail(error instanceof Error ? error.message : "Gagal memeriksa link");
        setSubmitting(false);
      }
      return;
    }

    if (text.trim()) {
      if (text.trim().length < 10) {
        fail("Masukkan minimal 10 karakter untuk diperiksa.");
        return;
      }
      if (overLimit) {
        fail(`Teks melebihi batas ${MAX_WORDS.toLocaleString("id-ID")} kata.`);
        return;
      }

      setSubmitting(true);
      try {
        const result = await submitTextCheck(text.trim());
        if (!result.id) throw new Error("Respons server tidak valid");
        router.push(`/checks/${result.id}`);
      } catch (error: unknown) {
        fail(error instanceof Error ? error.message : "Gagal memeriksa teks");
        setSubmitting(false);
      }
      return;
    }

    fail("Tempel teks atau masukkan link terlebih dahulu.");
  };

  return (
    <div className="shell home-shell">
      <BrutalistNavbar />

      <main>
        <div className="intake-grid">
          <section className="intake-hero" aria-labelledby="hero-title">
            <div className="intake-shape intake-shape-circle" aria-hidden="true" />
            <div className="intake-shape intake-shape-square" aria-hidden="true" />
            <div className="intake-shape intake-shape-bar" aria-hidden="true" />
            <div className="intake-hero-copy">
              <p className="intake-kicker">Ruang kerja verifikasi</p>
              <h1 id="hero-title">Benar atau hoax?</h1>
              <p>
                Tempel teks, masukkan link video, atau unggah dokumen. Kami telusuri
                klaim dan buktinya untuk Anda.
              </p>
            </div>
          </section>

          <section className="intake-panel" aria-label="Pilihan input pemeriksaan">
            <div className="intake-card" style={{ background: "var(--yellow)" }}>
              <div className="intake-card-heading">
                <MarkIcon type="text" />
                <b>1 · Teks</b>
              </div>
              <label className="sr-only" htmlFor="check-text">Teks berita</label>
              <textarea
                id="check-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Tempel kalimat berita di sini..."
              />
              <div className="intake-card-meta">
                {wordCount.toLocaleString("id-ID")} / {MAX_WORDS.toLocaleString("id-ID")} kata
              </div>
            </div>

            <div className="intake-card" style={{ background: "var(--green)" }}>
              <div className="intake-card-heading">
                <MarkIcon type="link" />
                <b>2 · Link</b>
              </div>
              <label className="sr-only" htmlFor="check-url">Link video atau artikel</label>
              <input
                id="check-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Tempel link TikTok, Instagram, YouTube, atau X"
              />
              <div className="intake-card-meta">Artikel dan media sosial didukung</div>
            </div>

            <div className="intake-card" style={{ background: "var(--coral)" }}>
              <div className="intake-card-heading">
                <MarkIcon type="upload" />
                <b>3 · Unggah</b>
              </div>
              {/* Upload is not wired to the API yet, so it is presented as
                  unavailable rather than silently accepting a file. */}
              <div className="intake-upload" aria-disabled="true">
                <span>
                  {fileName ?? "Unggah dokumen belum tersedia — gunakan teks atau link"}
                </span>
                <span className="intake-file-button" aria-hidden="true">Segera hadir</span>
                <input
                  id="check-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                  disabled
                  onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                />
              </div>
            </div>

            {message && (
              <div className={`notice ${isError ? "notice-error" : ""}`} role="alert">
                {message}
              </div>
            )}

            <button
              type="button"
              className="btn-primary w-full text-lg"
              onClick={handleSubmit}
              disabled={submitting || overLimit}
            >
              {submitting ? "Sedang memeriksa..." : "Periksa sekarang →"}
            </button>

            <button
              type="button"
              className="intake-sample"
              onClick={() => {
                setText(SAMPLE_TEXT);
                setUrl("");
                setMessage(null);
              }}
            >
              Isi contoh klaim
            </button>
          </section>
        </div>

        <div className="ticker" aria-hidden="true">
          <div>
            TEKS · LINK · PERIKSA KLAIM · CARI BUKTI · TEKS · LINK · PERIKSA KLAIM · CARI BUKTI ·
          </div>
        </div>
      </main>
    </div>
  );
}
