import type { Metadata } from "next";
import Link from "next/link";
import BrutalistNavbar from "../components/BrutalistNavbar";

export const metadata: Metadata = {
  title: "Metodologi | Alitheia",
  description:
    "Penjelasan alur kerja verifikasi fakta otomatis, sumber bukti, cara membaca skor keyakinan, dan batasan sistem Alitheia.",
};

const PIPELINE_STEPS = [
  {
    number: "01",
    title: "Validasi & Ekstraksi Konten",
    accent: "var(--yellow)",
    body: "Teks, tautan berita, tautan media sosial, atau dokumen yang dikirim dibersihkan dan diperiksa keamanannya (termasuk proteksi Anti-SSRF untuk memblokir alamat jaringan lokal/privat).",
  },
  {
    number: "02",
    title: "Penarikan Bukti Paralel",
    accent: "var(--green)",
    body: "Sistem mengekstrak klaim faktual dan mencari bukti pembanding secara paralel dari Google News RSS Indonesia, Wikipedia bahasa Indonesia, serta basis data rujukan historis (7.282 contoh kasus).",
  },
  {
    number: "03",
    title: "Inferensi NLI & Penilaian",
    accent: "var(--blue)",
    body: "Model bahasa membandingkan klaim terhadap bukti yang ditemukan untuk menilai apakah bukti mendukung (entailment), membantah (contradiction), atau netral, lalu menghitung tingkat keyakinan.",
  },
  {
    number: "04",
    title: "Transparansi & Rujukan",
    accent: "var(--coral)",
    body: "Hasil disajikan bersama penjelasan ringkas, daftar klaim terpisah, dan tautan sumber asli agar pengguna dapat memverifikasi ulang secara mandiri.",
  },
];

const VERDICTS = [
  {
    label: "BENAR",
    cls: "verdict-true",
    desc: "Klaim didukung oleh bukti dari sumber berita atau rujukan kredibel yang relevan.",
  },
  {
    label: "HOAX",
    cls: "verdict-false",
    desc: "Klaim bertentangan dengan bukti faktual atau telah dibantah oleh laporan pemeriksa fakta/media terpercaya.",
  },
  {
    label: "SEBAGIAN",
    cls: "verdict-mixed",
    desc: "Konten memuat campuran informasi yang benar dan keliru, atau konteksnya menyesatkan.",
  },
  {
    label: "TIDAK PASTI",
    cls: "verdict-pending",
    desc: "Bukti yang ditemukan belum cukup kuat atau saling bertentangan. Sistem memilih netral daripada menebak.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="shell">
      <BrutalistNavbar />

      <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
        <section className="panel p-6 sm:p-10" style={{ background: "var(--yellow)" }}>
          <p className="intake-kicker">Transparansi Verifikasi</p>
          <h1 className="display-title mt-2 text-3xl sm:text-5xl">
            Bagaimana Alitheia bekerja?
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: "var(--ink)" }}>
            Alitheia dirancang sebagai alat bantu verifikasi silang otomatis yang meniru
            alur investigasi jurnalistik, bukan penentu kebenaran mutlak. Setiap kesimpulan
            disertai tingkat keyakinan dan tautan bukti agar Anda tetap memegang kendali akhir.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="pipeline-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="pipeline-heading" className="display-title text-2xl">
              Alur Pemrosesan 4 Tahap
            </h2>
            <span className="eyebrow">Claim-Evidence Pipeline</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {PIPELINE_STEPS.map((step) => (
              <article key={step.number} className="panel p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center text-sm font-bold"
                    style={{
                      background: step.accent,
                      color: step.accent === "var(--blue)" || step.accent === "var(--coral)" ? "#fff" : "var(--ink)",
                      border: "2px solid var(--line)",
                    }}
                  >
                    {step.number}
                  </span>
                  <h3 className="display-title text-lg">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="verdict-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="verdict-heading" className="display-title text-2xl">
              Arti Label Vonis & Skor Keyakinan
            </h2>
            <span className="eyebrow">Skala 0% - 100%</span>
          </div>

          <div className="panel divide-y" style={{ borderColor: "var(--line-soft)" }}>
            {VERDICTS.map((item) => (
              <div
                key={item.label}
                className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5"
                style={{ borderColor: "var(--line-soft)" }}
              >
                <span className={`verdict-tag shrink-0 self-start sm:self-center ${item.cls}`}>
                  {item.label}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Batasan dan Privasi">
          <article className="panel p-6">
            <span className="eyebrow">Batasan Sistem</span>
            <h2 className="display-title mt-2 text-xl">Disclaimer</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              <li>Hasil analisis bersifat probabilistik berdasarkan bukti daring yang berhasil ditemukan saat pemeriksaan berlangsung.</li>
              <li>Peristiwa yang baru terjadi beberapa menit lalu mungkin belum terindeks oleh media arus utama sehingga sistem dapat memberikan status Tidak Pasti.</li>
              <li>Untuk tautan video media sosial yang tidak memiliki deskripsi lengkap, salin transkrip atau ringkasan klaim ke kolom Teks untuk hasil lebih akurat.</li>
            </ul>
          </article>

          <article className="panel p-6">
            <span className="eyebrow">Kebijakan Data</span>
            <h2 className="display-title mt-2 text-xl">Privasi Pengguna</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              <li>Teks dan tautan yang dikirim hanya digunakan untuk menjalankan proses verifikasi klaim dan menampilkan riwayat pemeriksaan.</li>
              <li>Sistem menerapkan perlindungan Anti-SSRF dan pemisahan data pasif untuk mencegah injeksi instruksi pada model AI.</li>
              <li>Anda dapat menghapus riwayat pemeriksaan kapan saja melalui halaman Riwayat.</li>
            </ul>
          </article>
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="btn-primary">
            Mulai Pemeriksaan →
          </Link>
          <Link href="/history" className="btn-secondary">
            Lihat Riwayat
          </Link>
        </div>
      </main>
    </div>
  );
}
