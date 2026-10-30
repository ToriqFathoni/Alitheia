export type SupportedPlatform = 'instagram' | 'tiktok' | 'twitter' | 'other';

const TRACKING_PARAMS = new Set([
  'igshid',
  'si',
  'fbclid',
  'ref',
  'ref_src',
  'ref_url',
  'feature',
  't',
  '_t',
]);

/**
 * Validates whether the given string is a valid HTTP/HTTPS URL.
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim();
  if (!trimmed || trimmed.includes(' ')) {
    return false;
  }

  try {
    let toParse = trimmed;
    if (!/^https?:\/\//i.test(toParse)) {
      toParse = `https://${toParse}`;
    }

    const parsed = new URL(toParse);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname;
    if (!hostname || hostname.startsWith('.') || hostname.endsWith('.')) {
      return false;
    }

    // Hostname must be localhost or contain at least one dot (domain.tld)
    if (!hostname.includes('.') && hostname !== 'localhost') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Detects whether the URL belongs to Instagram, TikTok, Twitter/X, or other.
 */
export function detectPlatform(url: string): SupportedPlatform {
  if (!url || typeof url !== 'string') {
    return 'other';
  }

  try {
    let toParse = url.trim();
    if (!/^https?:\/\//i.test(toParse)) {
      toParse = `https://${toParse}`;
    }

    const parsed = new URL(toParse);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    if (
      hostname === 'instagram.com' ||
      hostname.endsWith('.instagram.com') ||
      hostname === 'instagr.am' ||
      hostname.endsWith('.instagr.am')
    ) {
      return 'instagram';
    }

    if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) {
      return 'tiktok';
    }

    if (
      hostname === 'twitter.com' ||
      hostname.endsWith('.twitter.com') ||
      hostname === 'x.com' ||
      hostname.endsWith('.x.com')
    ) {
      return 'twitter';
    }

    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * Normalizes a URL:
 * - Lowercases hostname
 * - Strips tracking parameters (utm_*, igshid, si, fbclid, ref, feature, t)
 * - Strips trailing slashes
 * - Sorts remaining query parameters alphabetically
 * - Removes URL fragment (#)
 * - Normalizes www. to non-www
 * - Applies platform-specific canonicalization (Instagram, TikTok, Twitter/X)
 */
export function normalizeUrl(rawUrl: string): string {
  if (!isValidUrl(rawUrl)) {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  let toParse = rawUrl.trim();
  const hadProtocol = /^https?:\/\//i.test(toParse);
  if (!hadProtocol) {
    toParse = `https://${toParse}`;
  }

  const parsed = new URL(toParse);

  // Lowercase hostname and remove www.
  let hostname = parsed.hostname.toLowerCase();
  if (hostname.startsWith('www.')) {
    hostname = hostname.slice(4);
  }

  // Canonicalize domains for known platforms
  if (hostname === 'x.com' || hostname.endsWith('.x.com')) {
    hostname = 'twitter.com';
  } else if (hostname === 'instagr.am' || hostname.endsWith('.instagr.am')) {
    hostname = 'instagram.com';
  }

  const platform = detectPlatform(toParse);

  // Platform-specific normalization
  if (platform === 'instagram') {
    // Format: https://instagram.com/p/{shortcode}/ or https://instagram.com/reel/{shortcode}/
    const igMatch = parsed.pathname.match(/^\/(p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i);
    if (igMatch && igMatch[1] && igMatch[2]) {
      const type = igMatch[1].toLowerCase();
      const shortcode = igMatch[2];
      if (type === 'reel' || type === 'reels') {
        return `https://instagram.com/reel/${shortcode}/`;
      }
      return `https://instagram.com/p/${shortcode}/`;
    }
  } else if (platform === 'tiktok') {
    // Format: https://tiktok.com/@{user}/video/{id}
    const tiktokMatch = parsed.pathname.match(/^\/@?([a-zA-Z0-9_.-]+)\/video\/(\d+)/i);
    if (tiktokMatch && tiktokMatch[1] && tiktokMatch[2]) {
      const user = tiktokMatch[1].replace(/^@/, '');
      const id = tiktokMatch[2];
      return `https://tiktok.com/@${user}/video/${id}`;
    }
  } else if (platform === 'twitter') {
    // Format: https://twitter.com/{user}/status/{id} or https://twitter.com/i/status/{id}
    const twitterMatch = parsed.pathname.match(/^(?:\/([^/]+))?\/status\/(\d+)/i);
    if (twitterMatch && twitterMatch[2]) {
      const user = twitterMatch[1];
      const id = twitterMatch[2];
      if (user && user !== 'i' && user !== 'web') {
        return `https://twitter.com/${user}/status/${id}`;
      }
      return `https://twitter.com/i/status/${id}`;
    }
  }

  // General URL normalization
  // Remove tracking parameters
  const keysToDelete: string[] = [];
  for (const key of parsed.searchParams.keys()) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.startsWith('utm_') || TRACKING_PARAMS.has(lowerKey)) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    parsed.searchParams.delete(key);
  }

  // Sort remaining query parameters
  parsed.searchParams.sort();

  const protocol = platform !== 'other' ? 'https:' : (parsed.protocol || 'https:');
  const port = parsed.port && parsed.port !== '80' && parsed.port !== '443' ? `:${parsed.port}` : '';

  // Remove trailing slashes from pathname (root becomes empty)
  let cleanPath = parsed.pathname.replace(/\/+$/, '');
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }
  if (cleanPath === '/') {
    cleanPath = '';
  }

  const queryString = parsed.searchParams.toString() ? `?${parsed.searchParams.toString()}` : '';

  return `${protocol}//${hostname}${port}${cleanPath}${queryString}`;
}
