import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import type {
  Check,
  MediaAsset,
  Transcript,
  OcrResult,
  AnalysisResult,
  Source,
  CheckEvent,
} from '@prisma/client';

export type {
  Check,
  MediaAsset,
  Transcript,
  OcrResult,
  AnalysisResult,
  Source,
  CheckEvent,
};

export const checkIncludeRelations = {
  mediaAssets: true,
  transcripts: true,
  ocrResults: true,
  analysisResult: true,
  sources: true,
  events: {
    orderBy: { createdAt: 'asc' },
  },
} as const;

export type CheckWithRelations = Prisma.CheckGetPayload<{
  include: typeof checkIncludeRelations;
}>;

// Create a new check
export async function createCheck(data: {
  sourceUrl: string;
  normalizedUrl: string;
  platform?: string | null;
  inputText?: string | null;
  inputType?: string;
}): Promise<Check> {
  return prisma.check.create({
    data: {
      sourceUrl: data.sourceUrl,
      normalizedUrl: data.normalizedUrl,
      platform: data.platform ?? null,
      inputText: data.inputText ?? null,
      inputType: data.inputType ?? 'url',
      status: 'queued',
    },
  });
}

// Update check status + progress stage
export async function updateCheckStatus(
  id: string,
  status: string,
  progressStage?: string,
  error?: { code: string; message: string }
): Promise<Check> {
  return prisma.check.update({
    where: { id },
    data: {
      status,
      ...(progressStage !== undefined ? { progressStage } : {}),
      ...(error ? { errorCode: error.code, errorMessage: error.message } : {}),
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
    },
  });
}

// Mark check as completed
export async function completeCheck(id: string): Promise<Check> {
  return prisma.check.update({
    where: { id },
    data: {
      status: 'completed',
      progressStage: 'completed',
      completedAt: new Date(),
    },
  });
}

// Save media asset
export async function saveMediaAsset(
  data: Prisma.MediaAssetCreateInput | Prisma.MediaAssetUncheckedCreateInput
): Promise<MediaAsset> {
  return prisma.mediaAsset.create({
    data: data as Prisma.MediaAssetCreateInput,
  });
}

// Save transcript
export async function saveTranscript(data: {
  checkId: string;
  language?: string;
  fullText: string;
  segments?: any;
  provider?: string;
}): Promise<Transcript> {
  return prisma.transcript.create({
    data: {
      checkId: data.checkId,
      language: data.language,
      fullText: data.fullText,
      segments: data.segments !== undefined ? (data.segments ?? Prisma.JsonNull) : undefined,
      provider: data.provider,
    },
  });
}

// Save OCR result  
export async function saveOcrResult(data: {
  checkId: string;
  source: string;
  frameTimeSec?: number;
  fullText: string;
  blocks?: any;
  provider?: string;
}): Promise<OcrResult> {
  return prisma.ocrResult.create({
    data: {
      checkId: data.checkId,
      source: data.source,
      frameTimeSec:
        data.frameTimeSec !== undefined
          ? new Prisma.Decimal(data.frameTimeSec)
          : undefined,
      fullText: data.fullText,
      blocks: data.blocks !== undefined ? (data.blocks ?? Prisma.JsonNull) : undefined,
      provider: data.provider,
    },
  });
}

// Save analysis result + sources
export async function saveAnalysis(
  checkId: string,
  result: {
    verdict: string;
    confidence?: number;
    summary?: string;
    explanation: string;
    claims?: any;
    modelVersion?: string;
  },
  sources: {
    title?: string;
    url: string;
    publisher?: string;
    publishedAt?: Date;
    snippet?: string;
    stance?: string;
  }[]
): Promise<AnalysisResult> {
  return prisma.$transaction(async (tx) => {
    const analysis = await tx.analysisResult.upsert({
      where: { checkId },
      create: {
        checkId,
        verdict: result.verdict,
        confidence:
          result.confidence !== undefined
            ? new Prisma.Decimal(result.confidence)
            : undefined,
        summary: result.summary,
        explanation: result.explanation,
        claims:
          result.claims !== undefined
            ? (result.claims ?? Prisma.JsonNull)
            : undefined,
        modelVersion: result.modelVersion,
      },
      update: {
        verdict: result.verdict,
        confidence:
          result.confidence !== undefined
            ? new Prisma.Decimal(result.confidence)
            : undefined,
        summary: result.summary,
        explanation: result.explanation,
        claims:
          result.claims !== undefined
            ? (result.claims ?? Prisma.JsonNull)
            : undefined,
        modelVersion: result.modelVersion,
      },
    });

    if (sources !== undefined) {
      await tx.source.deleteMany({
        where: { checkId },
      });

      if (sources.length > 0) {
        await tx.source.createMany({
          data: sources.map((s) => ({
            checkId,
            title: s.title,
            url: s.url,
            publisher: s.publisher,
            publishedAt: s.publishedAt,
            snippet: s.snippet,
            stance: s.stance,
          })),
        });
      }
    }

    return analysis;
  });
}

// Get full check detail (with all relations)
export async function getCheckDetail(id: string): Promise<CheckWithRelations | null> {
  return prisma.check.findUnique({
    where: { id },
    include: checkIncludeRelations,
  });
}

// List checks with pagination and filters
export async function listChecks(options: {
  page?: number;
  pageSize?: number;
  verdict?: string;
  platform?: string;
  q?: string;
} = {}): Promise<{
  data: Check[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, options.pageSize ?? 10);
  const skip = (page - 1) * pageSize;

  const where: Prisma.CheckWhereInput = {};

  if (options.platform) {
    where.platform = {
      equals: options.platform,
      mode: 'insensitive',
    };
  }

  if (options.verdict) {
    where.analysisResult = {
      verdict: {
        equals: options.verdict,
        mode: 'insensitive',
      },
    };
  }

  if (options.q) {
    const q = options.q.trim();
    if (q) {
      where.OR = [
        { sourceUrl: { contains: q, mode: 'insensitive' } },
        { normalizedUrl: { contains: q, mode: 'insensitive' } },
        { analysisResult: { summary: { contains: q, mode: 'insensitive' } } },
        { analysisResult: { explanation: { contains: q, mode: 'insensitive' } } },
      ];
    }
  }

  const [total, data] = await Promise.all([
    prisma.check.count({ where }),
    prisma.check.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data,
    total,
    page,
    pageSize,
  };
}

// Find recent completed check by normalized URL (for cache)
export async function findRecentByNormalizedUrl(
  normalizedUrl: string,
  cacheDays: number
): Promise<Check | null> {
  const where: Prisma.CheckWhereInput = {
    normalizedUrl,
    status: 'completed',
  };

  if (cacheDays > 0) {
    const cutoff = new Date(Date.now() - cacheDays * 24 * 60 * 60 * 1000);
    where.createdAt = {
      gte: cutoff,
    };
  }

  return prisma.check.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

// Add a check event
export async function addCheckEvent(
  checkId: string,
  stage: string,
  status: string,
  detail?: string
): Promise<CheckEvent> {
  return prisma.checkEvent.create({
    data: {
      checkId,
      stage,
      status,
      detail,
    },
  });
}

// Delete check
export async function deleteCheck(id: string): Promise<void> {
  await prisma.check.delete({
    where: { id },
  });
}
