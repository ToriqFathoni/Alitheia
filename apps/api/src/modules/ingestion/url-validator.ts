/**
 * Alitheia - URL Validator & Anti-SSRF Guard
 * Memvalidasi format URL, mencegah serangan SSRF (Server-Side Request Forgery),
 * serta memeriksa apakah URL valid, dapat diakses, privat, atau sudah dihapus.
 * Mengacu pada plan/03_backend_ingestion_api.md §4.3
 */

import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";
import {
  detectContentType,
  cleanHostname,
  type ContentTypeDetectionResult,
} from "./content-type-detector.js";

export type UrlStatus =
  | "ACCESSIBLE"
  | "DELETED_OR_NOT_FOUND"
  | "PRIVATE_OR_RESTRICTED"
  | "UNREACHABLE"
  | "TIMEOUT"
  | "SERVER_ERROR"
  | "BLOCKED_SSRF"
  | "INVALID_FORMAT";

export interface UrlInspectionResult {
  isValid: boolean;
  rawUrl: string;
  normalizedUrl?: string;
  status: UrlStatus;
  httpStatusCode?: number;
  message: string;
  detection?: ContentTypeDetectionResult;
  finalRedirectUrl?: string;
}

export interface ProbeOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  skipProbe?: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 4;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; AlitheiaBot/1.0; +https://alitheia.dev; editorial-fact-check)";

/**
 * 1. Validasi Format URL Dasar
 * Memastikan skema protokol http/https dan menolak kredensial berbahaya
 */
export function validateUrlFormat(input: string): { valid: true; url: URL } | { valid: false; error: string } {
  if (!input || typeof input !== "string") {
    return { valid: false, error: "URL tidak boleh kosong." };
  }

  const trimmed = input.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: "Format URL tidak valid. Pastikan menyertakan http:// atau https://.",
    };
  }

  // Protokol hanya http atau https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Protokol '${parsed.protocol}' tidak diizinkan. Hanya HTTP dan HTTPS yang didukung.`,
    };
  }

  // Tolak kredensial (mis. http://admin:pass@example.com)
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: "URL tidak boleh memuat kredensial pengguna (username/password).",
    };
  }

  // Validasi hostname
  const host = cleanHostname(parsed.hostname);
  if (!host || host.length > 253) {
    return { valid: false, error: "Hostname pada URL tidak valid." };
  }

  return { valid: true, url: parsed };
}

/**
 * 2. Pengecekan Keamanan IP (Anti-SSRF)
 * Memeriksa apakah alamat IP masuk ke dalam rentang privat, loopback, link-local, atau cloud metadata
 */
export function isIpAddressSafe(ipString: string): { safe: boolean; reason?: string } {
  try {
    const addr = ipaddr.parse(ipString);

    // Jika IPv6 yang memetakan IPv4 (IPv4-mapped IPv6), konversi ke IPv4
    let targetAddr = addr;
    if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
      targetAddr = (addr as ipaddr.IPv6).toIPv4Address();
    }

    const range = targetAddr.range();

    // Daftar rentang yang DILARANG diakses (Anti-SSRF)
    const blockedRanges = [
      "unspecified",      // 0.0.0.0/8 atau ::
      "broadcast",        // 255.255.255.255/32
      "linkLocal",        // 169.254.0.0/16 atau fe80::/10
      "loopback",         // 127.0.0.0/8 atau ::1
      "private",          // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
      "reserved",         // IETF Reserved
      "carrierGradeNat",  // 100.64.0.0/10
      "uniqueLocal",      // fc00::/7
    ];

    if (blockedRanges.includes(range)) {
      return {
        safe: false,
        reason: `Alamat IP terlarang (${range}) terdeteksi: ${ipString}.`,
      };
    }

    // Blokir khusus AWS/GCP/Azure instance metadata
    if (ipString === "169.254.169.254") {
      return {
        safe: false,
        reason: "Akses ke endpoint metadata cloud (169.254.169.254) diblokir.",
      };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: `Gagal membaca format IP: ${ipString}` };
  }
}

export type SsrfCheckResult =
  | { safe: true }
  | { safe: false; code: "BLOCKED_SSRF" | "DNS_FAILED"; error: string };

/**
 * 3. Resolusi DNS & Pengecekan Anti-SSRF Hostname
 */
export async function resolveAndCheckSsrf(hostname: string): Promise<SsrfCheckResult> {
  // Jika hostname adalah string "localhost", langsung blokir
  if (hostname.toLowerCase() === "localhost" || hostname.toLowerCase().endsWith(".localhost")) {
    return {
      safe: false,
      code: "BLOCKED_SSRF",
      error: "Akses ke hostname lokal (localhost) diblokir demi keamanan (Anti-SSRF).",
    };
  }

  // Jika hostname langsung berupa IP literal
  if (ipaddr.isValid(hostname)) {
    const check = isIpAddressSafe(hostname);
    if (!check.safe) {
      return {
        safe: false,
        code: "BLOCKED_SSRF",
        error: `Akses ke IP privat/lokal diblokir (Anti-SSRF): ${check.reason}`,
      };
    }
    return { safe: true };
  }

  // Resolusi nama domain ke daftar alamat IP
  try {
    const addresses = await dns.lookup(hostname, { all: true });

    if (!addresses || addresses.length === 0) {
      return {
        safe: false,
        code: "DNS_FAILED",
        error: `Domain '${hostname}' tidak dapat ditemukan (DNS resolution gagal).`,
      };
    }

    for (const record of addresses) {
      const check = isIpAddressSafe(record.address);
      if (!check.safe) {
        return {
          safe: false,
          code: "BLOCKED_SSRF",
          error: `Domain '${hostname}' mengarah ke IP terlarang (${record.address}). Diblokir oleh sistem Anti-SSRF.`,
        };
      }
    }

    return { safe: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      safe: false,
      code: "DNS_FAILED",
      error: `Gagal menyelesaikan DNS domain '${hostname}': ${message}`,
    };
  }
}

/**
 * Mendeteksi apakah URL tujuan pengalihan adalah halaman login / autentikasi
 * (Ciri khas platform medsos seperti Instagram/FB jika konten bersifat privat)
 */
function isLoginOrAuthUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  return (
    path.includes("/login") ||
    path.includes("/signin") ||
    path.includes("/accounts/login") ||
    path.includes("/checkpoint") ||
    path === "/login.php"
  );
}

/**
 * 4. Pengecekan Ketersediaan Link (Probe HTTP)
 * Mendeteksi apakah link aktif, privat (401/403), atau sudah dihapus/tidak ditemukan (404/410)
 */
export async function probeUrlReachability(
  initialUrl: URL,
  options: ProbeOptions = {}
): Promise<{
  status: UrlStatus;
  httpStatusCode?: number;
  finalUrl: string;
  message: string;
}> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = initialUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    // Validasi Anti-SSRF di setiap tahapan redirect
    const ssrfCheck = await resolveAndCheckSsrf(currentUrl.hostname);
    if (!ssrfCheck.safe) {
      if (ssrfCheck.code === "DNS_FAILED") {
        return {
          status: "UNREACHABLE",
          finalUrl: currentUrl.toString(),
          message: ssrfCheck.error,
        };
      }
      return {
        status: "BLOCKED_SSRF",
        finalUrl: currentUrl.toString(),
        message: ssrfCheck.error,
      };
    }

    try {
      // Gunakan HEAD terlebih dahulu untuk menghemat bandwidth
      let response = await fetch(currentUrl.toString(), {
        method: "HEAD",
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Beberapa server (misal Wikipedia/Cloudflare) memblokir HEAD (405 Method Not Allowed), fallback ke GET
      if (response.status === 405 || response.status === 501) {
        response = await fetch(currentUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Range: "bytes=0-1024", // Hanya ambil potongan awal
          },
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
      }

      // Tangani Redirect (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return {
            status: "ACCESSIBLE",
            httpStatusCode: response.status,
            finalUrl: currentUrl.toString(),
            message: "Link merespons dengan pengalihan tanpa lokasi tujuan.",
          };
        }

        const nextUrl = new URL(location, currentUrl);

        // Jika dialihkan ke halaman login (misal postingan privat di Instagram/Facebook)
        if (isLoginOrAuthUrl(nextUrl)) {
          return {
            status: "PRIVATE_OR_RESTRICTED",
            httpStatusCode: response.status,
            finalUrl: nextUrl.toString(),
            message:
              "Konten berstatus privat atau memerlukan autentikasi login (dialihkan ke halaman login).",
          };
        }

        redirectsCount++;

        if (redirectsCount > maxRedirects) {
          return {
            status: "UNREACHABLE",
            httpStatusCode: response.status,
            finalUrl: currentUrl.toString(),
            message: "Terlalu banyak pengalihan (redirect loop).",
          };
        }

        currentUrl = nextUrl;
        continue;
      }

      // Analisis Status Kode HTTP
      const statusCode = response.status;

      // 1. Link Sukses
      if (statusCode >= 200 && statusCode < 300) {
        return {
          status: "ACCESSIBLE",
          httpStatusCode: statusCode,
          finalUrl: currentUrl.toString(),
          message: "Konten aktif dan dapat diakses publik.",
        };
      }

      // 2. Link Dihapus / Tidak Ditemukan
      if (statusCode === 404 || statusCode === 410) {
        return {
          status: "DELETED_OR_NOT_FOUND",
          httpStatusCode: statusCode,
          finalUrl: currentUrl.toString(),
          message:
            "Konten tidak ditemukan atau telah dihapus oleh pengunggah/pemilik situs (HTTP 404/410).",
        };
      }

      // 3. Link Privat / Butuh Izin Akses
      if (statusCode === 401 || statusCode === 403) {
        return {
          status: "PRIVATE_OR_RESTRICTED",
          httpStatusCode: statusCode,
          finalUrl: currentUrl.toString(),
          message:
            "Konten berstatus privat atau memerlukan autentikasi login (HTTP 401/403).",
        };
      }

      // 4. Timeout dari Server Sumber
      if (statusCode === 408 || statusCode === 504) {
        return {
          status: "TIMEOUT",
          httpStatusCode: statusCode,
          finalUrl: currentUrl.toString(),
          message: "Server sumber membutuhkan waktu terlalu lama untuk merespons (Timeout).",
        };
      }

      // 5. Gangguan Server Sumber
      if (statusCode >= 500) {
        return {
          status: "SERVER_ERROR",
          httpStatusCode: statusCode,
          finalUrl: currentUrl.toString(),
          message: `Server sumber sedang mengalami kendala teknis internal (HTTP ${statusCode}).`,
        };
      }

      return {
        status: "ACCESSIBLE",
        httpStatusCode: statusCode,
        finalUrl: currentUrl.toString(),
        message: `Server merespons dengan status HTTP ${statusCode}.`,
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          return {
            status: "TIMEOUT",
            finalUrl: currentUrl.toString(),
            message: `Koneksi ke server sumber melebihi batas waktu (${timeoutMs / 1000} detik).`,
          };
        }
      }

      return {
        status: "UNREACHABLE",
        finalUrl: currentUrl.toString(),
        message: `Tidak dapat menghubungi server sumber: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return {
    status: "UNREACHABLE",
    finalUrl: currentUrl.toString(),
    message: "Gagal memverifikasi URL setelah pengalihan maksimal.",
  };
}

/**
 * 5. FUNGSI UTAMA: Inspeksi dan Validasi URL Menyeluruh
 * Memeriksa format, anti-SSRF, deteksi platform, dan status aksesibilitas
 */
export async function inspectUrl(
  rawUrl: string,
  options: ProbeOptions = {}
): Promise<UrlInspectionResult> {
  // 1. Validasi Sintaks / Format
  const formatCheck = validateUrlFormat(rawUrl);
  if (!formatCheck.valid) {
    return {
      isValid: false,
      rawUrl,
      status: "INVALID_FORMAT",
      message: formatCheck.error,
    };
  }

  const urlObj = formatCheck.url;

  // 2. Deteksi Platform & Jenis Konten
  const detection = detectContentType(urlObj);

  // 3. Pengecekan Anti-SSRF
  const ssrfCheck = await resolveAndCheckSsrf(urlObj.hostname);
  if (!ssrfCheck.safe) {
    return {
      isValid: false,
      rawUrl,
      normalizedUrl: detection.normalizedUrl,
      status: ssrfCheck.code === "DNS_FAILED" ? "UNREACHABLE" : "BLOCKED_SSRF",
      message: ssrfCheck.error,
      detection,
    };
  }

  // Jika opsi skipProbe diaktifkan (misal untuk unit test format statis)
  if (options.skipProbe) {
    return {
      isValid: true,
      rawUrl,
      normalizedUrl: detection.normalizedUrl,
      status: "ACCESSIBLE",
      message: "Format URL valid dan lolos verifikasi Anti-SSRF.",
      detection,
    };
  }

  // 4. Pengecekan Khusus Platform (Menangani Soft-404 & Token Privat Medsos)
  
  // A. YouTube: Deteksi Video Bodong / Dihapus / Unavailable via oEmbed resmi
  if (detection.platform === "YOUTUBE") {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(urlObj.toString())}&format=json`;
      const oembedRes = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });

      if (oembedRes.status === 400 || oembedRes.status === 404) {
        return {
          isValid: false,
          rawUrl,
          normalizedUrl: detection.normalizedUrl,
          status: "DELETED_OR_NOT_FOUND",
          httpStatusCode: 404,
          message: "Video YouTube tidak ditemukan, fiktif, atau telah dihapus (Video unavailable).",
          detection,
        };
      }
    } catch {
      // Jika oEmbed gagal terhubung, lanjutkan ke probe biasa
    }
  }

  // B. Instagram: Deteksi Link Berasal dari Akun Privat (Share Referral Token / srtk)
  if (detection.platform === "INSTAGRAM") {
    if (urlObj.searchParams.has("srtk")) {
      return {
        isValid: false,
        rawUrl,
        normalizedUrl: detection.normalizedUrl,
        status: "PRIVATE_OR_RESTRICTED",
        httpStatusCode: 403,
        message:
          "Tautan Instagram ini berasal dari akun privat (memuat token berbagi khusus 'srtk'). Konten dari akun privat tidak dapat diverifikasi oleh sistem.",
        detection,
      };
    }
  }

  // 5. Probe Jaringan untuk Menangani Link 404 / Private / Timeout (Standar Web & Artikel)
  const probeResult = await probeUrlReachability(urlObj, options);

  const isValid = probeResult.status === "ACCESSIBLE";

  return {
    isValid,
    rawUrl,
    normalizedUrl: detection.normalizedUrl,
    status: probeResult.status,
    httpStatusCode: probeResult.httpStatusCode,
    message: probeResult.message,
    detection,
    finalRedirectUrl: probeResult.finalUrl,
  };
}
