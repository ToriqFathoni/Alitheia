import { describe, it, expect, vi } from "vitest";
import {
  validateUrlFormat,
  isIpAddressSafe,
  resolveAndCheckSsrf,
  inspectUrl,
  probeUrlReachability,
} from "./url-validator.js";
import { detectContentType } from "./content-type-detector.js";

describe("Content Type & Platform Detector", () => {
  it("mendeteksi YouTube video", () => {
    const res1 = detectContentType(new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
    expect(res1.platform).toBe("YOUTUBE");
    expect(res1.contentType).toBe("VIDEO");
    expect(res1.isVideo).toBe(true);

    const res2 = detectContentType(new URL("https://youtu.be/dQw4w9WgXcQ"));
    expect(res2.platform).toBe("YOUTUBE");
    expect(res2.contentType).toBe("VIDEO");
  });

  it("mendeteksi TikTok", () => {
    const res = detectContentType(new URL("https://www.tiktok.com/@alitheia/video/123456789"));
    expect(res.platform).toBe("TIKTOK");
    expect(res.contentType).toBe("SOCIAL_POST");
    expect(res.isSocialMedia).toBe(true);
  });

  it("mendeteksi Instagram post dan reel", () => {
    const post = detectContentType(new URL("https://www.instagram.com/p/C0xYz123/"));
    expect(post.platform).toBe("INSTAGRAM");
    expect(post.contentType).toBe("SOCIAL_POST");
    expect(post.isVideo).toBe(false);

    const reel = detectContentType(new URL("https://www.instagram.com/reel/C0xYzReel/"));
    expect(reel.platform).toBe("INSTAGRAM");
    expect(reel.contentType).toBe("SOCIAL_POST");
    expect(reel.isVideo).toBe(true);
  });

  it("mendeteksi Twitter / X", () => {
    const resX = detectContentType(new URL("https://x.com/kominfo/status/123456789"));
    expect(resX.platform).toBe("TWITTER");
    expect(resX.contentType).toBe("SOCIAL_POST");

    const resTwitter = detectContentType(new URL("https://twitter.com/kominfo/status/123456789"));
    expect(resTwitter.platform).toBe("TWITTER");
  });

  it("mendeteksi Facebook dan Threads", () => {
    const fb = detectContentType(new URL("https://www.facebook.com/story.php?id=123"));
    expect(fb.platform).toBe("FACEBOOK");
    expect(fb.contentType).toBe("SOCIAL_POST");

    const threads = detectContentType(new URL("https://www.threads.net/@user/post/123"));
    expect(threads.platform).toBe("THREADS");
    expect(threads.contentType).toBe("SOCIAL_POST");
  });

  it("mendeteksi file Dokumen langsung", () => {
    const doc = detectContentType(new URL("https://kominfo.go.id/laporan-hoaks-2026.pdf"));
    expect(doc.platform).toBe("DOCUMENT");
    expect(doc.contentType).toBe("DOCUMENT");
  });

  it("mendeteksi Artikel Berita Web biasa", () => {
    const news = detectContentType(new URL("https://news.detik.com/berita/d-12345/fakta-terkini"));
    expect(news.platform).toBe("GENERIC_ARTICLE");
    expect(news.contentType).toBe("ARTICLE");
    expect(news.isSocialMedia).toBe(false);
  });
});

describe("URL Format Validator", () => {
  it("menerima URL HTTP dan HTTPS yang valid", () => {
    const res1 = validateUrlFormat("https://kompas.com/read/2026/10/30/fakta");
    expect(res1.valid).toBe(true);

    const res2 = validateUrlFormat("http://tempo.co/berita");
    expect(res2.valid).toBe(true);
  });

  it("menolak URL dengan protokol selain HTTP/HTTPS", () => {
    const resFtp = validateUrlFormat("ftp://ftp.example.com/file.txt");
    expect(resFtp.valid).toBe(false);

    const resJs = validateUrlFormat("javascript:alert(1)");
    expect(resJs.valid).toBe(false);
  });

  it("menolak URL yang memuat kredensial pengguna (Anti-Credential Attack)", () => {
    const resCreds = validateUrlFormat("https://admin:rahasia123@example.com/dashboard");
    expect(resCreds.valid).toBe(false);
    if (!resCreds.valid) {
      expect(resCreds.error).toContain("kredensial");
    }
  });

  it("menolak string kosong atau format ngawur", () => {
    expect(validateUrlFormat("").valid).toBe(false);
    expect(validateUrlFormat("bukan-sebuah-url").valid).toBe(false);
  });
});

describe("Anti-SSRF Guard", () => {
  it("memblokir IP loopback lokal (127.0.0.1, ::1)", () => {
    expect(isIpAddressSafe("127.0.0.1").safe).toBe(false);
    expect(isIpAddressSafe("127.0.0.2").safe).toBe(false);
    expect(isIpAddressSafe("::1").safe).toBe(false);
  });

  it("memblokir IP privat RFC1918 (10.x, 192.168.x, 172.16-31.x)", () => {
    expect(isIpAddressSafe("10.0.0.1").safe).toBe(false);
    expect(isIpAddressSafe("192.168.1.1").safe).toBe(false);
    expect(isIpAddressSafe("172.16.0.1").safe).toBe(false);
    expect(isIpAddressSafe("172.31.255.254").safe).toBe(false);
  });

  it("memblokir IP cloud instance metadata (169.254.169.254)", () => {
    expect(isIpAddressSafe("169.254.169.254").safe).toBe(false);
  });

  it("memblokir hostname localhost", async () => {
    const res = await resolveAndCheckSsrf("localhost");
    expect(res.safe).toBe(false);
  });

  it("mengizinkan IP publik internet yang aman", () => {
    expect(isIpAddressSafe("8.8.8.8").safe).toBe(true);
    expect(isIpAddressSafe("1.1.1.1").safe).toBe(true);
  });
});

describe("Penanganan Link Tidak Valid / Private / Dihapus (HTTP Probing)", () => {
  it("menangani respon 404/410 sebagai DELETED_OR_NOT_FOUND", async () => {
    // Mock fetch global untuk mensimulasikan respon 404
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: new Headers(),
    } as unknown as Response);

    try {
      const result = await probeUrlReachability(new URL("https://example.com/artikel-yang-dihapus"));
      expect(result.status).toBe("DELETED_OR_NOT_FOUND");
      expect(result.httpStatusCode).toBe(404);
      expect(result.message).toContain("dihapus");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("menangani respon 401/403 sebagai PRIVATE_OR_RESTRICTED", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 403,
      headers: new Headers(),
    } as unknown as Response);

    try {
      const result = await probeUrlReachability(new URL("https://instagram.com/p/privat123"));
      expect(result.status).toBe("PRIVATE_OR_RESTRICTED");
      expect(result.httpStatusCode).toBe(403);
      expect(result.message).toContain("privat");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("menangani pengalihan ke halaman login medsos sebagai PRIVATE_OR_RESTRICTED", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 302,
      headers: new Headers({
        location: "https://www.instagram.com/accounts/login/?next=/p/private123/",
      }),
    } as unknown as Response);

    try {
      const result = await probeUrlReachability(new URL("https://www.instagram.com/p/private123/"));
      expect(result.status).toBe("PRIVATE_OR_RESTRICTED");
      expect(result.message).toContain("halaman login");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("menangani respon 200 sebagai ACCESSIBLE", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
    } as unknown as Response);

    try {
      const result = await probeUrlReachability(new URL("https://kompas.com/berita-resmi"));
      expect(result.status).toBe("ACCESSIBLE");
      expect(result.httpStatusCode).toBe(200);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("menangani timeout koneksi sebagai TIMEOUT", async () => {
    const originalFetch = globalThis.fetch;
    const timeoutErr = new Error("The operation was aborted");
    timeoutErr.name = "TimeoutError";
    globalThis.fetch = vi.fn().mockRejectedValue(timeoutErr);

    try {
      const result = await probeUrlReachability(new URL("https://example.com/slow-endpoint"), {
        timeoutMs: 1000,
      });
      expect(result.status).toBe("TIMEOUT");
      expect(result.message).toContain("batas waktu");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("inspectUrl End-to-End Helper", () => {
  it("langsung menolak format salah tanpa probe", async () => {
    const res = await inspectUrl("ftp://file.iso");
    expect(res.isValid).toBe(false);
    expect(res.status).toBe("INVALID_FORMAT");
  });

  it("memblokir URL yang mengarah ke localhost / IP lokal", async () => {
    const res = await inspectUrl("http://localhost:5000/api");
    expect(res.isValid).toBe(false);
    expect(res.status).toBe("BLOCKED_SSRF");
  });

  it("menangani tautan Instagram dengan parameter token privat (srtk) sebagai PRIVATE_OR_RESTRICTED", async () => {
    const res = await inspectUrl(
      "https://www.instagram.com/p/DTaeeaSkmSDo2pwRssDAnn4hRrcM5oM6TNMZp00/?srtk=MXJqancwYmttcHFtbg=="
    );
    expect(res.isValid).toBe(false);
    expect(res.status).toBe("PRIVATE_OR_RESTRICTED");
    expect(res.httpStatusCode).toBe(403);
    expect(res.message).toContain("akun privat");
  });

  it("menangani video YouTube fiktif / tidak ada via oEmbed sebagai DELETED_OR_NOT_FOUND", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      if (String(url).includes("youtube.com/oembed")) {
        return Promise.resolve({
          status: 404,
        } as unknown as Response);
      }
      return Promise.resolve({ status: 200 } as unknown as Response);
    });

    try {
      const res = await inspectUrl("https://youtu.be/kjsandkjnsakdjbsaiuhdkqwjiuswqjsaidqwisd");
      expect(res.isValid).toBe(false);
      expect(res.status).toBe("DELETED_OR_NOT_FOUND");
      expect(res.httpStatusCode).toBe(404);
      expect(res.message).toContain("Video YouTube tidak ditemukan");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
