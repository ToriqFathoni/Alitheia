import { LlmVerificationOutputSchema, type LlmVerificationOutputDTO } from "@alitheia/shared-types";
import { env } from "../../../config/env.js";
import { logger } from "../../../lib/logger.js";

export interface LlmCallMeta {
  provider: "gemini" | "9router" | "fallback-rule";
  model: string;
  durationMs: number;
  recoveredFromLimit?: boolean;
}

export interface LlmVerificationResponse {
  result: LlmVerificationOutputDTO;
  meta: LlmCallMeta;
}

/**
 * Klien LLM dengan dukungan failover otomatis (Gemini -> 9Router)
 * dan auto-recovery kembali ke Gemini ketika limit/cooldown Gemini telah berakhir.
 */
export class LlmClient {
  private geminiCooldownUntil = 0;
  private lastProviderUsed: "gemini" | "9router" | "fallback-rule" = "gemini";

  /**
   * Mengetahui apakah Gemini sedang dalam masa cooldown rate-limit.
   */
  public isGeminiInCooldown(): boolean {
    return Date.now() < this.geminiCooldownUntil;
  }

  /**
   * Mengambil timestamp kapan limit Gemini diprediksi selesai di-reset.
   */
  public getCooldownUntil(): number {
    return this.geminiCooldownUntil;
  }

  /**
   * Mengatur secara manual cooldown Gemini (berguna untuk testing).
   */
  public setGeminiCooldown(untilTimestamp: number): void {
    this.geminiCooldownUntil = untilTimestamp;
  }

  /**
   * Reset cooldown secara paksa.
   */
  public resetCooldown(): void {
    this.geminiCooldownUntil = 0;
  }

  private getGeminiKey(): string {
    return (process.env["GEMINI_API_KEY"] ?? env.GEMINI_API_KEY ?? "").trim();
  }

  private getGeminiModel(): string {
    return (process.env["GEMINI_MODEL"] ?? env.GEMINI_MODEL ?? "gemini-3.5-flash-lite").trim();
  }

  private getNineRouterBaseUrl(): string {
    return (process.env["NINEROUTER_BASE_URL"] ?? env.NINEROUTER_BASE_URL ?? "http://localhost:20128/v1").trim();
  }

  private getNineRouterKey(): string {
    return (process.env["NINEROUTER_API_KEY"] ?? env.NINEROUTER_API_KEY ?? "").trim();
  }

  private getNineRouterModel(): string {
    return (process.env["NINEROUTER_MODEL"] ?? env.NINEROUTER_MODEL ?? "kr/claude-haiku-4.5").trim();
  }

  private getCooldownMs(): number {
    const val = Number(process.env["GEMINI_RATE_LIMIT_COOLDOWN_MS"] ?? env.GEMINI_RATE_LIMIT_COOLDOWN_MS);
    return isNaN(val) || val <= 0 ? 60000 : val;
  }

  /**
   * Memanggil LLM untuk verifikasi berita dengan alur:
   * 1. Cek apakah Gemini tersedia dan tidak sedang cooldown.
   * 2. Jika siap -> Panggil Gemini.
   *    - Jika sukses: set cooldown = 0, kembalikan hasil.
   *    - Jika terkena limit (429): set cooldown, otomatis alihkan ke 9Router.
   * 3. Jika Gemini sedang cooldown atau gagal -> Panggil 9Router.
   * 4. Jika keduanya gagal -> Fallback aman (TIDAK_PASTI).
   */
  public async verifyWithLlm(prompt: string): Promise<LlmVerificationResponse> {
    const startTime = Date.now();
    const geminiKey = this.getGeminiKey();
    const canTryGemini = Boolean(geminiKey && geminiKey.length > 0) && !this.isGeminiInCooldown();
    const wasInCooldown = this.lastProviderUsed === "9router" && canTryGemini;

    // --- ALUR 1: Coba Gemini jika API Key ada dan tidak dalam cooldown ---
    if (canTryGemini) {
      let activeGeminiModel = this.getGeminiModel();
      try {
        logger.info(
          { model: activeGeminiModel, recovered: wasInCooldown },
          "[LlmClient] Memanggil Gemini API..."
        );
        const result = await this.callGemini(prompt, activeGeminiModel);
        this.geminiCooldownUntil = 0;
        this.lastProviderUsed = "gemini";

        return {
          result,
          meta: {
            provider: "gemini",
            model: activeGeminiModel,
            durationMs: Date.now() - startTime,
            recoveredFromLimit: wasInCooldown,
          },
        };
      } catch (geminiError: any) {
        // Cek apakah 503 (high demand) atau 404 (model deprecated/unavailable)
        const isSpikeOrUnavailable =
          geminiError?.status === 503 ||
          geminiError?.status === 404 ||
          String(geminiError?.message || "").includes("503") ||
          String(geminiError?.message || "").includes("404") ||
          String(geminiError?.message || "").includes("high demand");

        if (isSpikeOrUnavailable) {
          const alternateModel =
            activeGeminiModel === "gemini-3.5-flash-lite"
              ? "gemini-3.5-flash"
              : "gemini-3.5-flash-lite";

          logger.warn(
            { originalModel: activeGeminiModel, alternateModel, reason: geminiError?.message },
            "[LlmClient] Gemini model mengalami beban tinggi (503/404). Mencoba model alternatif..."
          );
          try {
            const altResult = await this.callGemini(prompt, alternateModel);
            this.geminiCooldownUntil = 0;
            this.lastProviderUsed = "gemini";

            return {
              result: altResult,
              meta: {
                provider: "gemini",
                model: alternateModel,
                durationMs: Date.now() - startTime,
                recoveredFromLimit: wasInCooldown,
              },
            };
          } catch (altError: any) {
            logger.warn({ error: altError?.message }, "[LlmClient] Model Gemini alternatif juga gagal.");
          }
        }

        const isRateLimit =
          geminiError?.status === 429 ||
          String(geminiError?.message || "").includes("429") ||
          String(geminiError?.message || "").includes("RESOURCE_EXHAUSTED") ||
          String(geminiError?.message || "").includes("quota");

        if (isRateLimit) {
          const cooldownMs = geminiError?.retryDelayMs ?? this.getCooldownMs();
          this.geminiCooldownUntil = Date.now() + cooldownMs;
          logger.warn(
            {
              cooldownUntil: new Date(this.geminiCooldownUntil).toISOString(),
              cooldownMs,
            },
            "[LlmClient] Gemini API terkena rate limit. Mengaktifkan failover ke 9Router..."
          );
        } else {
          logger.warn(
            { error: geminiError?.message || String(geminiError) },
            "[LlmClient] Gemini API gagal merespons. Mencoba fallback ke 9Router..."
          );
        }
      }
    } else if (this.isGeminiInCooldown()) {
      logger.info(
        { cooldownRemainingSec: Math.ceil((this.geminiCooldownUntil - Date.now()) / 1000) },
        "[LlmClient] Gemini API masih dalam masa cooldown limit. Langsung merutekan ke 9Router..."
      );
    }

    // --- ALUR 2: Fallback ke 9Router (OpenAI-compatible) ---
    try {
      const nineRouterModel = this.getNineRouterModel();
      logger.info(
        { baseUrl: this.getNineRouterBaseUrl(), model: nineRouterModel },
        "[LlmClient] Memanggil 9Router (OpenAI-compatible gateway)..."
      );
      const result = await this.callNineRouter(prompt);
      this.lastProviderUsed = "9router";

      return {
        result,
        meta: {
          provider: "9router",
          model: nineRouterModel,
          durationMs: Date.now() - startTime,
          recoveredFromLimit: false,
        },
      };
    } catch (nineRouterError: any) {
      logger.error(
        { error: nineRouterError?.message || String(nineRouterError) },
        "[LlmClient] 9Router juga gagal merespons."
      );
    }

    // --- ALUR 3: Fallback Aman (Safe Fallback) sesuai Karpathy & 00_agent_rules ---
    logger.warn("[LlmClient] Seluruh LLM provider tidak tersedia. Menggunakan safe fallback TIDAK_PASTI.");
    const fallbackResult: LlmVerificationOutputDTO = {
      label: 1, // default ke unverified/warning
      confidence: 0.5,
      explanation: "Layanan LLM saat ini tidak dapat dihubungi. Hasil diverifikasi menggunakan fallback probabilistik netral.",
      claims: [
        {
          claim: "Klaim berita memerlukan pemeriksaan independen lebih lanjut.",
          verdict: "TIDAK_PASTI",
          confidence: 0.5,
          explanation: "Provider LLM (Gemini & 9Router) sedang tidak merespons.",
        },
      ],
      suggestedSources: [],
    };

    return {
      result: fallbackResult,
      meta: {
        provider: "fallback-rule",
        model: "safe-fallback-v1",
        durationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Memanggil Gemini REST API generateContent (JSON Mode).
   */
  private async callGemini(prompt: string, overrideModel?: string): Promise<LlmVerificationOutputDTO> {
    const geminiModel = overrideModel ?? this.getGeminiModel();
    const geminiKey = this.getGeminiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      geminiModel
    )}:generateContent?key=${encodeURIComponent(geminiKey)}`;

    const timeoutMs = Number(process.env["EXTERNAL_TIMEOUT_MS"] ?? env.EXTERNAL_TIMEOUT_MS ?? 30000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs > 0 ? timeoutMs : 30000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = safeJsonParse(errorText);

        const error: any = new Error(
          `Gemini API HTTP ${response.status}: ${errorData?.error?.message || errorText}`
        );
        error.status = response.status;

        // Baca Retry-After jika tersedia
        const retryAfterHeader = response.headers.get("retry-after");
        if (retryAfterHeader) {
          const parsedSec = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsedSec) && parsedSec > 0) {
            error.retryDelayMs = parsedSec * 1000;
          }
        }
        throw error;
      }

      const data: any = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText || typeof rawText !== "string") {
        throw new Error("Gemini API mengembalikan respons kosong.");
      }

      return this.parseAndValidate(rawText);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Memanggil 9Router endpoint /chat/completions (OpenAI-compatible).
   */
  private async callNineRouter(prompt: string): Promise<LlmVerificationOutputDTO> {
    const baseUrl = this.getNineRouterBaseUrl().replace(/\/+$/, "");
    const url = `${baseUrl}/chat/completions`;

    const timeoutMs = Number(process.env["EXTERNAL_TIMEOUT_MS"] ?? env.EXTERNAL_TIMEOUT_MS ?? 30000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs > 0 ? timeoutMs : 30000);

    const nineRouterKey = this.getNineRouterKey();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (nineRouterKey.length > 0) {
      headers["Authorization"] = `Bearer ${nineRouterKey}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.getNineRouterModel(),
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "Anda adalah asisten verifikator fakta AI profesional. Jawab HANYA menggunakan format JSON valid sesuai skema yang diminta.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`9Router HTTP ${response.status}: ${errorText}`);
      }

      const text = await response.text();
      let rawText = "";

      if (text.trim().startsWith("data:")) {
        // Penanganan response jika endpoint mengembalikan SSE stream format
        const lines = text.split("\n").filter((l) => l.trim().startsWith("data:"));
        let accumulated = "";
        for (const line of lines) {
          const jsonStr = line.replace(/^data:\s*/, "").trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const chunk = JSON.parse(jsonStr);
            const content = chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || "";
            accumulated += content;
          } catch {
            // Abaikan chunk yang gagal diparse
          }
        }
        rawText = accumulated;
      } else {
        const data: any = JSON.parse(text);
        rawText = data?.choices?.[0]?.message?.content || "";
      }

      if (!rawText || typeof rawText !== "string") {
        throw new Error("9Router mengembalikan respons kosong.");
      }

      return this.parseAndValidate(rawText);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Membersihkan format markdown code fence dan memvalidasi JSON dengan Zod.
   */
  private parseAndValidate(rawText: string): LlmVerificationOutputDTO {
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsedJson = JSON.parse(cleaned);
    const parsed = LlmVerificationOutputSchema.safeParse(parsedJson);

    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues, cleaned }, "[LlmClient] Output JSON tidak valid skema Zod");
      // Jika label hilang tapi string hasilAkhir ada
      const fallbackLabel =
        parsedJson?.label === 0 || parsedJson?.label === "0" || parsedJson?.verdict === "BENAR" ? 0 : 1;
      return {
        label: fallbackLabel,
        confidence: typeof parsedJson?.confidence === "number" ? parsedJson.confidence : 0.75,
        explanation: typeof parsedJson?.explanation === "string" ? parsedJson.explanation : "Verifikasi AI selesai.",
        claims: Array.isArray(parsedJson?.claims) ? parsedJson.claims : [],
        suggestedSources: Array.isArray(parsedJson?.suggestedSources) ? parsedJson.suggestedSources : [],
      };
    }

    return parsed.data;
  }
}

function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export const llmClient = new LlmClient();
