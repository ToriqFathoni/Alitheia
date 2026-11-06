import { logger } from "../../../lib/logger.js";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publisher: string;
  publishedAt?: string;
  sourceType: "GOOGLE_NEWS" | "FACT_CHECK" | "WIKIPEDIA";
}

export class WebSearchClient {
  private timeoutMs: number;

  constructor(timeoutMs = 6000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Ekstraksi query pencarian ringkas dari judul atau teks berita.
   * Mengabaikan judul placeholder (seperti "Masukan Teks Langsung") dan membuang stop words.
   */
  public buildSearchQuery(title?: string, text?: string): string {
    const isGenericTitle =
      !title ||
      /^(masukan teks|berita masukan|teks|artikel|plain text|plain_text|untitled|input teks)/i.test(title.trim()) ||
      title.trim().toLowerCase() === "masukan teks langsung";

    const raw = (isGenericTitle ? (text || "") : title || text || "").trim();
    // Ambil kalimat pertama atau maksimal 150 karakter pertama
    const candidateText = raw.split(/[.!?\n]/)[0] || raw;

    const cleanText = candidateText
      .replace(/[^\w\s\u00C0-\u024F]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const stopWords = new Set([
      "yang", "di", "ke", "dari", "pada", "dalam", "untuk", "dengan", "dan", "atau",
      "ini", "itu", "juga", "adalah", "sebagai", "oleh", "akan", "telah", "bisa", "ada",
      "tidak", "karena", "maka", "tentang", "bahwa", "masukan", "teks", "langsung", "berita",
      "apakah", "bagaimana", "mengapa", "kenapa", "melaksanakan", "dikabarkan", "menurut",
      "sampai", "sudah", "lebih", "dapat", "sebuah", "suatu"
    ]);

    const words = cleanText
      .split(" ")
      .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));

    const selected = words.slice(0, 6).join(" ");
    return selected.length > 0 ? selected : cleanText.slice(0, 60);
  }

  /**
   * Mengambil berita dari Google News RSS Indonesia.
   */
  public async searchGoogleNews(query: string, maxResults = 5): Promise<WebSearchResult[]> {
    if (!query || query.trim().length === 0) return [];

    try {
      const encoded = encodeURIComponent(query.trim());
      const url = `https://news.google.com/rss/search?q=${encoded}&hl=id-ID&gl=ID&ceid=ID:id`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Alitheia/1.0",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return [];
      }

      const xml = await response.text();
      const queryTokens = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4);

      return this.parseRssXml(xml, maxResults, queryTokens);
    } catch (err: any) {
      logger.debug({ err: err?.message, query }, "[WebSearchClient] Gagal mengambil Google News RSS.");
      return [];
    }
  }

  /**
   * Mengambil ringkasan dari Wikipedia Indonesia jika relevan.
   */
  public async searchWikipedia(query: string, maxResults = 2): Promise<WebSearchResult[]> {
    if (!query || query.trim().length === 0) return [];

    try {
      const encoded = encodeURIComponent(query.trim());
      const url = `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&utf8=1`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "AlitheiaFactChecker/1.0",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) return [];

      const data: any = await response.json();
      const hits = data?.query?.search || [];

      return hits.slice(0, maxResults).map((h: any) => ({
        title: h.title,
        url: `https://id.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, "_"))}`,
        snippet: (h.snippet || "").replace(/<[^>]+>/g, "").trim(),
        publisher: "Wikipedia Indonesia",
        sourceType: "WIKIPEDIA" as const,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Eksekusi pencarian gabungan (Google News + Wikipedia) secara paralel.
   */
  public async search(title?: string, text?: string, maxResults = 6): Promise<WebSearchResult[]> {
    const query = this.buildSearchQuery(title, text);
    if (!query) return [];

    try {
      const [newsResults, wikiResults] = await Promise.allSettled([
        this.searchGoogleNews(query, maxResults),
        this.searchWikipedia(query, 2),
      ]);

      const results: WebSearchResult[] = [];
      const seenUrls = new Set<string>();

      if (newsResults.status === "fulfilled") {
        for (const item of newsResults.value) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            results.push(item);
          }
        }
      }

      if (wikiResults.status === "fulfilled") {
        for (const item of wikiResults.value) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            results.push(item);
          }
        }
      }

      return results.slice(0, maxResults);
    } catch (err: any) {
      logger.warn({ error: err?.message }, "[WebSearchClient] Error saat menjalankan agregasi pencarian web.");
      return [];
    }
  }

  /**
   * Parser ringan XML RSS item Google News tanpa dependensi library eksternal.
   */
  public parseRssXml(xml: string, maxResults: number, queryTokens?: string[]): WebSearchResult[] {
    const results: WebSearchResult[] = [];
    // Ambil lebih banyak kandidat terlebih dahulu agar setelah difilter relevansi tetap mencukupi maxResults
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, maxResults * 3);

    for (const match of itemMatches) {
      const content = match[1] || "";
      const rawTitle = content.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
      const rawLink = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || undefined;
      const rawSource = content.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "";

      // Bersihkan CDATA dan HTML entities
      const cleanTitle = this.cleanXmlText(rawTitle);
      const cleanPublisher = this.cleanXmlText(rawSource) || "Portal Berita";
      const cleanLink = this.cleanXmlText(rawLink);

      if (cleanTitle && cleanLink) {
        // Filter relevansi: jika queryTokens diberikan, minimal satu kata kunci harus muncul di judul/penerbit
        if (queryTokens && queryTokens.length > 0) {
          const lowerCombined = `${cleanTitle} ${cleanPublisher}`.toLowerCase();
          const isMatch = queryTokens.some((t) => lowerCombined.includes(t));
          if (!isMatch) {
            continue;
          }
        }

        results.push({
          title: cleanTitle,
          url: cleanLink,
          snippet: `Diterbitkan oleh ${cleanPublisher} (${pubDate || "Terkini"}). Berita terkait: ${cleanTitle}`,
          publisher: cleanPublisher,
          publishedAt: pubDate,
          sourceType: "GOOGLE_NEWS",
        });

        if (results.length >= maxResults) {
          break;
        }
      }
    }

    return results;
  }

  private cleanXmlText(text: string): string {
    return text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}

export const webSearchClient = new WebSearchClient();

