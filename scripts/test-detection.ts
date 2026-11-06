import { orchestratorService } from "../apps/api/src/modules/orchestrator/orchestrator.service.js";
import { countTrainingData } from "@alitheia/database";
import { env } from "../apps/api/src/config/env.js";

async function main() {
  console.log("==================================================================");
  console.log("ALITHEIA AI HOAX DETECTION TEST RUNNER");
  console.log("==================================================================");
  console.log(`Config:`);
  console.log(`- Gemini API Key: ${env.GEMINI_API_KEY ? "Tersedia (***)" : "Belum diisi (akan fallback ke 9Router/rule)"}`);
  console.log(`- Gemini Model: ${env.GEMINI_MODEL}`);
  console.log(`- 9Router Base URL: ${env.NINEROUTER_BASE_URL}`);
  console.log(`- Max Training Rows (FIFO): ${env.MAX_TRAINING_DATA_ROWS}`);
  console.log("------------------------------------------------------------------\n");

  const sampleTitle = process.argv[2] || "Laser dari termometer gun akan merusak struktur otak";
  const sampleText =
    process.argv[3] ||
    "Handgun termometer itu untuk memeriksa kabel panas, bukan untuk meriksa temperatur manusia. Dan kita mau terima! Coba bayangkan bagaimana mereka jual alat tapi kita dibodohi kepala kita ditembak laser, kita tidak tahu dampak kerusakan pada struktur otak.";

  console.log(`[Input Uji]`);
  console.log(`Judul : ${sampleTitle}`);
  console.log(`Narasi: ${sampleText}\n`);
  console.log("Sedang memproses verifikasi AI (RAG Few-Shot + LLM Calling)...");

  try {
    const startTime = Date.now();
    const result = await orchestratorService.verify({
      text: sampleText,
      title: sampleTitle,
      contentType: "PLAIN_TEXT",
    });
    const durationMs = Date.now() - startTime;

    console.log("\n==================================================================");
    console.log("HASIL DETEKSI AI");
    console.log("==================================================================");
    console.log(`Durasi Pemrosesan: ${durationMs} ms`);
    console.log(`Skor Kredibilitas: ${(result.credibilityScore * 100).toFixed(1)}%`);
    console.log(`Jumlah Klaim Teridentifikasi: ${result.claims.length}`);

    result.claims.forEach((claim, idx) => {
      const pred = claim.prediction;
      const badge =
        pred.hasilAkhir === "BENAR"
          ? "✅ FAKTA (BENAR)"
          : pred.hasilAkhir === "SALAH"
          ? "❌ HOAX (SALAH)"
          : "⚠️ TIDAK PASTI";

      console.log(`\n--- Klaim #${idx + 1} ---`);
      console.log(`Klaim     : "${claim.kalimatKlaim}"`);
      console.log(`Keputusan : ${badge}`);
      console.log(`Keyakinan : ${(pred.skorKepercayaan * 100).toFixed(1)}%`);
      console.log(`Penjelasan: ${pred.explanation}`);
      console.log(`Provider  : ${pred.metadataKonteks?.["provider"] || "n/a"} (${pred.metadataKonteks?.["model"] || "n/a"})`);

      if (claim.bukti && claim.bukti.length > 0) {
        console.log(`Bukti Rujukan:`);
        claim.bukti.forEach((b, bIdx) => {
          console.log(`  [${bIdx + 1}] (${b.asalBukti}) ${b.kutipan}`);
        });
      }
    });

    console.log("\n==================================================================");
    console.log("STATUS DATABASE & CONTINUOUS FIFO TRAINING");
    console.log("==================================================================");
    try {
      const totalRows = await countTrainingData();
      console.log(`Total Baris di Tabel data_latih_berita: ${totalRows} / ${env.MAX_TRAINING_DATA_ROWS}`);
      console.log(`Status FIFO: Berita input dan hasil prediksi telah otomatis disimpan ke DB.`);
      if (totalRows >= env.MAX_TRAINING_DATA_ROWS) {
        console.log(`Kapasitas penuh (${env.MAX_TRAINING_DATA_ROWS} baris). Baris tertua telah dihapus secara FIFO.`);
      }
    } catch (dbErr: any) {
      console.log(`Catatan Database: PostgreSQL belum aktif (${dbErr?.message || "Koneksi offline"}).`);
      console.log(`Hasil prediksi tetap berjalan normal menggunakan fallback in-memory.`);
    }
  } catch (error: any) {
    console.error("\nTerjadi galat saat pengujian:", error?.message || error);
  }
}

main();

