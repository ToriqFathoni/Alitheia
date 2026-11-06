import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LlmClient } from "../llm/llm-client.js";

describe("LlmClient Failover & Auto-Recovery", () => {
  let client: LlmClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new LlmClient();
    vi.stubEnv("GEMINI_API_KEY", "dummy-gemini-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
    vi.stubEnv("NINEROUTER_BASE_URL", "http://localhost:20128/v1");
    vi.stubEnv("NINEROUTER_API_KEY", "dummy-9router-key");
    vi.stubEnv("NINEROUTER_MODEL", "gpt-4o-mini");
    vi.stubEnv("GEMINI_RATE_LIMIT_COOLDOWN_MS", "500"); // 500ms for fast testing
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("harus menggunakan Gemini sebagai provider utama saat tidak ada error", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        label: 1,
                        confidence: 0.92,
                        explanation: "Berita terbukti hoaks.",
                        claims: [],
                        suggestedSources: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as any;

    const response = await client.verifyWithLlm("Contoh berita hoax");
    expect(response.meta.provider).toBe("gemini");
    expect(response.result.label).toBe(1);
    expect(client.isGeminiInCooldown()).toBe(false);
  });

  it("harus otomatis fallback ke 9Router ketika Gemini terkena rate limit (429)", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ "retry-after": "1" }),
          text: async () => JSON.stringify({ error: { message: "RESOURCE_EXHAUSTED" } }),
        };
      }
      if (url.includes("localhost:20128") || url.includes("/chat/completions")) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    label: 0,
                    confidence: 0.88,
                    explanation: "Diverifikasi melalui 9Router.",
                    claims: [],
                    suggestedSources: [],
                  }),
                },
              },
            ],
          }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as any;

    const response = await client.verifyWithLlm("Contoh berita fakta");
    expect(response.meta.provider).toBe("9router");
    expect(response.result.label).toBe(0);
    expect(client.isGeminiInCooldown()).toBe(true);
  });

  it("harus otomatis kembali (Auto-Recovery) ke Gemini begitu masa cooldown rate-limit berakhir", async () => {
    let geminiCallCount = 0;
    let nineRouterCallCount = 0;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        geminiCallCount++;
        if (geminiCallCount === 1) {
          // Panggilan pertama Gemini kena rate limit 429
          return {
            ok: false,
            status: 429,
            headers: new Headers({ "retry-after": "1" }),
            text: async () => JSON.stringify({ error: { message: "Quota exceeded" } }),
          };
        }
        // Panggilan kedua Gemini setelah recovery sukses
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        label: 1,
                        confidence: 0.95,
                        explanation: "Gemini pulih setelah cooldown.",
                        claims: [],
                        suggestedSources: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        };
      }

      if (url.includes("localhost:20128")) {
        nineRouterCallCount++;
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    label: 1,
                    confidence: 0.85,
                    explanation: "Fallback 9router.",
                    claims: [],
                    suggestedSources: [],
                  }),
                },
              },
            ],
          }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as any;

    // Call 1: Gemini gagal (429) -> fallback ke 9Router
    const res1 = await client.verifyWithLlm("Test 1");
    expect(res1.meta.provider).toBe("9router");
    expect(client.isGeminiInCooldown()).toBe(true);
    expect(geminiCallCount).toBe(1);
    expect(nineRouterCallCount).toBe(1);

    // Call 2: Masih dalam masa cooldown -> langsung ke 9Router tanpa panggil Gemini
    const res2 = await client.verifyWithLlm("Test 2");
    expect(res2.meta.provider).toBe("9router");
    expect(geminiCallCount).toBe(1); // Gemini tidak dipanggil
    expect(nineRouterCallCount).toBe(2);

    // Simulasi waktu berlalu / cooldown selesai
    client.resetCooldown();
    expect(client.isGeminiInCooldown()).toBe(false);

    // Call 3: Cooldown habis -> otomatis kembali mencoba Gemini (Auto-Recovery)
    const res3 = await client.verifyWithLlm("Test 3");
    expect(res3.meta.provider).toBe("gemini");
    expect(res3.meta.recoveredFromLimit).toBe(true);
    expect(geminiCallCount).toBe(2); // Gemini dipanggil kembali!
    expect(client.isGeminiInCooldown()).toBe(false);
  });
});

