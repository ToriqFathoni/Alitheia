import type {
  VerificationOrchestrator,
  ExtractedContent,
  VerificationResult,
  OrchestratedClaim,
} from "./orchestrator.types.js";

/**
 * Orchestrator Stub untuk tahap eksekusi Langkah 4 (SCRUM-62).
 * Menghasilkan data klaim, bukti rujukan, dan inferensi NLI probabilistik
 * sebelum modul AI Orchestration Engine riil (Langkah 7 / SCRUM-65) dihubungkan.
 */
export class OrchestratorStub implements VerificationOrchestrator {
  async verify(content: ExtractedContent): Promise<VerificationResult> {
    const rawText = content.text.trim();
    const sourceDomain = content.sourceUrl ? new URL(content.sourceUrl).hostname : "sumber.online";

    // Bagi kalimat sederhana atau gunakan default klaim berbasis konten
    const firstSentence = rawText.split(/[.!?]\s+/)[0] || rawText;
    const claimSentence =
      firstSentence.length > 20
        ? firstSentence.slice(0, 150)
        : `Informasi dari ${sourceDomain} memerlukan verifikasi silang independen.`;

    const startIndex = rawText.indexOf(claimSentence) >= 0 ? rawText.indexOf(claimSentence) : 0;
    const endIndex = startIndex + claimSentence.length;

    const stubClaim: OrchestratedClaim = {
      kalimatKlaim: claimSentence,
      subjek: content.title || "Klaim Utama",
      tindakan: "dinyatakan dalam",
      objek: sourceDomain,
      posisiAwal: startIndex,
      posisiAkhir: endIndex,
      prediction: {
        labelNli: "ENTAILMENT",
        skorKepercayaan: 0.88,
        hasilAkhir: "BENAR",
        explanation: `Berdasarkan perbandingan dengan rujukan terpercaya dari ${sourceDomain}, klaim ini didukung oleh bukti faktual.`,
        metadataKonteks: {
          explanation: `Berdasarkan perbandingan dengan rujukan terpercaya dari ${sourceDomain}, klaim ini didukung oleh bukti faktual.`,
          extractor: "orchestrator-stub-v1",
          evaluatedAt: new Date().toISOString(),
        },
      },
      bukti: [
        {
          asalBukti: "FACT_CHECK_API",
          urlRujukan: content.sourceUrl || "https://cekfakta.tempo.co/fakta/123",
          kutipan: `Klarifikasi resmi mencatat bahwa fakta utama selaras dengan bukti terdokumentasi di lapangan.`,
        },
      ],
    };

    return {
      credibilityScore: 0.88,
      claims: [stubClaim],
    };
  }
}

export const orchestratorStub = new OrchestratorStub();
