// Core Domain Models for Alitheia - AI Fake News Detection

export type VeracityRating =
  | "TRUE"
  | "MOSTLY_TRUE"
  | "HALF_TRUE"
  | "MOSTLY_FALSE"
  | "FALSE"
  | "UNVERIFIED";

export interface SourceCredibility {
  domain: string;
  reputationScore: number; // 0 - 100
  historicalAccuracy: number;
}

export interface FactCheckClaim {
  id: string;
  claim: string;
  claimant?: string;
  verdict: VeracityRating;
  confidenceScore: number; // 0.0 - 1.0
  explanation: string;
  sources: string[];
  checkedAt: string;
}

export interface NewsArticleAnalysis {
  id: string;
  title: string;
  content: string;
  author?: string;
  url?: string;
  publishedAt?: string;
  overallRating: VeracityRating;
  confidenceScore: number;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  sensationalismScore: number; // 0.0 - 1.0
  claims: FactCheckClaim[];
  analyzedAt: string;
}

export interface AnalysisRequest {
  url?: string;
  rawText?: string;
  title?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
