import { prisma } from "@alitheia/database";
import type { OrchestratedClaim } from "../orchestrator/orchestrator.types.js";

export interface CreateKueriInput {
  tipeInput: string;
  inputTeks: string | null;
  urlSumber: string | null;
  status?: string;
  penggunaId?: string | null;
}

export interface SaveVerificationResultsInput {
  kueriId: string;
  inputTeks?: string;
  claims: OrchestratedClaim[];
}

export const verificationRepository = {
  async createKueri(input: CreateKueriInput) {
    return prisma.riwayatKueri.create({
      data: {
        tipeInput: input.tipeInput,
        inputTeks: input.inputTeks,
        urlSumber: input.urlSumber,
        status: input.status ?? "PENDING",
        penggunaId: input.penggunaId ?? null,
      },
    });
  },

  async updateKueriStatus(id: string, status: string, inputTeks?: string | null) {
    return prisma.riwayatKueri.update({
      where: { id },
      data: {
        status,
        ...(inputTeks !== undefined ? { inputTeks } : {}),
      },
    });
  },

  /**
   * Menyimpan hasil ekstraksi klaim, bukti rujukan, dan log prediksi
   * ke database secara atomik dalam satu transaksi database (03 §5).
   */
  async saveVerificationResults(input: SaveVerificationResultsInput) {
    return prisma.$transaction(async (tx) => {
      return tx.riwayatKueri.update({
        where: { id: input.kueriId },
        data: {
          status: "DONE",
          ...(inputTeksExists(input.inputTeks) ? { inputTeks: input.inputTeks } : {}),
          klaim: {
            create: input.claims.map((c) => ({
              kalimatKlaim: c.kalimatKlaim,
              subjek: c.subjek ?? null,
              tindakan: c.tindakan ?? null,
              objek: c.objek ?? null,
              posisiAwal: c.posisiAwal,
              posisiAkhir: c.posisiAkhir,
              bukti: {
                create: c.bukti.map((b) => ({
                  asalBukti: b.asalBukti,
                  urlRujukan: b.urlRujukan ?? null,
                  kutipan: b.kutipan ?? null,
                })),
              },
              logPrediksi: {
                create: [
                  {
                    labelNli: c.prediction.labelNli,
                    skorKepercayaan: c.prediction.skorKepercayaan.toFixed(4),
                    hasilAkhir: c.prediction.hasilAkhir,
                    metadataKonteks: c.prediction.metadataKonteks
                      ? JSON.parse(JSON.stringify(c.prediction.metadataKonteks))
                      : undefined,
                  },
                ],
              },
            })),
          },
        },
      });
    });
  },

  async findKueriDetailById(id: string) {
    return prisma.riwayatKueri.findUnique({
      where: { id },
      include: {
        klaim: {
          orderBy: { posisiAwal: "asc" },
          include: {
            bukti: true,
            logPrediksi: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });
  },
};

function inputTeksExists(val?: string): val is string {
  return typeof val === "string" && val.length > 0;
}
