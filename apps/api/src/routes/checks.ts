import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  findRecentByNormalizedUrl,
  createCheck,
  addCheckEvent,
  updateCheckStatus,
  completeCheck,
  saveAnalysis,
  getCheckDetail,
  listChecks,
  deleteCheck,
} from '@alitheia/database';
import type { CheckWithRelations } from '@alitheia/database';
import { enqueueCheck } from '../services/queue.js';
import { postRateLimiter, getRateLimiter } from '../middleware/rateLimiter.js';
import { inspectUrl } from '../modules/ingestion/url-validator.js';
import { articleExtractor } from '../modules/ingestion/extractors/article.extractor.js';
import { orchestratorService } from '../modules/orchestrator/orchestrator.service.js';
import { verificationRepository } from '../modules/verification/verification.repository.js';
import { logger } from '../lib/logger.js';

import { randomUUID } from 'node:crypto';

const inMemoryChecks = new Map<string, any>();

async function safeCreateCheck(data: {
  sourceUrl: string;
  normalizedUrl: string;
  platform?: string | null;
  inputText?: string | null;
  inputType?: string;
}): Promise<any> {
  try {
    return await createCheck(data);
  } catch (err: any) {
    logger.warn({ error: err?.message }, '[ChecksRoute] Database offline, menggunakan in-memory check store.');
    const id = randomUUID();
    const item = {
      id,
      sourceUrl: data.sourceUrl,
      normalizedUrl: data.normalizedUrl,
      platform: data.platform ?? null,
      inputText: data.inputText ?? null,
      inputType: data.inputType ?? 'url',
      status: 'queued',
      progressStage: 'init',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      events: [],
      mediaAssets: [],
      transcripts: [],
      ocrResults: [],
      sources: [],
      analysisResult: null,
      errorCode: null,
      errorMessage: null,
    };
    inMemoryChecks.set(id, item);
    return item;
  }
}

async function safeAddCheckEvent(checkId: string, stage: string, status: string, detail?: string): Promise<any> {
  try {
    return await addCheckEvent(checkId, stage, status, detail);
  } catch {
    const item = inMemoryChecks.get(checkId);
    if (item) {
      item.events.push({
        id: item.events.length + 1,
        stage,
        status,
        detail: detail || '',
        createdAt: new Date(),
      });
    }
    return 1;
  }
}

async function safeUpdateCheckStatus(checkId: string, status: string, progressStage?: string, error?: { code: string; message: string }): Promise<void> {
  try {
    await updateCheckStatus(checkId, status, progressStage, error);
  } catch {
    const item = inMemoryChecks.get(checkId);
    if (item) {
      item.status = status;
      if (progressStage) item.progressStage = progressStage;
      if (error) {
        item.errorCode = error.code;
        item.errorMessage = error.message;
      }
      item.updatedAt = new Date();
    }
  }
}

async function safeSaveAnalysis(checkId: string, analysis: any, sources: any[]): Promise<any> {
  try {
    return await saveAnalysis(checkId, analysis, sources);
  } catch {
    const item = inMemoryChecks.get(checkId);
    if (item) {
      item.analysisResult = {
        id: randomUUID(),
        checkId,
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        summary: analysis.summary,
        explanation: analysis.explanation,
        claims: analysis.claims,
        modelVersion: analysis.modelVersion,
        createdAt: new Date(),
      };
      item.sources = sources.map((s, idx) => ({
        id: `src-${idx + 1}`,
        checkId,
        title: s.title,
        url: s.url,
        publisher: s.publisher,
        publishedAt: null,
        snippet: s.snippet,
        stance: s.stance,
        createdAt: new Date(),
      }));
    }
    return null;
  }
}

async function safeCompleteCheck(checkId: string): Promise<void> {
  try {
    await completeCheck(checkId);
  } catch {
    const item = inMemoryChecks.get(checkId);
    if (item) {
      item.status = 'completed';
      item.progressStage = 'done';
      item.completedAt = new Date();
      item.updatedAt = new Date();
    }
  }
}

const router = Router();

function formatCheckDetail(check: CheckWithRelations) {
  const steps = (check.events ?? []).map((e) => ({
    id: e.id,
    stage: e.stage,
    status: e.status,
    detail: e.detail,
    created_at: e.createdAt.toISOString(),
  }));

  const primaryMedia = check.mediaAssets?.[0] ?? null;
  const media = primaryMedia
    ? {
        id: primaryMedia.id,
        media_type: primaryMedia.mediaType,
        storage_key: primaryMedia.storageKey,
        mime_type: primaryMedia.mimeType,
        size_bytes:
          primaryMedia.sizeBytes !== null ? Number(primaryMedia.sizeBytes) : null,
        duration_sec:
          primaryMedia.durationSec !== null ? Number(primaryMedia.durationSec) : null,
        sha256: primaryMedia.sha256,
        caption: primaryMedia.caption,
        author_handle: primaryMedia.authorHandle,
        posted_at: primaryMedia.postedAt ? primaryMedia.postedAt.toISOString() : null,
        expires_at: primaryMedia.expiresAt ? primaryMedia.expiresAt.toISOString() : null,
        created_at: primaryMedia.createdAt.toISOString(),
      }
    : null;

  const primaryTranscript = check.transcripts?.[0] ?? null;
  const transcript = primaryTranscript
    ? {
        id: primaryTranscript.id,
        language: primaryTranscript.language,
        full_text: primaryTranscript.fullText,
        segments: primaryTranscript.segments,
        provider: primaryTranscript.provider,
        created_at: primaryTranscript.createdAt.toISOString(),
      }
    : null;

  const ocr =
    check.ocrResults && check.ocrResults.length > 0
      ? check.ocrResults.map((o) => ({
          id: o.id,
          source: o.source,
          frame_time_sec:
            o.frameTimeSec !== null ? Number(o.frameTimeSec) : null,
          full_text: o.fullText,
          blocks: o.blocks,
          provider: o.provider,
          created_at: o.createdAt.toISOString(),
        }))
      : null;

  const result = check.analysisResult
    ? {
        id: check.analysisResult.id,
        verdict: check.analysisResult.verdict,
        confidence:
          check.analysisResult.confidence !== null
            ? Number(check.analysisResult.confidence)
            : null,
        summary: check.analysisResult.summary,
        explanation: check.analysisResult.explanation,
        claims: check.analysisResult.claims,
        model_version: check.analysisResult.modelVersion,
        sources: (check.sources ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          publisher: s.publisher,
          published_at: s.publishedAt ? s.publishedAt.toISOString() : null,
          snippet: s.snippet,
          stance: s.stance,
          created_at: s.createdAt.toISOString(),
        })),
        created_at: check.analysisResult.createdAt.toISOString(),
      }
    : null;

  const error =
    check.errorCode || check.errorMessage
      ? {
          code: check.errorCode ?? 'UNKNOWN_ERROR',
          message: check.errorMessage ?? 'An error occurred during processing',
        }
      : null;

  return {
    id: check.id,
    status: check.status,
    progress: {
      stage: check.progressStage || check.status,
      steps,
    },
    source_url: check.sourceUrl,
    input_text: check.inputText ?? null,
    input_type: check.inputType ?? 'url',
    platform: check.platform,
    media,
    transcript,
    ocr,
    result,
    error,
    created_at: check.createdAt.toISOString(),
    completed_at: check.completedAt ? check.completedAt.toISOString() : null,
  };
}

/**
 * Konversi kueri dari tabel riwayat_kueri ke format detail CheckDetail
 * untuk memastikan kompatibilitas penuh dengan antarmuka frontend /checks/:id
 */
function formatKueriAsCheckDetail(kueri: any) {
  const isDone = kueri.status === "DONE";
  const isFailed = kueri.status === "FAILED";
  const status = isDone ? "completed" : isFailed ? "failed" : "analyzing";

  const steps = [
    {
      id: 1,
      stage: "download",
      status: "succeeded",
      detail: "Konten sumber berhasil diterima",
      created_at: kueri.createdAt.toISOString(),
    },
    {
      id: 2,
      stage: "extract",
      status: "succeeded",
      detail: "Ekstraksi dan sanitasi teks artikel selesai",
      created_at: kueri.createdAt.toISOString(),
    },
    {
      id: 3,
      stage: "analyze",
      status: isDone ? "succeeded" : isFailed ? "failed" : "started",
      detail: isDone ? "Verifikasi klaim dan inferensi NLI selesai" : "Menganalisis klaim...",
      created_at: kueri.createdAt.toISOString(),
    },
  ];

  let claims = null;
  let sources: any[] = [];
  let result = null;

  if (kueri.klaim && kueri.klaim.length > 0) {
    sources = kueri.klaim.flatMap((k: any, kIdx: number) =>
      (k.bukti || []).map((b: any, bIdx: number) => ({
        id: `src-${kIdx + 1}-${bIdx + 1}`,
        title: k.subjek || "Sumber Rujukan Terverifikasi",
        url: b.urlRujukan || "https://cekfakta.tempo.co",
        publisher: b.urlRujukan ? new URL(b.urlRujukan).hostname : "Pemeriksa Fakta",
        stance: k.logPrediksi[0]?.hasilAkhir === "BENAR" ? "SUPPORTS" : k.logPrediksi[0]?.hasilAkhir === "SALAH" ? "REFUTES" : "NEUTRAL",
        snippet: b.kutipan || "",
        created_at: b.createdAt ? b.createdAt.toISOString() : kueri.createdAt.toISOString(),
      }))
    );

    claims = kueri.klaim.map((k: any) => {
      const pred = k.logPrediksi?.[0];
      const verdict = pred?.hasilAkhir === "BENAR" ? "Verified" : pred?.hasilAkhir === "SALAH" ? "Hoax" : "Unverified";
      return {
        text: k.kalimatKlaim,
        verdict,
        explanation: (pred?.metadataKonteks as any)?.explanation || "Klaim diverifikasi terhadap rujukan independen.",
        source_ids: sources.map((s) => s.id),
      };
    });

    const isAllBenar = kueri.klaim.every((k: any) => k.logPrediksi?.[0]?.hasilAkhir === "BENAR");
    const isAnySalah = kueri.klaim.some((k: any) => k.logPrediksi?.[0]?.hasilAkhir === "SALAH");
    const overallVerdict = isAllBenar ? "Verified" : isAnySalah ? "Hoax" : "Unverified";
    const confidence = Number(kueri.klaim[0]?.logPrediksi?.[0]?.skorKepercayaan ?? 0.85);

    result = {
      id: kueri.id,
      verdict: overallVerdict,
      confidence,
      summary: `Dianalisis dari ${kueri.klaim.length} klaim faktual dalam konten.`,
      explanation: (kueri.klaim[0]?.logPrediksi?.[0]?.metadataKonteks as any)?.explanation || "Hasil verifikasi berbasis bukti rujukan terpercaya.",
      claims,
      model_version: "alitheia-orchestrator-v1",
      sources,
      created_at: kueri.createdAt.toISOString(),
    };
  }

  return {
    id: kueri.id,
    status,
    progress: {
      stage: status,
      steps,
    },
    source_url: kueri.urlSumber || "",
    input_text: kueri.inputTeks ?? null,
    input_type: kueri.tipeInput === "TEKS" ? "text" : "url",
    platform: kueri.urlSumber ? "Web Article" : "Text",
    media: null,
    transcript: null,
    ocr: null,
    result,
    error: isFailed ? { code: "PROCESSING_FAILED", message: "Gagal memproses verifikasi klaim" } : null,
    created_at: kueri.createdAt.toISOString(),
    completed_at: isDone ? kueri.createdAt.toISOString() : null,
  };
}

/**
 * POST /api/v1/checks
 * Endpoint terpadu untuk membuat permintaan verifikasi tautan maupun teks langsung.
 * Dilengkapi Anti-SSRF guard komprehensif dan deteksi platform cerdas.
 */
router.post(
  '/api/v1/checks',
  postRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url, text, force } = (req.body ?? {}) as {
        url?: unknown;
        text?: unknown;
        force?: unknown;
      };

      const isForced = force === true || force === 'true';

      // ── 1. Text-based check ──────────────────────────────────────
      if (text && typeof text === 'string') {
        const trimmed = text.trim();
        if (trimmed.length < 10) {
          return res.status(400).json({ error: 'Teks minimal harus memuat 10 karakter untuk dianalisis.' });
        }
        const wordCount = trimmed.split(/\s+/).length;
        if (wordCount > 15000) {
          return res.status(400).json({ error: 'Panjang teks melebihi batas maksimal 15.000 kata.' });
        }

        const check = await safeCreateCheck({
          sourceUrl: '',
          normalizedUrl: '',
          inputText: trimmed,
          inputType: 'text',
          platform: 'Text',
        });

        await safeAddCheckEvent(check.id, 'download', 'succeeded', 'Teks masukan berhasil diterima');
        await safeAddCheckEvent(check.id, 'extract', 'succeeded', `Teks diproses (${trimmed.length} karakter)`);

        // Proses asinkron melalui orchestrator
        setImmediate(async () => {
          try {
            await safeUpdateCheckStatus(check.id, 'analyzing', 'analyzing');
            await safeAddCheckEvent(check.id, 'analyze', 'started', 'Menganalisis klaim dari teks masukan...');

            const extracted = {
              text: trimmed,
              title: 'Masukan Teks Langsung',
              contentType: 'PLAIN_TEXT' as const,
            };

            const result = await orchestratorService.verify(extracted);

            const sources = result.claims.flatMap((c) =>
              c.bukti.map((b) => ({
                title: b.judulRujukan || c.subjek || 'Sumber Rujukan Terpercaya',
                url: b.urlRujukan || 'https://cekfakta.tempo.co',
                publisher: b.penerbit || (b.urlRujukan ? new URL(b.urlRujukan).hostname : 'Pemeriksa Fakta'),
                stance: c.prediction.hasilAkhir === 'BENAR' ? 'SUPPORTS' : c.prediction.hasilAkhir === 'SALAH' ? 'REFUTES' : 'NEUTRAL',
                snippet: b.kutipan || '',
              }))
            );

            const claimsForDb = result.claims.map((c) => ({
              text: c.kalimatKlaim,
              verdict: c.prediction.hasilAkhir === 'BENAR' ? 'True' : c.prediction.hasilAkhir === 'SALAH' ? 'False' : 'Unverified',
              explanation: c.prediction.explanation || 'Klaim diuji terhadap rujukan independen.',
              source_ids: sources.map((_, sIdx) => `src-${sIdx + 1}`),
            }));

            const isAllBenar = result.claims.every((c) => c.prediction.hasilAkhir === 'BENAR');
            const isAnySalah = result.claims.some((c) => c.prediction.hasilAkhir === 'SALAH');
            const overallVerdict = isAllBenar ? 'True' : isAnySalah ? 'False' : 'Unverified';

            await safeSaveAnalysis(
              check.id,
              {
                verdict: overallVerdict,
                confidence: result.claims.length > 0 && result.claims[0] ? result.claims[0].prediction.skorKepercayaan : 0.85,
                summary: `Dianalisis dari ${result.claims.length} klaim dalam teks.`,
                explanation: result.claims[0]?.prediction.explanation || 'Verifikasi teks selesai.',
                claims: claimsForDb,
                modelVersion: 'alitheia-orchestrator-v1',
              },
              sources
            );

            await safeAddCheckEvent(check.id, 'analyze', 'succeeded', 'Analisis klaim berhasil diselesaikan.');
            await safeCompleteCheck(check.id);
          } catch (err: unknown) {
            logger.error({ err, checkId: check.id }, '[ChecksRoute] Gagal menganalisis teks');
            await safeUpdateCheckStatus(check.id, 'failed', 'failed', {
              code: 'ANALYSIS_FAILED',
              message: err instanceof Error ? err.message : String(err),
            });
            await safeAddCheckEvent(check.id, 'analyze', 'failed', err instanceof Error ? err.message : String(err));
          }
        });

        return res.status(202).json({
          id: check.id,
          status: 'queued',
          cached: false,
        });
      }

      // ── 2. URL-based check (dengan Anti-SSRF dan Deteksi Platform) ──
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Mohon masukkan tautan (URL) atau teks yang ingin diverifikasi.' });
      }

      // Inspeksi format, Anti-SSRF, DNS, soft-404 YouTube, dan akun privat Instagram
      const inspection = await inspectUrl(url);

      if (!inspection.isValid) {
        const statusCode =
          inspection.status === 'PRIVATE_OR_RESTRICTED'
            ? 403
            : inspection.status === 'DELETED_OR_NOT_FOUND'
            ? 404
            : 400;

        return res.status(statusCode).json({
          error: inspection.message,
          code: inspection.status,
        });
      }

      const normalizedUrl = inspection.normalizedUrl || url;
      const detection = inspection.detection;
      const isSocialMedia = detection?.isSocialMedia ?? false;
      const platformLabel =
        detection?.platform === 'GENERIC_ARTICLE'
          ? 'Web Article'
          : detection?.platform || 'Web';

      // Pengecekan Cache
      if (!isForced) {
        const cached = await findRecentByNormalizedUrl(normalizedUrl, 7);
        if (cached && cached.status === 'completed') {
          return res.status(200).json({
            id: cached.id,
            status: 'completed',
            cached: true,
          });
        }
      }

      const check = await safeCreateCheck({
        sourceUrl: url,
        normalizedUrl,
        platform: platformLabel,
        inputType: 'url',
      });

      // ── ALUR A: Artikel Berita Web Biasa (Readability + Orchestrator) ──
      if (!isSocialMedia || detection?.contentType === 'ARTICLE') {
        await safeAddCheckEvent(check.id, 'download', 'succeeded', 'Format URL valid dan lolos verifikasi Anti-SSRF.');

        setImmediate(async () => {
          try {
            await safeUpdateCheckStatus(check.id, 'extracting', 'extracting');
            await safeAddCheckEvent(check.id, 'extract', 'started', 'Mengekstrak teks berita daring...');

            const extracted = await articleExtractor.extractFromUrl(url);
            await safeAddCheckEvent(check.id, 'extract', 'succeeded', `Berhasil mengekstrak artikel: "${extracted.title || 'Artikel'}"`);

            await safeUpdateCheckStatus(check.id, 'analyzing', 'analyzing');
            await safeAddCheckEvent(check.id, 'analyze', 'started', 'Menjalankan orkestrasi pencocokan bukti dan inferensi NLI...');

            const result = await orchestratorService.verify(extracted);

            const sources = result.claims.flatMap((c) =>
              c.bukti.map((b) => ({
                title: b.judulRujukan || c.subjek || 'Sumber Rujukan',
                url: b.urlRujukan || url,
                publisher: b.penerbit || (b.urlRujukan ? new URL(b.urlRujukan).hostname : 'Pemeriksa Fakta'),
                stance: c.prediction.hasilAkhir === 'BENAR' ? 'SUPPORTS' : c.prediction.hasilAkhir === 'SALAH' ? 'REFUTES' : 'NEUTRAL',
                snippet: b.kutipan || '',
              }))
            );

            const claimsForDb = result.claims.map((c) => ({
              text: c.kalimatKlaim,
              verdict: c.prediction.hasilAkhir === 'BENAR' ? 'True' : c.prediction.hasilAkhir === 'SALAH' ? 'False' : 'Unverified',
              explanation: c.prediction.explanation || 'Klaim dicocokkan dengan rujukan berita resmi.',
              source_ids: sources.map((_, sIdx) => `src-${sIdx + 1}`),
            }));

            const isAllBenar = result.claims.every((c) => c.prediction.hasilAkhir === 'BENAR');
            const isAnySalah = result.claims.some((c) => c.prediction.hasilAkhir === 'SALAH');
            const overallVerdict = isAllBenar ? 'True' : isAnySalah ? 'False' : 'Unverified';

            await safeSaveAnalysis(
              check.id,
              {
                verdict: overallVerdict,
                confidence: result.claims.length > 0 && result.claims[0] ? result.claims[0].prediction.skorKepercayaan : 0.88,
                summary: `Dianalisis dari artikel: ${extracted.title || 'Berita Daring'}`,
                explanation: result.claims[0]?.prediction.explanation || 'Analisis artikel selesai.',
                claims: claimsForDb,
                modelVersion: 'alitheia-orchestrator-v1',
              },
              sources
            );

            await safeAddCheckEvent(check.id, 'analyze', 'succeeded', 'Analisis klaim artikel berhasil diselesaikan.');
            await safeCompleteCheck(check.id);
          } catch (err: unknown) {
            logger.error({ err, checkId: check.id }, '[ChecksRoute] Gagal mengekstrak/menganalisis artikel');
            await safeUpdateCheckStatus(check.id, 'failed', 'failed', {
              code: 'EXTRACTION_OR_ANALYSIS_FAILED',
              message: err instanceof Error ? err.message : String(err),
            });
            await safeAddCheckEvent(check.id, 'analyze', 'failed', err instanceof Error ? err.message : String(err));
          }
        });

        return res.status(202).json({
          id: check.id,
          status: 'queued',
          cached: false,
        });
      }

      // ── ALUR B: Media Sosial / Video (TikTok, Instagram, YouTube, X) ──
      await addCheckEvent(check.id, 'queued', 'started', `Tautan ${platformLabel} lolos Anti-SSRF, antrean analisis media siap.`);
      await enqueueCheck(check.id);

      return res.status(202).json({
        id: check.id,
        status: 'queued',
        cached: false,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/checks
 * Menampilkan daftar riwayat verifikasi dengan paginasi dan filter
 */
router.get(
  '/api/v1/checks',
  getRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const pageSize = req.query.page_size
        ? parseInt(String(req.query.page_size), 10)
        : 10;
      const verdict =
        typeof req.query.verdict === 'string' ? req.query.verdict : undefined;
      const platform =
        typeof req.query.platform === 'string' ? req.query.platform : undefined;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;

      let listData: any[] = [];
      let total = 0;
      try {
        const result = await listChecks({
          page: Number.isInteger(page) && page > 0 ? page : 1,
          pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10,
          verdict,
          platform,
          q,
        });
        listData = result.data;
        total = result.total;
      } catch {
        listData = Array.from(inMemoryChecks.values());
        total = listData.length;
      }

      return res.json({
        data: listData.map((c) => ({
          id: c.id,
          source_url: c.sourceUrl,
          normalized_url: c.normalizedUrl,
          // The history rows label each entry by how it was submitted (text vs
          // link) and show its verdict, so both must ride along with the list.
          input_text: c.inputText ?? null,
          input_type: c.inputType ?? null,
          platform: c.platform,
          status: c.status,
          progress_stage: c.progressStage,
          verdict: c.analysisResult?.verdict ?? null,
          error_code: c.errorCode,
          error_message: c.errorMessage,
          created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
          updated_at: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
          completed_at: c.completedAt ? (c.completedAt instanceof Date ? c.completedAt.toISOString() : String(c.completedAt)) : null,
        })),
        total,
        page,
        page_size: pageSize,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/checks/:id
 * Mengambil data detail pengecekan berdasarkan ID (Mendukung tabel checks & riwayat_kueri)
 */
router.get(
  '/api/v1/checks/:id',
  getRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(404).json({ error: 'Check not found' });
      }

      // 1. Cari pada tabel checks
      try {
        const check = await getCheckDetail(id);
        if (check) {
          return res.json(formatCheckDetail(check));
        }
      } catch {
        // Abaikan jika DB offline
      }

      // Check in-memory store jika database offline
      const memCheck = inMemoryChecks.get(id);
      if (memCheck) {
        return res.json(formatCheckDetail(memCheck));
      }

      // 2. Fallback pencarian pada tabel riwayat_kueri (interoperabilitas penuh)
      try {
        const kueri = await verificationRepository.findKueriDetailById(id);
        if (kueri) {
          return res.json(formatKueriAsCheckDetail(kueri));
        }
      } catch {
        // Jika format ID bukan UUID atau tidak ditemukan di riwayat_kueri
      }

      return res.status(404).json({ error: 'Check not found' });
    } catch (err: any) {
      if (err?.code === 'P2023') {
        return res.status(404).json({ error: 'Check not found' });
      }
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/checks/:id
 * Menghapus data pengecekan berdasarkan ID
 */
router.delete(
  '/api/v1/checks/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Check ID is required' });
      }

      const check = await getCheckDetail(id);
      if (!check) {
        return res.status(404).json({ error: 'Check not found' });
      }

      await deleteCheck(id);
      return res.status(204).send();
    } catch (err: any) {
      if (err?.code === 'P2025' || err?.code === 'P2023') {
        return res.status(404).json({ error: 'Check not found' });
      }
      return next(err);
    }
  }
);

export { router as checksRouter };
export default router;
