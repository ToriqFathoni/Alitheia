# Alitheia: Sistem Verifikasi Disinformasi dan Deteksi Berita Bohong Berbasis AI

Alitheia adalah platform verifikasi silang otomatis yang dirancang untuk memvalidasi kebenaran klaim faktual dalam berita daring, media sosial, dan teks bebas. Sistem ini beroperasi menyerupai alur kerja investigasi redaksional jurnalistik: mengekstrak klaim spesifik, mencari bukti rujukan dari sumber kredibel secara langsung, membandingkan logika klaim terhadap bukti melalui Natural Language Inference (NLI), dan menyajikan laporan transparansi lengkap beserta tautan sumber rujukan asli.

Proyek ini dikembangkan dalam rangka mata kuliah Rekayasa Perangkat Lunak (RPL-02), Fakultas Ilmu Komputer, Universitas Indonesia.

---

## 1. Anggota Tim dan Pembagian Peran

Kelompok 15:

| No | Nama | NPM | Peran Utama | Tanggung Jawab |
|---|---|---|---|---|
| 1 | Clementheo Benaya Raya | 2406413810 | UI/UX Designer dan Frontend Developer | Perancangan antarmuka, implementasi komponen web Next.js, dan visualisasi explainability UI. |
| 2 | Toriq Fathoni Dezi | 2406487115 | Backend Developer dan Database Administrator | Perancangan REST API, orkestrasi arsitektur database PostgreSQL dan Redis, serta mitigasi keamanan Anti-SSRF. |
| 3 | Steven | 2406359600 | AI/ML Engineer dan QA/Test Engineer | Pengembangan model orkestrasi AI, integrasi LLM dan retrieval web, otomatisasi pipeline media worker, dan pengujian perangkat lunak. |

Dosen Pengampu: Prof. Dr. Ir. Riri Fitri Sari MM MSc.

---

## 2. Arsitektur Sistem dan Teknologi

Alitheia dibangun dengan pola arsitektur Monorepo terdistribusi menggunakan Turborepo, memisahkan lapisan presentasi, logika backend API, manajemen database, dan pemrosesan media asinkron.

### 2.1 Tumpukan Teknologi (Technology Stack)

* **Lapisan Antarmuka (Frontend):** Next.js 16 (App Router, Turbopack, React 19, TypeScript, Tailwind CSS, Lucide Icons).
* **Lapisan Layanan API (Backend):** Node.js 22, Express.js, TypeScript, Zod Schema Validation, @mozilla/readability, JSDOM.
* **Lapisan Data dan Penyimpanan:** PostgreSQL 16 (dengan ekstensi pgvector), Prisma ORM 5.22, Redis 7 (caching dan antrean pekerjaan).
* **Lapisan Pemrosesan Media (Worker):** Python 3.11, yt-dlp, FFmpeg, Whisper Speech-to-Text, Tesseract OCR.
* **Lapisan Kecerdasan Buatan (AI Engine):** Google Gemini API (gemini-2.5-flash / gemini-3.5-flash), Failover Gateway 9Router (OpenAI-compatible), RAG Few-Shot Learning berbasis dataset lokal (7.282 baris data latih), serta Real-time Retrieval melalui Google News RSS Indonesia dan Wikipedia API.
* **Kontainerisasi dan Eksekusi:** Docker, Docker Compose.
* **Pengujian (Testing):** Vitest, Node Test Runner, TypeScript strict compiler checking.

### 2.2 Struktur Monorepo

```text
alitheia-monorepo/
├── apps/
│   ├── api/                     # Layanan REST API utama (Express.js + TypeScript)
│   │   ├── src/
│   │   │   ├── config/          # Validasi environment dan konfigurasi runtime
│   │   │   ├── middleware/      # Rate limiter, CORS, request ID, error handler
│   │   │   ├── modules/
│   │   │   │   ├── ingestion/   # Validasi URL, Anti-SSRF, article extractor
│   │   │   │   ├── orchestrator/# Mesin AI: LLM client, web search, few-shot RAG
│   │   │   │   └── verification/# Router kueri verifikasi dan repositori
│   │   │   ├── routes/          # Endpoint /checks dan penanganan input
│   │   │   └── services/        # Klien antrean Redis dan manajemen koneksi
│   │   └── package.json
│   └── web/                     # Antarmuka web pengguna (Next.js 16)
│       ├── app/
│       │   ├── checks/[id]/     # Halaman detail hasil analisis dan progres
│       │   ├── history/         # Halaman riwayat pengecekan
│       │   ├── components/      # Komponen antarmuka (Brutalist theme, stepper, kartu vonis)
│       │   └── lib/             # Klien fetch API dan parser error
│       └── package.json
├── data/
│   └── Data_latih.csv           # Dataset rujukan 7.282 berita hoaks dan fakta historis
├── packages/
│   ├── config/                  # Konfigurasi ESLint dan TypeScript terpusat
│   ├── database/                # Skema Prisma, repositori data latih FIFO, migrasi
│   └── shared-types/            # Kontrak tipe TypeScript dan skema Zod terpusat
├── plan/                        # Dokumen arsitektur, panduan agent, skema, dan roadmap
├── scripts/                     # Skrip utilitas pengujian AI dan evaluasi
├── services/
│   └── worker/                  # Python worker untuk download media, Whisper STT, OCR
├── docker-compose.yml           # Konfigurasi kontainer PostgreSQL, Redis, API, Worker, Web
├── package.json                 # Konfigurasi workspace Turborepo induk
├── turbo.json                   # Pipeline build, test, dev Turborepo
└── README.md                    # Dokumentasi utama proyek
```

---

## 3. Fitur Utama Perangkat Lunak

1. **Multi-Format Content Ingestion:**
   * **Input Teks Bebas:** Menerima narasi hingga 15.000 kata untuk analisis instan.
   * **Input Artikel Daring:** Mengekstrak judul, metadata OpenGraph, dan tubuh teks berita secara bersih dari berbagai portal media daring.
   * **Input Tautan Media Sosial:** Mendukung tautan video dan postingan dari YouTube, TikTok, Instagram, dan X (Twitter).
2. **Keamanan Jaringan Berlapis (Multi-Layer Anti-SSRF):**
   * Memblokir permintaan ke alamat IP privat (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.1, localhost), serta alamat metadata penyedia komputasi awan (169.254.169.254).
   * Deteksi cerdas oEmbed YouTube untuk menolak tautan fiktif/terhapus (HTTP 404).
   * Deteksi parameter token privat Instagram untuk menolak akun yang terkunci (HTTP 403).
3. **Orkestrasi AI dengan Real-Time Grounding:**
   * Ekstraksi klaim faktual objektif dengan memisahkan opini dan retorika.
   * Penarikan berita terkini via Google News RSS Indonesia untuk memverifikasi peristiwa aktual yang terjadi pada tanggal berjalan.
   * Penggunaan 7.282 baris data latih historis berbasis Few-Shot Prompting untuk mengenali pola hoaks berulang.
4. **Resiliensi dan Mekanisme Failover Mandiri:**
   * Otomatis berpindah dari Google Gemini ke gateway sekunder (9Router) jika kuota API habis (HTTP 429).
   * Auto-recovery kembali ke Gemini ketika masa cooldown rate limit berakhir.
   * Graceful in-memory fallback ketika koneksi basis data atau kontainer Docker sedang tidak aktif, sehingga API tetap melayani kueri tanpa terhenti.
5. **Continuous Learning Buffer (FIFO):**
   * Menyimpan hasil verifikasi baru ke tabel `data_latih_berita` dengan batasan kapasitas 5.000 baris. Baris tertua dihapus otomatis secara atomik saat kapasitas penuh.
6. **Antarmuka Transparan (Explainability Dashboard):**
   * Visualisasi vonis berkode warna tegas: True (Hijau), False (Merah), atau Unverified (Kuning).
   * Rincian per klaim, skor keyakinan matematis (confidence score), penjelasan logika kesimpulan, serta daftar tautan rujukan sumber berita asli.

---

## 4. Alur Kerja Pemrosesan (Pipeline Flow)

```text
[Input Pengguna: Teks / URL]
        │
        ▼
[1. Ingestion & Anti-SSRF Validation]
   - Validasi sintaks URL dan resolusi DNS
   - Pencegahan akses intranet (Anti-SSRF)
   - Deteksi platform (Web, YouTube, TikTok, IG, X)
        │
        ▼
[2. Content Extraction]
   - Web / Teks: Ekstraksi teks Readability + OpenGraph
   - Video / Medsos: Metadata capture + delegasi worker media
        │
        ▼
[3. AI Verification Orchestrator]
   - Parallel Retrieval:
     ├── Google News RSS Indonesia (Berita Terkini)
     ├── Wikipedia Bahasa Indonesia
     └── RAG Few-Shot dari Basis Pengetahuan Historis
   - LLM Reasoning (Gemini / Failover 9Router):
     └── Klaim Faktual, NLI Stance, Skor Kepercayaan, Rujukan
        │
        ▼
[4. Persistence & Continuous Buffer]
   - Penyimpanan atomik ke tabel checks dan sources
   - Pendaftaran ke tabel data_latih_berita via antrean FIFO
        │
        ▼
[5. Explainability Presentation]
   - Penyajian hasil verifikasi interaktif pada dasbor web Next.js
```

---

## 5. Prasyarat Sistem

Sebelum menjalankan proyek di komputer lokal, pastikan perangkat lunak berikut telah terpasang:

* **Node.js:** Versi 20.x atau 22.x LTS
* **npm:** Versi 9.x atau 10.x
* **Docker Desktop:** Versi 24.x ke atas (dengan plugin Docker Compose v2)
* **Git:** Versi 2.30 ke atas
* **Python (Opsional untuk worker media lokal):** Versi 3.10 atau 3.11

---

## 6. Panduan Instalasi dan Menjalankan Proyek

### 6.1 Kloning Repositori

```powershell
git clone https://github.com/ToriqFathoni/Alitheia.git
cd Alitheia
```

### 6.2 Konfigurasi Environment Variables

Salin template konfigurasi `.env.example` menjadi `.env`:

```powershell
copy .env.example .env
```

Buka file `.env` dan lengkapi konfigurasi utama:

```env
NODE_ENV=development
PORT=5000
WEB_PORT=3000
LOG_LEVEL=debug

CORS_ORIGINS=http://localhost:3000

# PostgreSQL port 5431 digunakan untuk menghindari bentrok dengan servis PostgreSQL lokal Windows (5432)
DATABASE_URL="postgresql://alitheia:alitheia_secret@localhost:5431/alitheia?schema=public"
REDIS_URL="redis://localhost:6379"

JWT_SECRET="alitheia-dev-secret-key-change-in-production-min-32-chars"
MAX_INPUT_WORDS=15000
EXTERNAL_TIMEOUT_MS=15000

# Konfigurasi Provider AI Gemini (Dapatkan gratis di https://aistudio.google.com)
GEMINI_API_KEY="masukkan_api_key_gemini_anda_di_sini"
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_RATE_LIMIT_COOLDOWN_MS=60000

# Konfigurasi Cadangan 9Router (Opsional)
NINEROUTER_BASE_URL="http://localhost:20128/v1"
NINEROUTER_API_KEY=""
NINEROUTER_MODEL="gpt-4o-mini"

MAX_TRAINING_DATA_ROWS=5000
```

### 6.3 Menjalankan Layanan Basis Data (Docker)

Jalankan kontainer PostgreSQL (dengan pgvector) dan Redis:

```powershell
docker compose up -d postgres redis
```

Pastikan status kontainer berjalan sehat:

```powershell
docker compose ps
```

### 6.4 Instalasi Dependensi Node.js

Pasang seluruh dependensi workspace monorepo:

```powershell
npm install
```

### 6.5 Migrasi dan Sinkronisasi Skema Basis Data

Sinkronkan model database Prisma ke PostgreSQL:

```powershell
npx prisma db push --schema=packages/database/prisma/schema.prisma
```

Lakukan build pada workspace database agar Prisma Client tergenerasi:

```powershell
npm run build --workspace=@alitheia/database
```

### 6.6 Menjalankan Aplikasi pada Mode Pengembangan

Jalankan seluruh layanan aplikasi (Next.js web dan Express API) secara bersamaan menggunakan Turborepo:

```powershell
npm run dev
```

Aplikasi dapat diakses melalui browser:
* **Frontend Web Application:** `http://localhost:3000`
* **Backend REST API Health Check:** `http://localhost:5000/api/v1/health`

---

## 7. Perintah dan Skrip Pengujian

Proyek ini dilengkapi dengan rangkaian pengujian unit dan integrasi otomatis yang ketat:

### 7.1 Menjalankan Seluruh Pengujian Monorepo

```powershell
npm test
```

### 7.2 Menjalankan Pengujian Spesifik API

Menguji modul validasi URL, proteksi Anti-SSRF, inferensi failover LLM, integrasi retrieval web, antrean FIFO, dan endpoint rute:

```powershell
npm run test --workspace=api
```

### 7.3 Menjalankan Pengujian Normalisasi URL Database

```powershell
npm run test --workspace=@alitheia/database
```

### 7.4 Melakukan Kompilasi Penuh (Production Build)

```powershell
npm run build
```

### 7.5 Menjalankan Pengujian Mandiri AI melalui CLI

Untuk menguji performa model AI secara langsung di terminal tanpa membuka browser:

```powershell
npx tsx scripts/test-detection.ts "Judul Berita Uji" "Kalimat narasi klaim yang ingin diverifikasi"
```

---

## 8. Ringkasan Endpoint REST API

| Metode | Endpoint | Deskripsi | Status Respons |
|---|---|---|---|
| `GET` | `/api/v1/health` | Pemeriksaan kesehatan layanan API backend | 200 OK |
| `POST` | `/api/v1/checks` | Mengajukan klaim verifikasi baru (mendukung URL dan teks bebas) | 202 Accepted |
| `GET` | `/api/v1/checks` | Mengambil riwayat verifikasi dengan paginasi dan filter | 200 OK |
| `GET` | `/api/v1/checks/:id` | Mengambil detail progres, status, klaim, dan rujukan verifikasi | 200 OK / 404 Not Found |
| `DELETE` | `/api/v1/checks/:id` | Menghapus riwayat verifikasi berdasarkan ID | 204 No Content |
| `POST` | `/api/v1/verifications` | Endpoint alternatif pemrosesan kueri verifikasi (SCRUM-62) | 202 Accepted |

---

## 9. Kebijakan Keamanan dan Responsible AI

1. **Anti-Hallucination Guardrails:**
   * Setiap klaim yang dinyatakan salah atau benar wajib merujuk pada artikel atau publikasi resmi yang ditarik dari hasil pencarian web terverifikasi atau basis data pemeriksa fakta.
   * Jika tidak ditemukan bukti yang cukup kuat dari domain kredibel, sistem menetapkan vonis netral `TIDAK_PASTI` alih-alih berspekulasi.
2. **Mitigasi Serangan Injeksi Prompt:**
   * Seluruh teks yang berasal dari pengguna maupun dokumen eksternal diisolasi dalam tag penanda data pasif, sehingga instruksi sistem inti tidak dapat dimanipulasi oleh konten berbahaya.
3. **Privasi Pengguna:**
   * Konten teks yang dimasukkan pengguna hanya diproses untuk tujuan ekstraksi klaim dan verifikasi fakta, serta tidak digunakan untuk pelatihan ulang model publik pihak ketiga secara tidak sah.

---

## 10. Lisensi

Hak Cipta (c) 2026 Tim Proyek Alitheia (Kelompok 15, RPL-02 Teknik Komputer UI).
Didistribusikan untuk keperluan akademik dan pengembangan perangkat lunak terbuka.

