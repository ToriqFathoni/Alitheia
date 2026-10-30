import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../app.js";
import { verificationRepository } from "../verification.repository.js";
import { randomUUID } from "node:crypto";

describe("Verification Pipeline Integration Tests (SCRUM-62)", () => {
  // In-memory store untuk simulasi persistensi Prisma di lingkungan pengujian hermetis
  interface StoredKueri {
    id: string;
    tipeInput: string;
    inputTeks: string | null;
    urlSumber: string | null;
    status: string;
    createdAt: Date;
    klaim: any[];
  }

  let dbStore: Map<string, StoredKueri>;

  beforeEach(() => {
    dbStore = new Map();

    vi.spyOn(verificationRepository, "createKueri").mockImplementation(async (input) => {
      const id = randomUUID();
      const kueri: StoredKueri = {
        id,
        tipeInput: input.tipeInput,
        inputTeks: input.inputTeks,
        urlSumber: input.urlSumber,
        status: input.status ?? "PENDING",
        createdAt: new Date(),
        klaim: [],
      };
      dbStore.set(id, kueri);
      return kueri as any;
    });

    vi.spyOn(verificationRepository, "updateKueriStatus").mockImplementation(
      async (id, status, inputTeks) => {
        const item = dbStore.get(id);
        if (item) {
          item.status = status;
          if (inputTeks !== undefined) item.inputTeks = inputTeks;
        }
        return item as any;
      }
    );

    vi.spyOn(verificationRepository, "saveVerificationResults").mockImplementation(
      async (input) => {
        const item = dbStore.get(input.kueriId);
        if (item) {
          item.status = "DONE";
          if (input.inputTeks) item.inputTeks = input.inputTeks;
          item.klaim = input.claims.map((c) => ({
            id: randomUUID(),
            kueriId: input.kueriId,
            kalimatKlaim: c.kalimatKlaim,
            subjek: c.subjek ?? null,
            tindakan: c.tindakan ?? null,
            objek: c.objek ?? null,
            posisiAwal: c.posisiAwal,
            posisiAkhir: c.posisiAkhir,
            createdAt: new Date(),
            bukti: c.bukti.map((b) => ({
              id: randomUUID(),
              asalBukti: b.asalBukti,
              urlRujukan: b.urlRujukan ?? null,
              kutipan: b.kutipan ?? null,
              createdAt: new Date(),
            })),
            logPrediksi: [
              {
                id: randomUUID(),
                labelNli: c.prediction.labelNli,
                skorKepercayaan: c.prediction.skorKepercayaan.toFixed(4),
                hasilAkhir: c.prediction.hasilAkhir,
                metadataKonteks: c.prediction.metadataKonteks,
                createdAt: new Date(),
              },
            ],
          }));
        }
      }
    );

    vi.spyOn(verificationRepository, "findKueriDetailById").mockImplementation(async (id) => {
      const item = dbStore.get(id);
      return (item as any) || null;
    });
  });

  describe("POST /api/v1/verifications (Submit Link)", () => {
    it("menerima URL berita yang valid dan mengembalikan 202 Accepted beserta verificationId", async () => {
      const response = await request(app)
        .post("/api/v1/verifications")
        .send({
          type: "URL",
          url: "https://example.com/berita-terverifikasi",
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("verificationId");
      expect(response.body.data.status).toBe("PENDING");
      expect(response.body.data.pollUrl).toBe(
        `/api/v1/verifications/${response.body.data.verificationId}`
      );
      expect(response.body.meta).toHaveProperty("requestId");
    });

    it("menolak URL berbahaya yang mengarah ke localhost/loopback (SSRF protection)", async () => {
      const response = await request(app)
        .post("/api/v1/verifications")
        .send({
          type: "URL",
          url: "http://localhost:5000/api/health",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.message).toContain("diblokir demi alasan keamanan");
    });

    it("menolak URL berbahaya dengan metadata cloud AWS/GCP (169.254.169.254)", async () => {
      const response = await request(app)
        .post("/api/v1/verifications")
        .send({
          type: "URL",
          url: "http://169.254.169.254/latest/meta-data",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("menolak format URL yang tidak valid", async () => {
      const response = await request(app)
        .post("/api/v1/verifications")
        .send({
          type: "URL",
          url: "bukan-sebuah-url",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("End-to-End: Submit Link -> Trigger Pipeline -> Polling DONE", () => {
    it("menjalankan alur lengkap dari submit link, ekstraksi, orkestrasi hingga polling menghasilkan status DONE", async () => {
      // 1. Submit link
      const postRes = await request(app)
        .post("/api/v1/verifications")
        .send({
          type: "URL",
          url: "https://example.com/artikel-hoax-terverifikasi",
        });

      expect(postRes.status).toBe(202);
      const { verificationId, pollUrl } = postRes.body.data;

      // 2. Tunggu worker asinkron menyelesaikan tugas di microtask / event loop
      await new Promise((resolve) => setTimeout(resolve, 80));

      // 3. Polling hasil verifikasi
      const getRes = await request(app).get(pollUrl);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);

      const data = getRes.body.data;
      expect(data.id).toBe(verificationId);
      expect(data.status).toBe("DONE");
      expect(data.input.type).toBe("URL");
      expect(data.input.sourceUrl).toBe("https://example.com/artikel-hoax-terverifikasi");

      // Validasi overview kredibilitas
      expect(typeof data.overview.credibilityScore).toBe("number");
      expect(data.overview.credibilityScore).toBeGreaterThanOrEqual(0);
      expect(data.overview.credibilityScore).toBeLessThanOrEqual(1);
      expect(data.overview.counts.benar).toBeGreaterThanOrEqual(1);

      // Validasi struktur klaim dan bukti
      expect(data.claims.length).toBeGreaterThan(0);
      const claim = data.claims[0];
      expect(claim).toHaveProperty("kalimatKlaim");
      expect(claim).toHaveProperty("prediction");
      expect(claim.prediction.labelNli).toBe("ENTAILMENT");
      expect(claim.prediction.finalResult).toBe("BENAR");
      expect(claim.evidence.length).toBeGreaterThan(0);
      expect(claim.evidence[0].origin).toBe("FACT_CHECK_API");
    });

    it("mengembalikan 404 ketika polling ID verifikasi yang tidak ada", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app).get(`/api/v1/verifications/${nonExistentId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });
});
