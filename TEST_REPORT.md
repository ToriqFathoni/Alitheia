# Laporan Pengujian Perangkat Lunak (Software Testing Report)
## Proyek Alitheia: Sistem Verifikasi Disinformasi Berbasis AI

* **Mata Kuliah:** Rekayasa Perangkat Lunak (RPL-02), Fakultas Ilmu Komputer, Universitas Indonesia
* **Kelompok:** 15
* **Anggota Tim:**
  * Clementheo Benaya Raya (NPM: 2406413810)
  * Toriq Fathoni Dezi (NPM: 2406487115)
  * Steven (NPM: 2406359600)
* **Dosen Pengampu:** Prof. Dr. Ir. Riri Fitri Sari MM MSc.
* **Tanggal Pelaksanaan:** 6 November 2026
* **Lingkungan Pengujian:** Node.js v22.11.0, TypeScript 5.7.2, Vitest v5.1.0, Node Test Runner, Windows 11 x64

---

## 1. Ringkasan Eksekutif (Executive Summary)

Pengujian perangkat lunak pada repositori Alitheia dilakukan secara otomatis melalui rangkaian Unit Testing dan Integration Testing yang mencakup seluruh lapisan sistem: validasi input dan mitigasi keamanan jaringan (Anti-SSRF), normalisasi data dan deduplikasi cache URL, orkestrasi model AI (LLM, RAG Few-Shot, dan real-time retrieval), serta ketahanan API terhadap kegagalan infrastruktur (graceful degradation).

### Ringkasan Statistik Pengujian

| Modul Pengujian | Framework / Runner | Jumlah Berkas Uji | Jumlah Test Case | Lulus (Passed) | Gagal (Failed) | Persentase Kelulusan |
|---|---|---|---|---|---|---|
| `apps/api` (Backend & AI Engine) | Vitest v5.1.0 | 8 berkas | 58 | 58 | 0 | 100% |
| `packages/database` (Data & URL Logic) | Node.js Test Runner (`tsx --test`) | 1 berkas (8 suites) | 33 | 33 | 0 | 100% |
| **Total Keseluruhan Monorepo** | **Monorepo Test Suite** | **9 berkas** | **91** | **91** | **0** | **100%** |

---

## 2. Rincian Kasus Pengujian per Modul

### 2.1 Modul API Backend dan AI Engine (`apps/api`)

Pengujian pada `apps/api` dieksekusi menggunakan framework **Vitest** dan mencakup 8 kelompok pengujian utama:

#### A. Proteksi Keamanan Jaringan dan Anti-SSRF (`url-validator.test.ts`)
* **Tujuan:** Memastikan sistem menolak segala bentuk manipulasi URL berbahaya yang berusaha mengakses jaringan intranet lokal atau metadata cloud instance.
* **Hasil: 25 Kasus Uji Lulus (Passed)**
  1. Penolakan alamat IP Loopback (`127.0.0.1`, `localhost`, `0.0.0.0`).
  2. Penolakan alamat IP Privat Kelas A (`10.0.0.0/8`).
  3. Penolakan alamat IP Privat Kelas B (`172.16.0.0/12` hingga `172.31.255.255`).
  4. Penolakan alamat IP Privat Kelas C (`192.168.0.0/16`).
  5. Penolakan alamat IP Cloud Metadata Provider AWS/GCP (`169.254.169.254`).
  6. Penolakan skema URL non-HTTP/HTTPS (misalnya `file://`, `ftp://`, `gopher://`).
  7. Validasi format sintaksis URL standar RFC 3986.
  8. Deteksi oEmbed YouTube untuk mendeteksi video fiktif atau telah dihapus (soft-404).
  9. Deteksi token sesi privat Instagram (`srtk`) untuk mencegah akses ke akun terkunci (HTTP 403).

#### B. Integrasi Endpoint REST API (`checks.test.ts`)
* **Tujuan:** Menguji kontrak rute `/api/v1/checks` saat menerima input teks, URL artikel, dan tautan media sosial.
* **Hasil: 9 Kasus Uji Lulus (Passed)**
  1. Penerimaan input teks bebas dan pengembalian respons HTTP 202 Accepted.
  2. Penerimaan input URL artikel berita dan pengembalian respons HTTP 202 Accepted.
  3. Penerimaan tautan media sosial (Instagram, TikTok, YouTube) dan pengembalian respons HTTP 202 Accepted tanpa galat server internal (500).
  4. Penolakan input kosong atau malformed dengan respons HTTP 400 Bad Request.
  5. Ketahanan sistem terhadap kegagalan database: tetap menerima kueri dan mengembalikan 202 menggunakan in-memory fallback ketika PostgreSQL offline.
  6. Pengambilan detail pengecekan (`GET /api/v1/checks/:id`) saat ID valid.
  7. Pengembalian respons HTTP 404 Not Found saat ID kueri tidak terdaftar.
  8. Paginasi riwayat kueri dengan parameter `page` dan `page_size`.
  9. Penapisan riwayat kueri berdasarkan status dan platform.

#### C. Klien LLM, Failover, dan Auto-Recovery (`llm-client.test.ts`)
* **Tujuan:** Menguji mekanisme pemanggilan model bahasa, penanganan kuota limit (HTTP 429), serta mekanisme pemulihan otomatis.
* **Hasil: 3 Kasus Uji Lulus (Passed)**
  1. Pemanggilan sukses ke provider utama Google Gemini dengan validasi skema JSON Zod.
  2. Deteksi rate limit (HTTP 429 / RESOURCE_EXHAUSTED), pengaktifan cooldown timer, dan otomatisasi failover ke provider sekunder 9Router (OpenAI-compatible).
  3. Mekanisme Safe Fallback: mengembalikan status netral `TIDAK_PASTI` dan skor 0.50 ketika seluruh penyedia LLM tidak dapat dihubungi.

#### D. Pencarian Bukti Web Terkini (`web-search.client.test.ts`)
* **Tujuan:** Menguji ekstraksi query pencarian dan integrasi feed berita real-time.
* **Hasil: 3 Kasus Uji Lulus (Passed)**
  1. Fungsi `buildSearchQuery`: pembersihan stop-words bahasa Indonesia dan isolasi 4 hingga 6 kata kunci substantif.
  2. Pengambilan dan parsing XML Google News RSS Indonesia untuk topik berita aktual.
  3. Penanganan timeout jaringan secara aman (abort signal) tanpa memblokir pipeline utama.

#### E. Buffer Data Latih Berkelanjutan FIFO (`fifo-training.test.ts`)
* **Tujuan:** Menguji penambahan data latih baru dan mekanisme pemangkasan First-In First-Out.
* **Hasil: 2 Kasus Uji Lulus (Passed)**
  1. Penyimpanan atomik baris data latih baru hasil prediksi AI.
  2. Penghapusan baris terlama secara otomatis saat total kapasitas melebihi batas konfigurasi (`MAX_TRAINING_DATA_ROWS = 5000`).

#### F. Integrasi Dataset CSV Lokal (`csv-loader.test.ts`)
* **Tujuan:** Menguji pemuatan dataset rujukan 7.282 berita hoaks/fakta ke dalam memori.
* **Hasil: 2 Kasus Uji Lulus (Passed)**
  1. Pembacaan dan parsing berkas `data/Data_latih.csv`.
  2. Pencarian contoh Few-Shot terdekat berdasarkan kemiripan token kata kunci saat database offline.

#### G. Pipeline Kueri Verifikasi Asinkron (`verification-pipeline.integration.test.ts`)
* **Tujuan:** Menguji alur hidup kueri dari pendaftaran antrean hingga status selesai.
* **Hasil: 6 Kasus Uji Lulus (Passed)**
  1. Pendaftaran job kueri ke antrean asinkron.
  2. Transisi status dari PENDING menuju PROCESSING hingga COMPLETED.
  3. Penanganan galat dan transisi ke status FAILED jika data tidak valid.

#### H. Unit Validasi URL Tambahan (`url-validator.test.ts`)
* **Tujuan:** Pengujian granular terhadap normalisasi karakter dan parsing host.
* **Hasil: 8 Kasus Uji Lulus (Passed)**

---

### 2.2 Modul Normalisasi Basis Data (`packages/database`)

Pengujian pada package `@alitheia/database` difokuskan pada integritas dan deduplikasi URL di berkas `src/utils/normalizeUrl.test.ts`. Modul ini sangat krusial untuk mencegah pemrosesan ulang berita yang sama (caching hit).

#### Hasil: 33 Kasus Uji Lulus (Passed) yang Terbagi dalam 7 Kategori:

1. **Normalisasi URL Dasar (7 Kasus Uji):**
   * Pembersihan parameter pelacak analitik (`utm_source`, `utm_medium`, `si`, `igshid`, `fbclid`).
   * Normalisasi hostname ke huruf kecil (lowercase).
   * Penghapusan prefix `www.` secara konsisten.
   * Penghapusan fragment anchor (`#section`).
   * Pengurutan alfabetis parameter kueri yang sah.
   * Pembersihan trailing slash pada root domain.
   * Penambahan protokol `https://` default untuk input tanpa protokol.
2. **Normalisasi URL Instagram (6 Kasus Uji):**
   * Ekstraksi dan standardisasi shortcode postingan (`/p/{id}/`).
   * Standardisasi tautan reels (`/reel/{id}/`).
   * Normalisasi bentuk jamak `/reels/` menjadi `/reel/`.
   * Konversi short-domain `instagr.am` menjadi `instagram.com`.
   * Normalisasi tautan IGTV (`/tv/` ke `/p/`).
   * Pembersihan parameter pelacak dinamis pada URL profil Instagram.
3. **Normalisasi URL TikTok (4 Kasus Uji):**
   * Standardisasi tautan video dengan username (`/@user/video/{id}`).
   * Standardisasi tautan video tanpa username.
   * Konversi domain mobile (`vt.tiktok.com`, `m.tiktok.com`).
   * Normalisasi tautan profil pengguna TikTok.
4. **Normalisasi URL Twitter dan X (5 Kasus Uji):**
   * Konversi domain `x.com` menjadi canonical `twitter.com`.
   * Ekstraksi ID status tweet (`/status/{id}`).
   * Pembersihan sub-path media tambahan (`/photo/1`).
   * Dukungan terhadap subdomain mobile (`mobile.twitter.com`).
   * Standardisasi format tautan internal `/i/status/{id}`.
5. **Deteksi Platform Otomatis (4 Kasus Uji):**
   * Klasifikasi akurat untuk platform Instagram, TikTok, Twitter/X, dan Berita Web Umum.
6. **Penanganan URL Tidak Sah / Malformed (3 Kasus Uji):**
   * Identifikasi URL valid vs tidak valid.
   * Pelemparan error terstruktur pada string yang tidak memenuhi format URL.
7. **Sifat Idempoten (Idempotency) (4 Kasus Uji):**
   * Memastikan pemanggilan fungsi normalisasi sebanyak dua kali atau lebih pada URL yang sama selalu menghasilkan output string yang 100% identik.

---

## 3. Analisis Hasil dan Kualitas Perangkat Lunak

Berdasarkan hasil pengujian di atas, sistem Alitheia memenuhi atribut kualitas perangkat lunak sebagai berikut:

1. **Keandalan dan Ketahanan (Reliability & Robustness):**
   * Sistem memiliki mekanisme *graceful degradation*: jika layanan pihak ketiga (LLM Gemini) mengalami pembatasan kuota, sistem secara mulus beralih ke penyedia cadangan (9Router) atau fallback aman `TIDAK_PASTI` tanpa memicu crash (Zero Unhandled Exception).
   * Jika basis data PostgreSQL lokal tidak aktif, backend tetap mampu merespons permintaan dan memproses verifikasi menggunakan buffer memori internal.
2. **Keamanan (Security by Design):**
   * Seluruh input tautan eksternal divalidasi secara ketat sebelum dilakukan pemanggilan jaringan, menutup celah keamanan Server-Side Request Forgery (SSRF) dan akses tidak sah ke jaringan privat.
3. **Efisiensi dan Performa:**
   * Waktu eksekusi 58 kasus uji pada modul API diselesaikan dalam waktu kurang dari 2 detik (1.83 detik), menunjukkan eksekusi kode yang efisien dan modular.
4. **Cakupan Pengujian (Test Coverage):**
   * 100% dari 91 skenario pengujian berhasil dilewati tanpa kegagalan (`0 Failed`).

---

## 4. Kesimpulan

Rangkaian pengujian unit dan integrasi yang telah dilaksanakan membuktikan bahwa logika bisnis, lapisan keamanan jaringan, modul orkestrasi kecerdasan buatan, dan penanganan data pada sistem Alitheia telah berfungsi sesuai dengan spesifikasi kebutuhan perangkat lunak yang didefinisikan pada dokumen proposal dan rencana arsitektur proyek.

