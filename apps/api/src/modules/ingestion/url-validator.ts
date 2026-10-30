import { AppError } from "../../middleware/error.middleware.js";

/**
 * Memeriksa apakah suatu IP berada pada rentang alamat IP privat, loopback,
 * atau metadata cloud (mitigasi Server-Side Request Forgery / SSRF).
 */
export function isPrivateOrReservedIp(hostname: string): boolean {
  const normalized = hostname.toLowerCase().trim();

  // 1. Hostname loopback umum
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0.0.0.0"
  ) {
    return true;
  }

  // 2. Metadata cloud AWS/GCP/Azure link-local
  if (normalized.startsWith("169.254.")) {
    return true;
  }

  // 3. IPv4 Private Range (RFC 1918)
  const ipv4Parts = normalized.split(".").map((part) => parseInt(part, 10));
  if (ipv4Parts.length === 4 && ipv4Parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
    const first = ipv4Parts[0];
    const second = ipv4Parts[1];
    if (first === undefined || second === undefined) return false;
    // 10.0.0.0/8
    if (first === 10) return true;
    // 172.16.0.0/12 (172.16.0.0 – 172.31.255.255)
    if (first === 172 && second >= 16 && second <= 31) return true;
    // 192.168.0.0/16
    if (first === 192 && second === 168) return true;
    // 127.0.0.0/8
    if (first === 127) return true;
    // 0.0.0.0/8
    if (first === 0) return true;
  }

  return false;
}

/**
 * Validasi keamanan tautan (Anti-SSRF dan validitas skema URL)
 */
export function validateUrlSafety(inputUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Format URL tidak valid.", 400);
  }

  // Hanya perbolehkan http dan https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError(
      "VALIDATION_ERROR",
      `Protokol '${parsed.protocol}' tidak diizinkan. Hanya 'http:' dan 'https:' yang didukung.`,
      400
    );
  }

  // Tolak keberadaan kredensial di URL (mis. https://user:pass@example.com)
  if (parsed.username || parsed.password) {
    throw new AppError("VALIDATION_ERROR", "URL tidak boleh mengandung kredensial autentikasi.", 400);
  }

  // Tolak IP/host privat atau reserved
  if (isPrivateOrReservedIp(parsed.hostname)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Akses ke host '${parsed.hostname}' diblokir demi alasan keamanan (SSRF Protection).`,
      400
    );
  }

  return parsed;
}
