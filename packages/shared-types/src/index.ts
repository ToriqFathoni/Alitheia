import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  1. Domain Enums                                                           */
/* -------------------------------------------------------------------------- */
export const NliLabelEnum = z.enum(["ENTAILMENT", "CONTRADICTION", "NEUTRAL"]);
export type NliLabel = z.infer<typeof NliLabelEnum>;

export const HasilAkhirEnum = z.enum(["BENAR", "SALAH", "TIDAK_PASTI"]);
export type HasilAkhir = z.infer<typeof HasilAkhirEnum>;

export const StatusVerifikasiEnum = z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]);
export type StatusVerifikasi = z.infer<typeof StatusVerifikasiEnum>;

export const AsalBuktiEnum = z.enum(["FACT_CHECK_API", "WEB_SEARCH", "VECTOR_DB"]);
export type AsalBukti = z.infer<typeof AsalBuktiEnum>;

export const PeranPenggunaEnum = z.enum(["PUBLIK", "JURNALIS", "KREATOR", "AUDITOR", "ADMIN"]);
export type PeranPengguna = z.infer<typeof PeranPenggunaEnum>;

export const TipeInputEnum = z.enum(["TEKS", "URL", "DOKUMEN"]);
export type TipeInput = z.infer<typeof TipeInputEnum>;

/* -------------------------------------------------------------------------- */
/*  2. Standard API Response Envelopes                                        */
/* -------------------------------------------------------------------------- */
export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp?: string;
  };
}

export interface ApiResponseError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
  };
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

/* -------------------------------------------------------------------------- */
/*  3. Request & Param Schemas                                                */
/* -------------------------------------------------------------------------- */
export const CreateVerificationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TEKS"),
    text: z
      .string()
      .min(20, "Teks minimal 20 karakter.")
      .refine((val) => val.trim().split(/\s+/).length <= 15000, {
        message: "Maksimal panjang teks adalah 15.000 kata.",
      }),
  }),
  z.object({
    type: z.literal("URL"),
    url: z.string().url("Format URL tidak valid (harus menyertakan http/https)."),
  }),
]);

export type CreateVerificationDTO = z.infer<typeof CreateVerificationSchema>;

export const VerificationIdParamSchema = z.object({
  id: z.string().uuid("Parameter id harus berformat UUID yang valid."),
});
export type VerificationIdParamDTO = z.infer<typeof VerificationIdParamSchema>;

export const CreateVerificationResponseDataSchema = z.object({
  verificationId: z.string().uuid(),
  status: StatusVerifikasiEnum,
  pollUrl: z.string(),
});
export type CreateVerificationResponseDTO = z.infer<typeof CreateVerificationResponseDataSchema>;

/* -------------------------------------------------------------------------- */
/*  4. Detail Response Schemas (Polling Result)                               */
/* -------------------------------------------------------------------------- */
export const EvidenceSchema = z.object({
  origin: AsalBuktiEnum,
  url: z.string().nullable().optional(),
  quote: z.string().nullable().optional(),
});
export type EvidenceDTO = z.infer<typeof EvidenceSchema>;

export const ClaimPredictionSchema = z.object({
  id: z.string().uuid().or(z.string()),
  labelNli: NliLabelEnum,
  confidence: z.number().min(0).max(1),
  finalResult: HasilAkhirEnum,
  explanation: z.string().optional(),
});
export type ClaimPredictionDTO = z.infer<typeof ClaimPredictionSchema>;

export const VerifiedClaimSchema = z.object({
  id: z.string().uuid().or(z.string()),
  kalimatKlaim: z.string(),
  span: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  }),
  spo: z.object({
    subject: z.string().optional(),
    action: z.string().optional(),
    object: z.string().optional(),
  }),
  prediction: ClaimPredictionSchema,
  evidence: z.array(EvidenceSchema),
});
export type VerifiedClaimDTO = z.infer<typeof VerifiedClaimSchema>;

export const VerificationDetailDataSchema = z.object({
  id: z.string().uuid().or(z.string()),
  status: StatusVerifikasiEnum,
  createdAt: z.string().optional(),
  progress: z
    .object({
      stage: z.string(),
      percent: z.number().min(0).max(100),
    })
    .optional(),
  input: z.object({
    type: TipeInputEnum,
    text: z.string().optional(),
    sourceUrl: z.string().optional(),
    title: z.string().optional(),
  }),
  overview: z.object({
    credibilityScore: z.number().min(0).max(1),
    counts: z.object({
      benar: z.number().int().nonnegative(),
      salah: z.number().int().nonnegative(),
      tidakPasti: z.number().int().nonnegative(),
    }),
  }),
  claims: z.array(VerifiedClaimSchema),
});

export type VerificationDetailDataDTO = z.infer<typeof VerificationDetailDataSchema>;

/* -------------------------------------------------------------------------- */
/*  5. LLM API Output & Training Data Schemas                                 */
/* -------------------------------------------------------------------------- */
export const LlmClaimDetailSchema = z.object({
  claim: z.string(),
  verdict: HasilAkhirEnum,
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
  subject: z.string().optional(),
  action: z.string().optional(),
  object: z.string().optional(),
});
export type LlmClaimDetailDTO = z.infer<typeof LlmClaimDetailSchema>;

export const LlmVerificationOutputSchema = z.object({
  label: z.union([z.literal(0), z.literal(1)]), // 1 = Hoax (SALAH), 0 = Fakta (BENAR)
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
  claims: z.array(LlmClaimDetailSchema).default([]),
  suggestedSources: z
    .array(
      z.object({
        title: z.string().optional(),
        url: z.string().optional(),
        snippet: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});
export type LlmVerificationOutputDTO = z.infer<typeof LlmVerificationOutputSchema>;

export const TrainingDataItemSchema = z.object({
  id: z.string(),
  seqId: z.number().int().optional(),
  externalId: z.string().nullable().optional(),
  label: z.number().int(),
  tanggal: z.string().nullable().optional(),
  judul: z.string(),
  narasi: z.string(),
  namaFileGambar: z.string().nullable().optional(),
  asalData: z.string(),
  skorKepercayaan: z.number(),
  createdAt: z.string().optional(),
});
export type TrainingDataItemDTO = z.infer<typeof TrainingDataItemSchema>;

