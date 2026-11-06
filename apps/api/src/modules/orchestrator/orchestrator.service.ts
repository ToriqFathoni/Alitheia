import fs from "node:fs";
import path from "node:path";
import {
  findRelevantTrainingExamples,
  insertTrainingDataFifo,
  type TrainingDataExample,
} from "@alitheia/database";
import type {
  VerificationOrchestrator,
  ExtractedContent,
  VerificationResult,
  OrchestratedClaim,
  ClaimEvidenceItem,
  ClaimPredictionResult,
} from "./orchestrator.types.js";
import { ensureTrainingDataSeeded } from "./csv-loader.js";
import { llmClient } from "./llm/llm-client.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

export class OrchestratorService implements VerificationOrchestrator {
  private promptTemplateCache: string | null = null;
  private seedChecked = false;

  /**
   * Membaca file template prompt terversi (v1) secara aman.
   */
  private getPromptTemplate(): string {
    if (this.promptTemplateCache) {
      return this.promptTemplateCache;
    }

    const candidatePaths = [
      path.resolve(process.cwd(), "src/modules/orchestrator/prompts/hoax-detection.v1.md"),
      path.resolve(process.cwd(), "apps/api/src/modules/orchestrator/prompts/hoax-detection.v1.md"),
      path.resolve(process.cwd(), "prompts/hoax-detection.v1.md"),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        this.promptTemplateCache = fs.readFileSync(p, "utf-8");
        return this.promptTemplateCache;
      }
    }

    throw new Error("File prompt prompts/hoax-detection.v1.md tidak ditemukan di filesystem.");
  }

  /**
   * Memformat daftar contoh data latih historis menjadi teks Few-Shot untuk prompt LLM.
   */
  private formatFewShotExamples(examples: TrainingDataExample[]): string {
    if (examples.length === 0) {
      return "Tidak ada contoh historis yang tersedia.";
    }

    return examples
      .map((ex, idx) => {
        const labelText = ex.label === 1 ? "HOAX (SALAH / TIDAK AKURAT)" : "FAKTA (BENAR / AKURAT)";
        const snippet = ex.narasi.length > 250 ? ex.narasi.slice(0, 250) + "..." : ex.narasi;
        return `[Contoh #${idx + 1}]
Judul: ${ex.judul}
Ringkasan Narasi: ${snippet}
Klasifikasi: ${labelText} (Skor Keyakinan: ${ex.skorKepercayaan.toFixed(2)})`;
      })
      .join("\n\n");
  }

  /**
   * Eksekusi pipeline verifikasi AI:
   * 1. Cek & pastikan data latih awal sudah di-seed.
   * 2. Ambil contoh Few-Shot yang paling relevan dari database.
   * 3. Panggil LLM API (Gemini -> fallback 9Router).
   * 4. Bentuk hasil verifikasi probabilistik dan bukti rujukan.
   * 5. Simpan output ke database sebagai data latih baru dengan antrean FIFO (maks. 5.000 baris).
   */
  async verify(content: ExtractedContent): Promise<VerificationResult> {
    const rawText = content.text.trim();
    const title = content.title || "Berita Masukan";
    const sourceDomain = content.sourceUrl ? new URL(content.sourceUrl).hostname : "sumber.online";

    // 1. Pastikan database data latih sudah ter-seed dari CSV jika tabel kosong
    if (!this.seedChecked) {
      await ensureTrainingDataSeeded();
      this.seedChecked = true;
    }

    // 2. Ambil contoh Few-Shot terdekat dari database
    let fewShotExamples: TrainingDataExample[] = [];
    try {
      fewShotExamples = await findRelevantTrainingExamples(rawText, 8);
    } catch (dbError) {
      logger.warn({ dbError }, "[OrchestratorService] Gagal mengambil contoh few-shot dari DB. Lanjut tanpa RAG.");
    }

    // 3. Susun prompt dengan template
    const template = this.getPromptTemplate();
    const formattedExamples = this.formatFewShotExamples(fewShotExamples);
    const finalPrompt = template
      .replace("{{FEW_SHOT_EXAMPLES}}", formattedExamples)
      .replace("{{INPUT_TITLE}}", title)
      .replace("{{INPUT_TEXT}}", rawText);

    // 4. Panggil LLM (Gemini dengan failover ke 9Router dan auto-recovery)
    const { result: llmOutput, meta } = await llmClient.verifyWithLlm(finalPrompt);

    logger.info(
      {
        provider: meta.provider,
        model: meta.model,
        label: llmOutput.label,
        confidence: llmOutput.confidence,
        durationMs: meta.durationMs,
      },
      "[OrchestratorService] Inferensi LLM selesai dieksekusi."
    );

    // 5. Susun bukti rujukan (Evidence)
    const evidenceList: ClaimEvidenceItem[] = [];

    // Tambahkan referensi dari data latih DB yang selaras
    for (const ex of fewShotExamples.slice(0, 3)) {
      evidenceList.push({
        asalBukti: "VECTOR_DB",
        urlRujukan: content.sourceUrl || "https://alitheia.internal/knowledge-base",
        kutipan: `[Basis Pengetahuan #${ex.id.slice(0, 8)}] Judul: "${ex.judul}" — Diverifikasi sebagai ${
          ex.label === 1 ? "Hoax" : "Fakta"
        }.`,
      });
    }

    // Tambahkan sumber yang disarankan oleh LLM
    if (llmOutput.suggestedSources && llmOutput.suggestedSources.length > 0) {
      for (const src of llmOutput.suggestedSources) {
        evidenceList.push({
          asalBukti: "FACT_CHECK_API",
          urlRujukan: src.url || content.sourceUrl || "https://cekfakta.tempo.co",
          kutipan: src.snippet || src.title || "Klarifikasi dan rujukan silang berita.",
        });
      }
    }

    // 6. Petakan klaim dan verdict
    const isHoax = llmOutput.label === 1;
    const finalResult = isHoax ? "SALAH" : "BENAR";
    const labelNli = isHoax ? "CONTRADICTION" : "ENTAILMENT";
    const confidenceScore = Math.max(0.1, Math.min(1.0, llmOutput.confidence));

    // Skor kredibilitas: jika hoax maka kredibilitas rendah (1 - confidence), jika fakta maka tinggi (confidence)
    const credibilityScore = isHoax
      ? Number((1 - confidenceScore * 0.85).toFixed(4))
      : Number(confidenceScore.toFixed(4));

    const claims: OrchestratedClaim[] = [];

    if (llmOutput.claims && llmOutput.claims.length > 0) {
      for (const c of llmOutput.claims) {
        const claimSentence = c.claim.trim();
        const startIndex = rawText.indexOf(claimSentence) >= 0 ? rawText.indexOf(claimSentence) : 0;
        const endIndex = startIndex + claimSentence.length;

        const prediction: ClaimPredictionResult = {
          labelNli: c.verdict === "BENAR" ? "ENTAILMENT" : c.verdict === "SALAH" ? "CONTRADICTION" : "NEUTRAL",
          skorKepercayaan: c.confidence,
          hasilAkhir: c.verdict,
          explanation: c.explanation,
          metadataKonteks: {
            provider: meta.provider,
            model: meta.model,
            explanation: c.explanation,
            evaluatedAt: new Date().toISOString(),
          },
        };

        claims.push({
          kalimatKlaim: claimSentence,
          subjek: c.subject || title,
          tindakan: c.action || "dinyatakan dalam berita",
          objek: c.object || sourceDomain,
          posisiAwal: startIndex,
          posisiAkhir: endIndex,
          prediction,
          bukti: evidenceList,
        });
      }
    } else {
      // Fallback jika LLM tidak memecah klaim secara rinci
      const firstSentence = rawText.split(/[.!?]\s+/)[0] || rawText;
      const claimSentence = firstSentence.slice(0, 200);
      const startIndex = rawText.indexOf(claimSentence) >= 0 ? rawText.indexOf(claimSentence) : 0;

      claims.push({
        kalimatKlaim: claimSentence,
        subjek: title,
        tindakan: "dilaporkan oleh",
        objek: sourceDomain,
        posisiAwal: startIndex,
        posisiAkhir: startIndex + claimSentence.length,
        prediction: {
          labelNli,
          skorKepercayaan: confidenceScore,
          hasilAkhir: finalResult,
          explanation: llmOutput.explanation,
          metadataKonteks: {
            provider: meta.provider,
            model: meta.model,
            explanation: llmOutput.explanation,
            evaluatedAt: new Date().toISOString(),
          },
        },
        bukti: evidenceList,
      });
    }

    // 7. Masukkan output ke database sebagai data latih baru dengan aturan FIFO (maks. 5.000 baris)
    try {
      const savedTraining = await insertTrainingDataFifo(
        {
          judul: title.slice(0, 300),
          narasi: rawText,
          label: llmOutput.label,
          asalData: "PREDIKSI_LLM",
          skorKepercayaan: confidenceScore,
        },
        env.MAX_TRAINING_DATA_ROWS
      );

      logger.info(
        {
          trainingId: savedTraining.id,
          seqId: savedTraining.seqId,
          label: savedTraining.label,
          maxCapacity: env.MAX_TRAINING_DATA_ROWS,
        },
        "[OrchestratorService] Output verifikasi berhasil dimasukkan ke tabel data_latih_berita dengan mekanisme FIFO."
      );
    } catch (saveError) {
      logger.error({ saveError }, "[OrchestratorService] Gagal menyimpan output ke tabel data_latih_berita.");
    }

    return {
      credibilityScore,
      claims,
    };
  }
}

export const orchestratorService = new OrchestratorService();
