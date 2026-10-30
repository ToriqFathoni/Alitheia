import type {
  CreateVerificationDTO,
  CreateVerificationResponseDTO,
  VerificationDetailDataDTO,
  VerifiedClaimDTO,
  NliLabel,
  HasilAkhir,
  StatusVerifikasi,
  AsalBukti,
  TipeInput,
} from "@alitheia/shared-types";
import { VerificationDetailDataSchema } from "@alitheia/shared-types";
import { verificationRepository } from "./verification.repository.js";
import { AppError } from "../../middleware/error.middleware.js";
import { validateUrlSafety } from "../ingestion/url-validator.js";
import { verificationQueue } from "../../lib/queue/verification-queue.js";

function parseExplanationFromContext(metadata: unknown): string | undefined {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "explanation" in metadata &&
    typeof (metadata as { explanation: unknown }).explanation === "string"
  ) {
    return (metadata as { explanation: string }).explanation;
  }
  return undefined;
}

export const verificationService = {
  async createVerification(dto: CreateVerificationDTO): Promise<CreateVerificationResponseDTO> {
    if (dto.type === "URL") {
      validateUrlSafety(dto.url);
    }

    const kueri = await verificationRepository.createKueri({
      tipeInput: dto.type,
      inputTeks: dto.type === "TEKS" ? dto.text : null,
      urlSumber: dto.type === "URL" ? dto.url : null,
      status: "PENDING",
    });

    await verificationQueue.enqueue({
      verificationId: kueri.id,
      type: dto.type,
      url: dto.type === "URL" ? dto.url : undefined,
      text: dto.type === "TEKS" ? dto.text : undefined,
    });

    return {
      verificationId: kueri.id,
      status: "PENDING",
      pollUrl: `/api/v1/verifications/${kueri.id}`,
    };
  },

  async getVerificationById(id: string): Promise<VerificationDetailDataDTO> {
    const kueri = await verificationRepository.findKueriDetailById(id);

    if (!kueri) {
      throw new AppError("NOT_FOUND", `Data verifikasi dengan ID '${id}' tidak ditemukan.`, 404);
    }

    const claims: VerifiedClaimDTO[] = kueri.klaim.map((klaim) => {
      const latestPred = klaim.logPrediksi[0];
      const prediction = latestPred
        ? {
            id: latestPred.id,
            labelNli: latestPred.labelNli as NliLabel,
            confidence: Number(latestPred.skorKepercayaan),
            finalResult: latestPred.hasilAkhir as HasilAkhir,
            explanation: parseExplanationFromContext(latestPred.metadataKonteks),
          }
        : {
            id: klaim.id,
            labelNli: "NEUTRAL" as NliLabel,
            confidence: 0,
            finalResult: "TIDAK_PASTI" as HasilAkhir,
            explanation: "Menunggu proses verifikasi",
          };

      const evidence = klaim.bukti.map((b) => ({
        origin: b.asalBukti as AsalBukti,
        url: b.urlRujukan ?? undefined,
        quote: b.kutipan ?? undefined,
      }));

      return {
        id: klaim.id,
        kalimatKlaim: klaim.kalimatKlaim,
        span: {
          start: klaim.posisiAwal ?? 0,
          end: klaim.posisiAkhir ?? 0,
        },
        spo: {
          subject: klaim.subjek ?? undefined,
          action: klaim.tindakan ?? undefined,
          object: klaim.objek ?? undefined,
        },
        prediction,
        evidence,
      };
    });

    let benarCount = 0;
    let salahCount = 0;
    let tidakPastiCount = 0;
    let scoreAccumulator = 0;

    for (const c of claims) {
      if (c.prediction.finalResult === "BENAR") {
        benarCount++;
        scoreAccumulator += c.prediction.confidence;
      } else if (c.prediction.finalResult === "SALAH") {
        salahCount++;
        scoreAccumulator += 1 - c.prediction.confidence;
      } else {
        tidakPastiCount++;
        scoreAccumulator += 0.5;
      }
    }

    const credibilityScore =
      claims.length > 0 ? Number((scoreAccumulator / claims.length).toFixed(4)) : 0;

    const rawResult: VerificationDetailDataDTO = {
      id: kueri.id,
      status: kueri.status as StatusVerifikasi,
      createdAt: kueri.createdAt.toISOString(),
      input: {
        type: kueri.tipeInput as TipeInput,
        text: kueri.inputTeks ?? undefined,
        sourceUrl: kueri.urlSumber ?? undefined,
      },
      overview: {
        credibilityScore,
        counts: {
          benar: benarCount,
          salah: salahCount,
          tidakPasti: tidakPastiCount,
        },
      },
      claims,
    };

    return VerificationDetailDataSchema.parse(rawResult);
  },
};
