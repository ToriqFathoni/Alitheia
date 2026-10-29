import { prisma } from "@alitheia/database";

export interface CreateKueriInput {
  tipeInput: string;
  inputTeks: string | null;
  urlSumber: string | null;
  status?: string;
  penggunaId?: string | null;
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
