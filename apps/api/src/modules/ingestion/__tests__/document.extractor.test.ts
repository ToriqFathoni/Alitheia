import zlib from "node:zlib";
import { describe, it, expect } from "vitest";
import { documentExtractor } from "../extractors/document.extractor.js";

/**
 * Membangun buffer ZIP minimal (DOCX) yang berisi word/document.xml
 * agar dapat menguji ekstraksi DOCX secara deterministik tanpa file eksternal.
 */
function buildMinimalDocxBuffer(xmlContent: string): Buffer {
  const fileName = Buffer.from("word/document.xml", "utf8");
  const compressed = zlib.deflateRawSync(Buffer.from(xmlContent, "utf8"));
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  header.writeUInt16LE(20, 4); // version
  header.writeUInt16LE(0, 6); // flags
  header.writeUInt16LE(8, 8); // compression method: deflate
  header.writeUInt32LE(compressed.length, 18); // compressed size
  header.writeUInt32LE(Buffer.byteLength(xmlContent, "utf8"), 22); // uncompressed size
  header.writeUInt16LE(fileName.length, 26); // file name length
  header.writeUInt16LE(0, 28); // extra field length
  return Buffer.concat([header, fileName, compressed]);
}

describe("documentExtractor", () => {
  it("mengekstrak teks bersih dari file .txt berbasis base64", () => {
    const sample = "Kementerian Kesehatan mengumumkan program imunisasi nasional dimulai bulan depan.";
    const res = documentExtractor.extractFromUpload({
      fileName: "rilis-pers.txt",
      contentBase64: Buffer.from(sample, "utf8").toString("base64"),
    });

    expect(res.contentType).toBe("DOCUMENT");
    expect(res.title).toContain("rilis-pers.txt");
    expect(res.text).toBe(sample);
  });

  it("mengekstrak teks paragraf dari dokumen .docx (ZIP + word/document.xml)", () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      "<w:document><w:body><w:p><w:r><w:t>Beredar kabar bantuan tunai dari pemerintah sebesar dua juta rupiah.</w:t></w:r></w:p></w:body></w:document>";
    const docxBuf = buildMinimalDocxBuffer(xml);

    const res = documentExtractor.extractFromUpload({
      fileName: "draft-berita.docx",
      contentBase64: docxBuf.toString("base64"),
    });

    expect(res.contentType).toBe("DOCUMENT");
    expect(res.text).toContain("Beredar kabar bantuan tunai");
  });

  it("mengekstrak teks dari PDF berbasis teks (FlateDecode stream)", () => {
    const pdfStreamContent = "BT (Laporan resmi inflasi nasional turun pada kuartal ketiga.) Tj ET";
    const compressed = zlib.deflateSync(Buffer.from(pdfStreamContent, "latin1"));
    const pdfBuf = Buffer.concat([
      Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n", "latin1"),
      compressed,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);

    const res = documentExtractor.extractFromUpload({
      fileName: "laporan.pdf",
      contentBase64: pdfBuf.toString("base64"),
    });

    expect(res.text).toContain("Laporan resmi inflasi nasional turun");
  });

  it("menolak PDF hasil scan/kosong dengan status 422 CONTENT_UNEXTRACTABLE", () => {
    const fakePdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF", "latin1");
    expect(() =>
      documentExtractor.extractFromUpload({
        fileName: "scan.pdf",
        contentBase64: fakePdf.toString("base64"),
      })
    ).toThrow(/PDF tidak mengandung teks/);
  });

  it("menolak format file tidak didukung dengan status 415", () => {
    expect(() =>
      documentExtractor.extractFromUpload({
        fileName: "virus.exe",
        contentBase64: Buffer.from("MZ...", "utf8").toString("base64"),
      })
    ).toThrow(/Format berkas/);
  });
});
