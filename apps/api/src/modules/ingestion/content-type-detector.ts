/**
 * Alitheia - Content Type & Platform Detector
 * Mendeteksi platform media sosial, portal artikel berita, video, dan dokumen dari URL.
 * Mengacu pada plan/03_backend_ingestion_api.md §3 dan §4
 */

export type ContentType =
  | "ARTICLE"
  | "SOCIAL_POST"
  | "VIDEO"
  | "DOCUMENT"
  | "IMAGE"
  | "AUDIO";

export type PlatformType =
  | "YOUTUBE"
  | "TIKTOK"
  | "INSTAGRAM"
  | "TWITTER"
  | "FACEBOOK"
  | "THREADS"
  | "DOCUMENT"
  | "IMAGE"
  | "AUDIO"
  | "GENERIC_ARTICLE";

export interface ContentTypeDetectionResult {
  contentType: ContentType;
  platform: PlatformType;
  platformName: string;
  hostname: string;
  normalizedUrl: string;
  isSocialMedia: boolean;
  isVideo: boolean;
}

/**
 * Membersihkan dan menormalisasi hostname (misal: menghilangkan www. dan lowercase)
 */
export function cleanHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Mendeteksi platform dan jenis konten berdasarkan URL
 */
export function detectContentType(urlObj: URL): ContentTypeDetectionResult {
  const rawHostname = urlObj.hostname;
  const host = cleanHostname(rawHostname);
  const pathname = urlObj.pathname.toLowerCase();
  const normalizedUrl = urlObj.toString();

  // 1. YouTube & YouTube Shorts
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be" ||
    host.endsWith(".youtube.com")
  ) {
    return {
      contentType: "VIDEO",
      platform: "YOUTUBE",
      platformName: "YouTube",
      hostname: host,
      normalizedUrl,
      isSocialMedia: false,
      isVideo: true,
    };
  }

  // 2. TikTok
  if (
    host === "tiktok.com" ||
    host === "m.tiktok.com" ||
    host === "vt.tiktok.com" ||
    host === "vm.tiktok.com" ||
    host.endsWith(".tiktok.com")
  ) {
    return {
      contentType: "SOCIAL_POST",
      platform: "TIKTOK",
      platformName: "TikTok",
      hostname: host,
      normalizedUrl,
      isSocialMedia: true,
      isVideo: true,
    };
  }

  // 3. Instagram
  if (
    host === "instagram.com" ||
    host === "instagr.am" ||
    host.endsWith(".instagram.com")
  ) {
    return {
      contentType: "SOCIAL_POST",
      platform: "INSTAGRAM",
      platformName: "Instagram",
      hostname: host,
      normalizedUrl,
      isSocialMedia: true,
      isVideo: pathname.includes("/reel/") || pathname.includes("/tv/"),
    };
  }

  // 4. Twitter / X
  if (
    host === "twitter.com" ||
    host === "x.com" ||
    host.endsWith(".twitter.com") ||
    host.endsWith(".x.com")
  ) {
    return {
      contentType: "SOCIAL_POST",
      platform: "TWITTER",
      platformName: "X (Twitter)",
      hostname: host,
      normalizedUrl,
      isSocialMedia: true,
      isVideo: false,
    };
  }

  // 5. Facebook
  if (
    host === "facebook.com" ||
    host === "m.facebook.com" ||
    host === "fb.com" ||
    host === "fb.watch" ||
    host.endsWith(".facebook.com")
  ) {
    return {
      contentType: "SOCIAL_POST",
      platform: "FACEBOOK",
      platformName: "Facebook",
      hostname: host,
      normalizedUrl,
      isSocialMedia: true,
      isVideo: host === "fb.watch" || pathname.includes("/watch/"),
    };
  }

  // 6. Threads
  if (host === "threads.net" || host.endsWith(".threads.net")) {
    return {
      contentType: "SOCIAL_POST",
      platform: "THREADS",
      platformName: "Threads",
      hostname: host,
      normalizedUrl,
      isSocialMedia: true,
      isVideo: false,
    };
  }

  // 7. Dokumen (PDF, DOCX, TXT)
  if (pathname.endsWith(".pdf") || pathname.endsWith(".docx") || pathname.endsWith(".doc") || pathname.endsWith(".txt")) {
    return {
      contentType: "DOCUMENT",
      platform: "DOCUMENT",
      platformName: "Document",
      hostname: host,
      normalizedUrl,
      isSocialMedia: false,
      isVideo: false,
    };
  }

  // 8. Gambar langsung
  if (
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".gif")
  ) {
    return {
      contentType: "IMAGE",
      platform: "IMAGE",
      platformName: "Direct Image",
      hostname: host,
      normalizedUrl,
      isSocialMedia: false,
      isVideo: false,
    };
  }

  // 9. Audio langsung
  if (
    pathname.endsWith(".mp3") ||
    pathname.endsWith(".wav") ||
    pathname.endsWith(".ogg") ||
    pathname.endsWith(".m4a")
  ) {
    return {
      contentType: "AUDIO",
      platform: "AUDIO",
      platformName: "Direct Audio",
      hostname: host,
      normalizedUrl,
      isSocialMedia: false,
      isVideo: false,
    };
  }

  // 10. Default: Artikel Berita Web / Blog
  return {
    contentType: "ARTICLE",
    platform: "GENERIC_ARTICLE",
    platformName: "Web Article",
    hostname: host,
    normalizedUrl,
    isSocialMedia: false,
    isVideo: false,
  };
}

