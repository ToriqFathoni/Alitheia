import { describe, it, expect } from "vitest";
import { WebSearchClient } from "../retrieval/web-search.client.js";

describe("WebSearchClient", () => {
  const client = new WebSearchClient();

  it("mampu membangun query pencarian ringkas dan membuang stop words", () => {
    const title = "Mahasiswa Universitas Indonesia demo pada 6 November 2026";
    const query = client.buildSearchQuery(title);
    expect(query).toContain("Mahasiswa");
    expect(query).toContain("Universitas");
    expect(query).toContain("Indonesia");
    expect(query).not.toContain("pada");
  });

  it("mampu mem-parsing XML RSS item secara deterministik", () => {
    const mockXml = `
      <rss version="2.0">
        <channel>
          <item>
            <title><![CDATA[Demo BEM UI Menolak Kenaikan UKT - Kompas.com]]></title>
            <link>https://news.google.com/rss/articles/12345</link>
            <pubDate>Wed, 06 Nov 2026 10:00:00 GMT</pubDate>
            <source url="https://kompas.com">Kompas.com</source>
          </item>
          <item>
            <title>Aksi Damai Mahasiswa di Depok - Tempo.co</title>
            <link>https://news.google.com/rss/articles/67890</link>
            <pubDate>Wed, 06 Nov 2026 12:00:00 GMT</pubDate>
            <source url="https://tempo.co">Tempo.co</source>
          </item>
        </channel>
      </rss>
    `;

    const results = client.parseRssXml(mockXml, 5);
    expect(results).toHaveLength(2);
    expect(results[0]?.title).toBe("Demo BEM UI Menolak Kenaikan UKT - Kompas.com");
    expect(results[0]?.publisher).toBe("Kompas.com");
    expect(results[0]?.url).toBe("https://news.google.com/rss/articles/12345");
    expect(results[1]?.title).toBe("Aksi Damai Mahasiswa di Depok - Tempo.co");
    expect(results[1]?.publisher).toBe("Tempo.co");
  });

  it("menangani query kosong secara aman tanpa exception", async () => {
    const res = await client.search("", "");
    expect(res).toEqual([]);
  });
});

