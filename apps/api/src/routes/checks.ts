import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  isValidUrl,
  detectPlatform,
  normalizeUrl,
  findRecentByNormalizedUrl,
  createCheck,
  addCheckEvent,
  getCheckDetail,
  listChecks,
  deleteCheck,
} from '@alitheia/database';
import type { CheckWithRelations } from '@alitheia/database';
import { enqueueCheck } from '../services/queue.js';
import { postRateLimiter, getRateLimiter } from '../middleware/rateLimiter.js';

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
    input_text: (check as any).inputText ?? null,
    input_type: (check as any).inputType ?? 'url',
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
 * POST /api/v1/checks
 * Create a new hoax detection check or return cached result.
 * Accepts either { url: string } or { text: string }.
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

      // ── Text-based check ───────────────────────────────────────
      if (text && typeof text === 'string') {
        const trimmed = text.trim();
        if (trimmed.length < 10) {
          return res.status(400).json({ error: 'Text must be at least 10 characters long' });
        }
        if (trimmed.length > 5000) {
          return res.status(400).json({ error: 'Text must be at most 5000 characters long' });
        }

        const check = await createCheck({
          sourceUrl: '',
          normalizedUrl: '',
          inputText: trimmed,
          inputType: 'text',
        });

        await addCheckEvent(check.id, 'queued', 'started', 'Text check queued for analysis');
        await enqueueCheck(check.id);

        return res.status(202).json({
          id: check.id,
          status: 'queued',
          cached: false,
        });
      }

      // ── URL-based check ────────────────────────────────────────
      if (!url || typeof url !== 'string' || !isValidUrl(url)) {
        return res.status(400).json({ error: 'Please provide a valid URL or text to fact-check' });
      }

      const platform = detectPlatform(url);
      if (platform === 'other') {
        return res.status(422).json({
          error: 'Unsupported platform. Supported platforms are TikTok, Instagram, and Twitter/X.',
        });
      }

      let normalizedUrl: string;
      try {
        normalizedUrl = normalizeUrl(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

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

      const check = await createCheck({
        sourceUrl: url,
        normalizedUrl,
        platform,
        inputType: 'url',
      });

      await addCheckEvent(check.id, 'queued', 'started', 'Check queued for processing');
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
 * List checks with pagination and filtering
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

      const result = await listChecks({
        page: Number.isInteger(page) && page > 0 ? page : 1,
        pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10,
        verdict,
        platform,
        q,
      });

      return res.json({
        data: result.data.map((c) => ({
          id: c.id,
          source_url: c.sourceUrl,
          normalized_url: c.normalizedUrl,
          platform: c.platform,
          status: c.status,
          progress_stage: c.progressStage,
          error_code: c.errorCode,
          error_message: c.errorMessage,
          created_at: c.createdAt.toISOString(),
          updated_at: c.updatedAt.toISOString(),
          completed_at: c.completedAt ? c.completedAt.toISOString() : null,
        })),
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/checks/:id
 * Retrieve check details by ID
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

      const check = await getCheckDetail(id);
      if (!check) {
        return res.status(404).json({ error: 'Check not found' });
      }

      return res.json(formatCheckDetail(check));
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
 * Delete a check by ID
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
