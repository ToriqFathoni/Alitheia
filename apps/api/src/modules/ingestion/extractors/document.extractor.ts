import zlib from "node:zlib";
import { sanitizeExtractedText } from "./article.extractor.js";
import type { ExtractedContent } from "../../orchestrator/orchestrator.types.js";
import { AppError } from "../../../middleware/error.middleware.js";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB raw file
const MAX_WORDS = 15000;

export interface UploadedDocumentInput {
  fileName: string;
  mimeType?: string;
  contentBase64?: string;
  textContent?: string;
}

/**
 * Ekstraksi teks dari berkas DOCX (ZIP berisi word/document.xml)
 * menggunakan zlib bawaan Node.js tanpa dependensi eksternal.
 */
function extractTextFromDocxBuffer(buf: Buffer): string {
  // Cari signature PK\x03\x04 (Local File Header) untuk word/document.xml
  let offset = 0;
  while (offset + 30 < buf.length) {
    if (
      buf[offset] !== 0x50 ||
      buf[offset + 1] !== 0x4b ||
      buf[offset + 2] !== 0x03 ||
      buf[offset + 3] !== 0x04
    ) {
      offset += 1;
      continue;
    }

    const compressionMethod = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const fileNameLen = buf.readUInt16LE(offset + 26);
    const extraFieldLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLen;
    if (nameEnd > buf.length) break;

    const entryName = buf.subarray(nameStart, nameEnd).toString("utf8");
    const dataStart = nameEnd + extraFieldLen;

    if (entryName === "word/document.xml") {
      // Jika compressedSize == 0 (bit 3 data descriptor), cari signature PK berikutnya
      let dataEnd = compressedSize > 0 ? dataStart + compressedSize : buf.length;
      if (compressedSize === 0) {
        const nextSig = buf.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]), dataStart);
        if (nextSig !== -1) dataEnd = nextSig;
      }
      const rawData = buf.subarray(dataStart, Math.min(dataEnd, buf.length));
      const xmlBuf =
        compressionMethod === 8
          ? zlib.inflateRawSync(rawData)
          : compressionMethod === 0
            ? rawData
            : null;

      if (!xmlBuf) {
        throw new AppError(
          "CONTENT_UNEXTRACTABLE",
          "Format kompresi DOCX tidak didukung.",
          422
        );
      }

      const xml = xmlBuf.toString("utf8");
      const text = xml
        .replace(/<\/w:p>/gi, "\n")
        .replace(/<w:tab\s*\/>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      return sanitizeExtractedText(text);
    }

    offset = compressedSize > 0 ? dataStart + compressedSize : dataStart + 1;
  }

  throw new AppError(
    "CONTENT_UNEXTRACTABLE",
    "Dokumen DOCX tidak valid atau tidak memuat word/document.xml.",
    422
  );
}

/**
 * Ekstraksi teks dasar dari PDF berbasis teks (FlateDecode / uncompressed stream).
 */
function extractTextFromPdfBuffer(buf: Buffer): string {
  const rawLatin = buf.toString("latin1");
  const chunks: string[] = [];

  const extractPdfOperators = (streamText: string) => {
    // Cocokkan teks dalam tanda kurung pada operator Tj atau array TJ
    const tjRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(streamText)) !== null) {
      if (m[1]) chunks.push(unescapePdfString(m[1]));
    }

    const tjArrayRegex = /\[((?:[^[\]]*?))\]\s*TJ/g;
    while ((m = tjArrayRegex.exec(streamText)) !== null) {
      const inner = m[1] || "";
      const strRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
      let sm: RegExpExecArray | null;
      const lineParts: string[] = [];
      while ((sm = strRegex.exec(inner)) !== null) {
        if (sm[1]) lineParts.push(unescapePdfString(sm[1]));
      }
      if (lineParts.length > 0) chunks.push(lineParts.join(""));
    }
  };

  // Ekstrak dari blok stream ... endstream
  let pos = 0;
  while (pos < rawLatin.length) {
    const streamIdx = rawLatin.indexOf("stream", pos);
    if (streamIdx === -1) break;
    const endIdx = rawLatin.indexOf("endstream", streamIdx + 6);
    if (endIdx === -1) break;

    let start = streamIdx + 6;
    if (rawLatin[start] === "\r" && rawLatin[start + 1] === "\n") start += 2;
    else if (rawLatin[start] === "\n" || rawLatin[start] === "\r") start += 1;

    const streamBuf = buf.subarray(start, endIdx);
    try {
      const inflated = zlib.inflateSync(streamBuf).toString("latin1");
      extractPdfOperators(inflated);
    } catch {
      extractPdfOperators(streamBuf.toString("latin1"));
    }

    pos = endIdx + 9;
  }

  return sanitizeExtractedText(chunks.join(" "));
}

function unescapePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

export const documentExtractor = {
  extractFromUpload(input: UploadedDocumentInput): ExtractedContent {
    const fileName = (input.fileName || "").trim();
    if (!fileName) {
      throw new AppError("VALIDATION_ERROR", "Nama berkas wajib diisi.", 400);
    }

    const ext = fileName.includes(".")
      ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
      : "";

    let extractedText = "";

    if (typeof input.textContent === "string" && input.textContent.trim().length > 0) {
      if (Buffer.byteLength(input.textContent, "utf8") > MAX_FILE_BYTES) {
        throw new AppError("PAYLOAD_TOO_LARGE", "Ukuran berkas melebihi batas maksimal 4 MB.", 413);
      }
      extractedText = sanitizeExtractedText(
        ext === ".html" || ext === ".htm"
          ? input.textContent.replace(/<[^>]+>/g, " ")
          : input.textContent
      );
    } else if (typeof input.contentBase64 === "string" && input.contentBase64.trim().length > 0) {
      const cleanBase64 = input.contentBase64.includes(",")
        ? input.contentBase64.split(",").pop() || ""
        : input.contentBase64;
      const buf = Buffer.from(cleanBase64, "base64");

      if (buf.length > MAX_FILE_BYTES) {
        throw new AppError("PAYLOAD_TOO_LARGE", "Ukuran berkas melebihi batas maksimal 4 MB.", 413);
      }

      if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
        extractedText = sanitizeExtractedText(buf.toString("utf8"));
      } else if (ext === ".html" || ext === ".htm") {
        extractedText = sanitizeExtractedText(
          buf
            .toString("utf8")
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
        );
      } else if (ext === ".docx") {
        extractedText = extractTextFromDocxBuffer(buf);
      } else if (ext === ".pdf") {
        extractedText = extractTextFromPdfBuffer(buf);
        if (extractedText.length < 10) {
          throw new AppError(
            "CONTENT_UNEXTRACTABLE",
            "PDF tidak mengandung teks yang dapat diekstrak (kemungkinan hasil pindaian gambar atau terenkripsi). Silakan salin teksnya ke kolom Teks.",
            422
          );
        }
      } else {
        throw new AppError(
          "UNSUPPORTED_MEDIA_TYPE",
          `Format berkas "${ext || "tidak dikenal"}" belum didukung. Gunakan .txt, .md, .csv, .docx, atau .pdf berbasis teks.`,
          415
        );
      }
    } else {
      throw new AppError("VALIDATION_ERROR", "Konten berkas tidak boleh kosong.", 400);
    }

    if (extractedText.length < 10) {
      throw new AppError(
        "CONTENT_UNEXTRACTABLE",
        "Teks yang diekstrak dari dokumen terlalu pendek (minimal 10 karakter).",
        422
      );
    }

    const words = extractedText.split(/\s+/).filter(Boolean);
    if (words.length > MAX_WORDS) {
      extractedText = words.slice(0, MAX_WORDS).join(" ");
    }

    return {
      text: extractedText,
      title: `Dokumen: ${fileName}`,
      contentType: "DOCUMENT",
      metadata: {
        fileName,
        extension: ext,
        extractedVia: "document-extractor",
      },
    };
  },
};
