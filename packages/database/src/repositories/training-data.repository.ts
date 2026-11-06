import { prisma } from "../index.js";

export interface InsertTrainingDataInput {
  judul: string;
  narasi: string;
  label: number; // 1 = HOAX, 0 = FAKTA
  asalData?: "CSV_AWAL" | "PREDIKSI_LLM";
  skorKepercayaan?: number;
  externalId?: string | null;
  tanggal?: string | null;
  namaFileGambar?: string | null;
}

export interface TrainingDataExample {
  id: string;
  judul: string;
  narasi: string;
  label: number;
  asalData: string;
  skorKepercayaan: number;
}

/**
 * Menyimpan data latih baru dengan mekanisme FIFO (First-In, First-Out).
 * Jika total baris saat ini + 1 > maxRows, baris tertua (ORDER BY created_at ASC, seq_id ASC)
 * akan dihapus terlebih dahulu dalam satu transaksi database atomik.
 */
export async function insertTrainingDataFifo(
  input: InsertTrainingDataInput,
  maxRows = 5000
) {
  const asalData = input.asalData ?? "PREDIKSI_LLM";
  const skorKepercayaan = input.skorKepercayaan ?? 1.0;

  return prisma.$transaction(async (tx) => {
    const currentCount = await tx.dataLatihBerita.count();
    const overflow = currentCount + 1 - maxRows;

    if (overflow > 0) {
      const oldestRows = await tx.dataLatihBerita.findMany({
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { seqId: "asc" }],
        take: overflow,
      });

      if (oldestRows.length > 0) {
        await tx.dataLatihBerita.deleteMany({
          where: {
            id: { in: oldestRows.map((r) => r.id) },
          },
        });
      }
    }

    return tx.dataLatihBerita.create({
      data: {
        judul: input.judul,
        narasi: input.narasi,
        label: input.label,
        asalData,
        skorKepercayaan: skorKepercayaan.toFixed(4),
        externalId: input.externalId ?? null,
        tanggal: input.tanggal ?? null,
        namaFileGambar: input.namaFileGambar ?? null,
      },
    });
  });
}

/**
 * Menghitung total baris data latih di database.
 */
export async function countTrainingData(): Promise<number> {
  return prisma.dataLatihBerita.count();
}

/**
 * Mengimpor kumpulan data latih (misalnya dari CSV) secara batch.
 * Memastikan kapasitas maksimum tidak melebihi maxRows.
 */
export async function seedTrainingDataBatch(
  items: InsertTrainingDataInput[],
  maxRows = 5000,
  batchSize = 250
): Promise<number> {
  // Jika data input melebihi maxRows, ambil maxRows data paling awal/akhir
  const targetItems = items.length > maxRows ? items.slice(-maxRows) : items;

  let insertedCount = 0;
  for (let i = 0; i < targetItems.length; i += batchSize) {
    const chunk = targetItems.slice(i, i + batchSize);
    const dataToInsert = chunk.map((c) => ({
      judul: c.judul,
      narasi: c.narasi,
      label: c.label,
      asalData: c.asalData ?? "CSV_AWAL",
      skorKepercayaan: (c.skorKepercayaan ?? 1.0).toFixed(4),
      externalId: c.externalId ?? null,
      tanggal: c.tanggal ?? null,
      namaFileGambar: c.namaFileGambar ?? null,
    }));

    const result = await prisma.dataLatihBerita.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });
    insertedCount += result.count;
  }

  // Jika setelah insert batch terdapat overflow terhadap maxRows, bersihkan baris tertua
  const totalNow = await prisma.dataLatihBerita.count();
  if (totalNow > maxRows) {
    const overflow = totalNow - maxRows;
    const oldest = await prisma.dataLatihBerita.findMany({
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { seqId: "asc" }],
      take: overflow,
    });
    if (oldest.length > 0) {
      await prisma.dataLatihBerita.deleteMany({
        where: { id: { in: oldest.map((o) => o.id) } },
      });
    }
  }

  return insertedCount;
}

/**
 * Mengambil contoh data latih yang relevan dari database (Few-Shot Examples)
 * dengan menyeimbangkan contoh Hoax (label = 1) dan Fakta (label = 0).
 */
export async function findRelevantTrainingExamples(
  queryText: string,
  limit = 8
): Promise<TrainingDataExample[]> {
  const halfLimit = Math.max(1, Math.floor(limit / 2));

  // Ekstrak token kata penting (panjang >= 4, lowercase)
  const stopWords = new Set([
    "yang", "untuk", "pada", "ke", "para", "namun", "menurut", "antara", "dia", "mereka",
    "anda", "kita", "aku", "bisa", "ada", "tidak", "akan", "dari", "dalam", "dengan",
    "bahwa", "oleh", "saat", "juga", "sudah", "lebih", "karena", "bagi", "sampai", "seperti"
  ]);

  const rawTokens = queryText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  const uniqueTokens = Array.from(new Set(rawTokens)).slice(0, 5);

  let hoaxExamples: any[] = [];
  let factExamples: any[] = [];

  // 1. Coba pencarian berbasis token
  if (uniqueTokens.length > 0) {
    const searchConditions = uniqueTokens.map((token) => ({
      OR: [
        { judul: { contains: token, mode: "insensitive" as const } },
        { narasi: { contains: token, mode: "insensitive" as const } },
      ],
    }));

    hoaxExamples = await prisma.dataLatihBerita.findMany({
      where: {
        label: 1,
        OR: searchConditions,
      },
      take: halfLimit,
      orderBy: { seqId: "desc" },
    });

    factExamples = await prisma.dataLatihBerita.findMany({
      where: {
        label: 0,
        OR: searchConditions,
      },
      take: limit - hoaxExamples.length,
      orderBy: { seqId: "desc" },
    });
  }

  // 2. Jika hasil belum mencukupi, lengkapi dengan data latih representatif
  if (hoaxExamples.length < halfLimit) {
    const remainingHoax = await prisma.dataLatihBerita.findMany({
      where: {
        label: 1,
        id: { notIn: hoaxExamples.map((h) => h.id) },
      },
      take: halfLimit - hoaxExamples.length,
      orderBy: { seqId: "desc" },
    });
    hoaxExamples = [...hoaxExamples, ...remainingHoax];
  }

  const neededFacts = limit - hoaxExamples.length;
  if (factExamples.length < neededFacts) {
    const remainingFacts = await prisma.dataLatihBerita.findMany({
      where: {
        label: 0,
        id: { notIn: factExamples.map((f) => f.id) },
      },
      take: neededFacts - factExamples.length,
      orderBy: { seqId: "desc" },
    });
    factExamples = [...factExamples, ...remainingFacts];
  }

  const combined = [...hoaxExamples, ...factExamples];

  return combined.map((item) => ({
    id: item.id,
    judul: item.judul,
    narasi: item.narasi,
    label: item.label,
    asalData: item.asalData,
    skorKepercayaan: Number(item.skorKepercayaan),
  }));
}

