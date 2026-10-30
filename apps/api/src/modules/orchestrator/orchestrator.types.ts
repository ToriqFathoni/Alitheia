import type { NliLabel, HasilAkhir, AsalBukti } from "@alitheia/shared-types";

export type ContentType =
  | "ARTICLE"
  | "SOCIAL_POST"
  | "VIDEO"
  | "DOCUMENT"
  | "IMAGE"
  | "AUDIO"
  | "PLAIN_TEXT";

export interface ExtractedContent {
  text: string;
  title?: string;
  sourceUrl?: string;
  contentType: ContentType;
  metadata?: Record<string, unknown>;
}

export interface ClaimEvidenceItem {
  asalBukti: AsalBukti;
  urlRujukan?: string;
  kutipan?: string;
}

export interface ClaimPredictionResult {
  labelNli: NliLabel;
  skorKepercayaan: number;
  hasilAkhir: HasilAkhir;
  explanation?: string;
  metadataKonteks?: Record<string, unknown>;
}

export interface OrchestratedClaim {
  kalimatKlaim: string;
  subjek?: string;
  tindakan?: string;
  objek?: string;
  posisiAwal: number;
  posisiAkhir: number;
  prediction: ClaimPredictionResult;
  bukti: ClaimEvidenceItem[];
}

export interface VerificationResult {
  credibilityScore: number;
  claims: OrchestratedClaim[];
}

export interface VerificationOrchestrator {
  verify(content: ExtractedContent): Promise<VerificationResult>;
}
