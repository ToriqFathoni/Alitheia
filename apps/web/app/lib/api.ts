const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface CheckStep {
  id?: number | string;
  stage: string;
  status: string;
  detail?: string | null;
  created_at?: string;
}

export interface CheckProgress {
  stage: string;
  steps: CheckStep[];
}

export interface MediaAssetInfo {
  id: string;
  media_type: string;
  storage_key?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  duration_sec?: number | null;
  sha256?: string | null;
  caption?: string | null;
  author_handle?: string | null;
  posted_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptInfo {
  id?: string;
  language: string;
  full_text: string;
  segments: TranscriptSegment[];
  provider?: string | null;
  created_at?: string;
}

export interface OcrResultInfo {
  id?: string;
  source: string;
  frame_time_sec: number | null;
  full_text: string;
  blocks?: unknown;
  provider?: string | null;
  created_at?: string;
}

export interface ClaimInfo {
  text: string;
  verdict: string;
  explanation: string;
  source_ids: string[];
}

export interface SourceInfo {
  id: string;
  title: string;
  url: string;
  publisher: string;
  published_at?: string | null;
  stance: string;
  snippet?: string;
  created_at?: string;
}

export interface AnalysisResultInfo {
  id: string;
  verdict: string;
  confidence: number | null;
  summary: string | null;
  explanation: string;
  claims: ClaimInfo[] | null;
  model_version?: string | null;
  sources: SourceInfo[];
  created_at: string;
}

export interface CheckError {
  code: string;
  message: string;
}

export interface CheckDetail {
  id: string;
  status: string;
  progress: CheckProgress;
  source_url: string;
  input_text?: string | null;
  input_type?: string;
  platform?: string | null;
  media: MediaAssetInfo | null;
  transcript: TranscriptInfo | null;
  ocr: OcrResultInfo[] | null;
  result: AnalysisResultInfo | null;
  error: CheckError | null;
  created_at: string;
  completed_at?: string | null;
}

export interface CheckListItem {
  id: string;
  source_url: string;
  normalized_url?: string;
  input_text?: string | null;
  input_type?: string;
  platform?: string | null;
  status: string;
  progress_stage?: string | null;
  verdict?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
}

export interface ListChecksResponse {
  data: CheckListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface SubmitCheckResponse {
  id: string;
  status: string;
  cached?: boolean;
  error?: string;
}

export async function submitCheck(url: string, force = false): Promise<SubmitCheckResponse> {
  const res = await fetch(`${API_BASE}/api/v1/checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, force }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: Failed to submit check`);
  }
  return data;
}

export async function submitTextCheck(text: string): Promise<SubmitCheckResponse> {
  const res = await fetch(`${API_BASE}/api/v1/checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: Failed to submit text check`);
  }
  return data;
}

export async function getCheck(id: string): Promise<CheckDetail> {
  const res = await fetch(`${API_BASE}/api/v1/checks/${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Check not found');
  }
  return res.json();
}

export async function listChecks(
  params: {
    page?: number;
    page_size?: number;
    verdict?: string;
    platform?: string;
    q?: string;
  } = {}
): Promise<ListChecksResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.set(k, String(v));
  });
  const res = await fetch(`${API_BASE}/api/v1/checks?${query}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch checks');
  }
  return res.json();
}

export async function deleteCheck(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/checks/${id}`, { method: 'DELETE' });
}
