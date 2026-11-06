import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import * as dbRepo from "@alitheia/database";
import { verificationRepository } from "../../modules/verification/verification.repository.js";
import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";

vi.mock("@alitheia/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@alitheia/database")>();
  return {
    ...actual,
    createCheck: vi.fn(),
    addCheckEvent: vi.fn(),
    findRecentByNormalizedUrl: vi.fn(),
    getCheckDetail: vi.fn(),
    updateCheckStatus: vi.fn(),
    completeCheck: vi.fn(),
    saveAnalysis: vi.fn(),
  };
});

describe("Checks API Endpoints (POST/GET /api/v1/checks)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dns, "lookup").mockImplementation(async () => [
      { address: "93.184.216.34", family: 4 },
    ] as any);

    vi.spyOn(verificationRepository, "findKueriDetailById").mockResolvedValue(null);

    // Mock fetch untuk probing artikel web publik
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      return Promise.resolve({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve("<html><body><h1>Judul Berita</h1><p>Isi artikel berita terverifikasi.</p></body></html>"),
      } as unknown as Response);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("POST /api/v1/checks - URL & Text Ingestion", () => {
    it("menolak URL lokal atau privat dengan Anti-SSRF guard", async () => {
      const res = await request(app)
        .post("/api/v1/checks")
        .send({ url: "http://localhost:5000/api/internal" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Anti-SSRF");
    });

    it("menolak URL metadata cloud AWS/GCP (169.254.169.254)", async () => {
      const res = await request(app)
        .post("/api/v1/checks")
        .send({ url: "http://169.254.169.254/latest/meta-data" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Anti-SSRF");
    });

    it("menolak permintaan tanpa URL atau teks", async () => {
      const res = await request(app)
        .post("/api/v1/checks")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Mohon masukkan tautan (URL) atau teks");
    });

    it("menerima teks masukan langsung dan mengembalikan 202 Accepted", async () => {
      const mockId = randomUUID();
      vi.mocked(dbRepo.createCheck).mockResolvedValue({
        id: mockId,
        sourceUrl: "",
        normalizedUrl: "",
        inputText: "Klaim fakta bahwa vaksin polio telah teruji di seluruh dunia.",
        inputType: "text",
        platform: "Text",
        status: "queued",
        progressStage: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      } as any);

      vi.mocked(dbRepo.addCheckEvent).mockResolvedValue({} as any);

      const res = await request(app)
        .post("/api/v1/checks")
        .send({ text: "Klaim fakta bahwa vaksin polio telah teruji di seluruh dunia." });

      expect(res.status).toBe(202);
      expect(res.body.id).toBe(mockId);
      expect(res.body.status).toBe("queued");
    });

    it("menerima tautan artikel berita web publik dan mengembalikan 202 Accepted", async () => {
      const mockId = randomUUID();
      vi.mocked(dbRepo.findRecentByNormalizedUrl).mockResolvedValue(null);
      vi.mocked(dbRepo.createCheck).mockResolvedValue({
        id: mockId,
        sourceUrl: "https://news.detik.com/berita/d-123456/fakta-klarifikasi",
        normalizedUrl: "https://news.detik.com/berita/d-123456/fakta-klarifikasi",
        inputText: null,
        inputType: "url",
        platform: "Web Article",
        status: "queued",
        progressStage: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      } as any);

      vi.mocked(dbRepo.addCheckEvent).mockResolvedValue({} as any);

      const res = await request(app)
        .post("/api/v1/checks")
        .send({ url: "https://news.detik.com/berita/d-123456/fakta-klarifikasi" });

      expect(res.status).toBe(202);
      expect(res.body.id).toBe(mockId);
      expect(res.body.status).toBe("queued");
    });

    it("tetap menerima tautan dan mengembalikan 202 meskipun database server offline (P1001)", async () => {
      vi.mocked(dbRepo.findRecentByNormalizedUrl).mockRejectedValue(
        new Error("Can't reach database server at localhost:5433")
      );
      vi.mocked(dbRepo.createCheck).mockRejectedValue(
        new Error("Can't reach database server at localhost:5433")
      );
      vi.mocked(dbRepo.addCheckEvent).mockRejectedValue(
        new Error("Can't reach database server at localhost:5433")
      );

      const res = await request(app)
        .post("/api/v1/checks")
        .send({ url: "https://news.detik.com/berita/d-123456/fakta-klarifikasi" });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe("queued");
      expect(typeof res.body.id).toBe("string");
    });

    it("menerima tautan media sosial (Instagram) dan mengembalikan 202 tanpa error 500", async () => {
      vi.mocked(dbRepo.findRecentByNormalizedUrl).mockRejectedValue(
        new Error("Can't reach database server at localhost:5433")
      );
      vi.mocked(dbRepo.createCheck).mockRejectedValue(
        new Error("Can't reach database server at localhost:5433")
      );
      vi.mocked(dbRepo.addCheckEvent).mockRejectedValue(
        new Error("Can't reach database server at localhost:5433")
      );

      const res = await request(app)
        .post("/api/v1/checks")
        .send({ url: "https://www.instagram.com/p/DfGajTlicw9/?img_index=1" });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe("queued");
      expect(typeof res.body.id).toBe("string");
    });
  });

  describe("GET /api/v1/checks/:id", () => {
    it("mengembalikan 404 ketika ID tidak ditemukan", async () => {
      vi.mocked(dbRepo.getCheckDetail).mockResolvedValue(null);

      const res = await request(app).get(`/api/v1/checks/${randomUUID()}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Check not found");
    });

    it("mengembalikan detail pengecekan ketika ID ditemukan", async () => {
      const mockId = randomUUID();
      vi.mocked(dbRepo.getCheckDetail).mockResolvedValue({
        id: mockId,
        sourceUrl: "https://news.detik.com/berita/d-123456/fakta",
        normalizedUrl: "https://news.detik.com/berita/d-123456/fakta",
        inputText: null,
        inputType: "url",
        platform: "Web Article",
        status: "completed",
        progressStage: "completed",
        errorCode: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        events: [],
        mediaAssets: [],
        transcripts: [],
        ocrResults: [],
        sources: [],
        analysisResult: {
          id: randomUUID(),
          checkId: mockId,
          verdict: "Verified",
          confidence: 0.9 as any,
          summary: "Klaim terverifikasi",
          explanation: "Penjelasan lengkap",
          claims: [],
          modelVersion: "v1",
          createdAt: new Date(),
        },
      } as any);

      const res = await request(app).get(`/api/v1/checks/${mockId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mockId);
      expect(res.body.status).toBe("completed");
      expect(res.body.result?.verdict).toBe("Verified");
    });
  });
});
