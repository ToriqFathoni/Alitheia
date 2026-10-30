import { verificationQueue, type VerificationJobPayload } from "../../lib/queue/verification-queue.js";
import { verificationRepository } from "./verification.repository.js";
import { articleExtractor } from "../ingestion/extractors/article.extractor.js";
import { orchestratorStub } from "../orchestrator/orchestrator.stub.js";
import type { ExtractedContent } from "../orchestrator/orchestrator.types.js";
import { logger } from "../../lib/logger.js";

export const verificationWorker = {
  async processJob(job: VerificationJobPayload): Promise<void> {
    const { verificationId, type, url, text } = job;
    logger.info({ verificationId, type }, "[VerificationWorker] Memulai pemrosesan pipeline analisis...");

    try {
      // 1. Perbarui status kueri ke PROCESSING
      await verificationRepository.updateKueriStatus(verificationId, "PROCESSING");

      // 2. Ekstraksi konten (Ingestion stage)
      let extracted: ExtractedContent;
      if (type === "URL" && url) {
        extracted = await articleExtractor.extractFromUrl(url);
      } else if (text) {
        extracted = {
          text,
          title: "Teks Masukan Langsung",
          contentType: "PLAIN_TEXT",
        };
      } else {
        throw new Error("Input verifikasi tidak memiliki URL atau teks yang valid.");
      }

      // 3. Eksekusi Orchestrator (Stub pada Langkah 4)
      const orchestrationResult = await orchestratorStub.verify(extracted);

      // 4. Persistensi atomik klaim, bukti, dan prediksi ke DB (Status -> DONE)
      await verificationRepository.saveVerificationResults({
        kueriId: verificationId,
        inputTeks: extracted.text,
        claims: orchestrationResult.claims,
      });

      logger.info(
        { verificationId, claimsCount: orchestrationResult.claims.length },
        "[VerificationWorker] Pipeline analisis berhasil diselesaikan. Status kueri diperbarui menjadi DONE."
      );
    } catch (error) {
      logger.error(
        { error, verificationId },
        "[VerificationWorker] Pipeline verifikasi gagal dieksekusi. Memperbarui status menjadi FAILED."
      );
      try {
        await verificationRepository.updateKueriStatus(verificationId, "FAILED");
      } catch (dbError) {
        logger.error({ dbError, verificationId }, "[VerificationWorker] Gagal memperbarui status ke FAILED.");
      }
    }
  },

  init() {
    verificationQueue.registerHandler(this.processJob.bind(this));
    logger.info("[VerificationWorker] Worker pipeline verifikasi berhasil diinisialisasi.");
  },
};
