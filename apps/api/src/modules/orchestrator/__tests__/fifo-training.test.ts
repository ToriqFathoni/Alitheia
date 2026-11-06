import { describe, it, expect, vi } from "vitest";
import { insertTrainingDataFifo } from "@alitheia/database";
import { prisma } from "@alitheia/database";

describe("FIFO Training Data Queue Logic", () => {
  it("tidak boleh menghapus data jika kapasitas belum penuh (count < maxRows)", async () => {
    const mockTx = {
      dataLatihBerita: {
        count: vi.fn().mockResolvedValue(4),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "new-row-uuid",
          seqId: 5,
          judul: "Berita 5",
          narasi: "Narasi 5",
          label: 1,
          asalData: "PREDIKSI_LLM",
          skorKepercayaan: "0.9500",
          createdAt: new Date(),
        }),
      },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => cb(mockTx));

    const result = await insertTrainingDataFifo(
      {
        judul: "Berita 5",
        narasi: "Narasi 5",
        label: 1,
        skorKepercayaan: 0.95,
      },
      5
    );

    expect(result.id).toBe("new-row-uuid");
    expect(mockTx.dataLatihBerita.count).toHaveBeenCalledTimes(1);
    expect(mockTx.dataLatihBerita.findMany).not.toHaveBeenCalled();
    expect(mockTx.dataLatihBerita.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.dataLatihBerita.create).toHaveBeenCalledTimes(1);
  });

  it("harus menghapus baris tertua (FIFO) saat kapasitas penuh (count >= maxRows)", async () => {
    const oldestRow = { id: "oldest-row-uuid-1", createdAt: new Date("2026-01-01"), seqId: 1 };

    const mockTx = {
      dataLatihBerita: {
        count: vi.fn().mockResolvedValue(5000), // Sudah penuh 5000 baris
        findMany: vi.fn().mockResolvedValue([oldestRow]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({
          id: "brand-new-row-uuid",
          seqId: 5001,
          judul: "Berita Baru Hari Ini",
          narasi: "Narasi terkini hasil verifikasi LLM",
          label: 0,
          asalData: "PREDIKSI_LLM",
          skorKepercayaan: "0.9800",
          createdAt: new Date(),
        }),
      },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => cb(mockTx));

    const result = await insertTrainingDataFifo(
      {
        judul: "Berita Baru Hari Ini",
        narasi: "Narasi terkini hasil verifikasi LLM",
        label: 0,
        skorKepercayaan: 0.98,
      },
      5000
    );

    expect(result.id).toBe("brand-new-row-uuid");
    // Verifikasi pemanggilan FIFO
    expect(mockTx.dataLatihBerita.count).toHaveBeenCalledTimes(1);
    expect(mockTx.dataLatihBerita.findMany).toHaveBeenCalledWith({
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { seqId: "asc" }],
      take: 1, // overflow = 5000 + 1 - 5000 = 1 baris
    });
    expect(mockTx.dataLatihBerita.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["oldest-row-uuid-1"] } },
    });
    expect(mockTx.dataLatihBerita.create).toHaveBeenCalledTimes(1);
  });
});

