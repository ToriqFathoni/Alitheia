import fs from "node:fs";
import path from "node:path";
import {
  countTrainingData,
  seedTrainingDataBatch,
  type InsertTrainingDataInput,
} from "@alitheia/database";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

/**
 * Parser RFC-4180 untuk membaca CSV secara deterministik
 * menangani multiline dalam tanda kutip, koma dalam teks, dan karakter khusus.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentField);
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentField);
      currentField = "";
      if (currentRow.some((col) => col.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((col) => col.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return [];

  const headers = rows[0]?.map((h) => h.trim()) ?? [];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? "";
    });
    return obj;
  });
}

/**
 * Menemukan lokasi file dataset CSV baik saat dijalankan dari root maupun dari subfolder apps/api.
 */
export function resolveCsvPath(customPath?: string): string | null {
  const candidates = [
    customPath,
    env.TRAINING_CSV_PATH,
    path.resolve(process.cwd(), "data/Data_latih.csv"),
    path.resolve(process.cwd(), "../../data/Data_latih.csv"),
    path.resolve(process.cwd(), "../data/Data_latih.csv"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    const resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

let cachedCsvData: InsertTrainingDataInput[] | null = null;

/**
 * Membaca file CSV dan mengonversinya menjadi array InsertTrainingDataInput.
 */
export function loadTrainingDatasetFromCsv(filePath?: string): InsertTrainingDataInput[] {
  if (cachedCsvData && cachedCsvData.length > 0 && !filePath) {
    return cachedCsvData;
  }

  const resolvedPath = resolveCsvPath(filePath);
  if (!resolvedPath) {
    throw new Error(`File dataset CSV tidak ditemukan. Lokasi dicari: ${filePath || env.TRAINING_CSV_PATH}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const rawRows = parseCsv(content);

  const items = rawRows.map((row) => {
    const rawLabel = (row["label"] ?? "").trim();
    // 1 = HOAX, 0 = FAKTA
    const label = rawLabel === "0" ? 0 : 1;

    return {
      judul: (row["judul"] ?? "").trim() || "Tanpa Judul",
      narasi: (row["narasi"] ?? "").trim(),
      label,
      asalData: "CSV_AWAL" as const,
      skorKepercayaan: 1.0,
      externalId: (row["ID"] ?? "").trim() || null,
      tanggal: (row["tanggal"] ?? "").trim() || null,
      namaFileGambar: (row["nama file gambar"] ?? "").trim() || null,
    };
  });

  if (!filePath) {
    cachedCsvData = items;
  }

  return items;
}

/**
 * Mencari contoh data latih yang relevan langsung dari memory CSV (fallback saat DB PostgreSQL offline).
 */
export function findRelevantTrainingExamplesFromCsv(queryText: string, limit = 8): any[] {
  try {
    const data = loadTrainingDatasetFromCsv();
    const halfLimit = Math.max(1, Math.floor(limit / 2));

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

    const matchesToken = (item: InsertTrainingDataInput) => {
      if (uniqueTokens.length === 0) return true;
      const combined = `${item.judul} ${item.narasi}`.toLowerCase();
      return uniqueTokens.some((t) => combined.includes(t));
    };

    let hoaxMatches = data.filter((d) => d.label === 1 && matchesToken(d)).slice(0, halfLimit);
    let factMatches = data.filter((d) => d.label === 0 && matchesToken(d)).slice(0, limit - hoaxMatches.length);

    // Jika filter token menghasilkan sedikit hasil, lengkapi dengan data pertama
    if (hoaxMatches.length === 0) {
      hoaxMatches = data.filter((d) => d.label === 1).slice(0, halfLimit);
    }
    if (factMatches.length === 0) {
      factMatches = data.filter((d) => d.label === 0).slice(0, limit - hoaxMatches.length);
    }

    return [...hoaxMatches, ...factMatches].map((item, idx) => ({
      id: item.externalId || `csv-${idx + 1}`,
      seqId: idx + 1,
      label: item.label,
      judul: item.judul,
      narasi: item.narasi,
      skorKepercayaan: item.skorKepercayaan || 1.0,
      asalData: item.asalData,
      createdAt: new Date().toISOString(),
    }));
  } catch (err: any) {
    logger.warn({ error: err?.message }, "[CsvLoader] Gagal mencari contoh dari memory CSV.");
    return [];
  }
}

/**
 * Memastikan tabel data_latih_berita sudah terisi (seeding otomatis jika kosong).
 */
export async function ensureTrainingDataSeeded(options?: { force?: boolean }): Promise<{
  seeded: boolean;
  count: number;
}> {
  try {
    const currentCount = await countTrainingData();
    if (currentCount > 0 && !options?.force) {
      return { seeded: false, count: currentCount };
    }

    logger.info("[CsvLoader] Memulai inisialisasi seeding data latih dari Data_latih.csv...");
    const items = loadTrainingDatasetFromCsv();
    const inserted = await seedTrainingDataBatch(items, env.MAX_TRAINING_DATA_ROWS);
    const totalNow = await countTrainingData();

    logger.info(
      { inserted, totalNow, maxRows: env.MAX_TRAINING_DATA_ROWS },
      "[CsvLoader] Seeding data latih dari CSV berhasil diselesaikan."
    );

    return { seeded: true, count: totalNow };
  } catch (error) {
    logger.warn({ error }, "[CsvLoader] Gagal melakukan inisialisasi seeding CSV.");
    return { seeded: false, count: 0 };
  }
}

