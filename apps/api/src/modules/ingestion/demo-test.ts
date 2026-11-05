import { inspectUrl } from "./url-validator.js";

async function run() {
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.log("=================================================================");
    console.log("ALITHEIA URL INSPECTOR CLI TESTER");
    console.log("=================================================================");
    console.log("Cara pakai: npx tsx apps/api/src/modules/ingestion/demo-test.ts <URL>");
    console.log("Contoh:");
    console.log("  1. Link Berita   : npx tsx apps/api/src/modules/ingestion/demo-test.ts https://news.detik.com");
    console.log("  2. Link TikTok   : npx tsx apps/api/src/modules/ingestion/demo-test.ts https://www.tiktok.com/@kompas/video/123");
    console.log("  3. Link YouTube  : npx tsx apps/api/src/modules/ingestion/demo-test.ts https://youtu.be/dQw4w9WgXcQ");
    console.log("  4. Link Hapus/404: npx tsx apps/api/src/modules/ingestion/demo-test.ts https://example.com/halaman-tidak-ada-404");
    console.log("  5. Cek Anti-SSRF : npx tsx apps/api/src/modules/ingestion/demo-test.ts http://localhost:5000");
    console.log("=================================================================\n");
    console.log("▶ Menjalankan pengujian otomatis dengan sampel default (Kompas.com):");
  }

  const url = targetUrl || "https://www.kompas.com";
  console.log(`\n[Input URL]: ${url}`);
  console.log("Sedang memvalidasi format, anti-SSRF, mendeteksi platform, dan probing jaringan...\n");

  const start = Date.now();
  const result = await inspectUrl(url);
  const duration = Date.now() - start;

  console.log("HASIL INSPEKSI:");
  console.log("-----------------------------------------------------------------");
  console.log(`Valid           : ${result.isValid ? "✅ YA" : "❌ TIDAK"}`);
  console.log(`Status          : ${result.status}`);
  if (result.httpStatusCode) {
    console.log(`HTTP Status     : ${result.httpStatusCode}`);
  }
  console.log(`Pesan           : ${result.message}`);

  if (result.detection) {
    console.log(`Platform        : ${result.detection.platformName} (${result.detection.platform})`);
    console.log(`Tipe Konten     : ${result.detection.contentType}`);
    console.log(`Media Sosial?   : ${result.detection.isSocialMedia ? "Ya" : "Bukan"}`);
    console.log(`Video?          : ${result.detection.isVideo ? "Ya" : "Bukan"}`);
  }

  if (result.finalRedirectUrl && result.finalRedirectUrl !== url) {
    console.log(`Tujuan Redirect : ${result.finalRedirectUrl}`);
  }

  console.log(`Waktu Eksekusi  : ${duration} ms`);
  console.log("-----------------------------------------------------------------\n");
}

run();

