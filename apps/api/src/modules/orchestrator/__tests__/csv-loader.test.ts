import { describe, it, expect } from "vitest";
import { parseCsv, loadTrainingDatasetFromCsv } from "../csv-loader.js";

describe("CsvLoader", () => {
  it("harus mem-parsing baris CSV sederhana dan baris dengan tanda kutip multiline", () => {
    const csvContent = `ID,label,tanggal,judul,narasi,nama file gambar
1,1,17-Aug-20,Judul Hoax,"Narasi baris 1
Narasi baris 2, ada koma",1.jpg
2,0,18-Aug-20,"Judul ""Faktual"" Valid",Berita resmi dari pemda,2.png`;

    const parsed = parseCsv(csvContent);
    expect(parsed).toHaveLength(2);

    expect(parsed[0]?.["ID"]).toBe("1");
    expect(parsed[0]?.["label"]).toBe("1");
    expect(parsed[0]?.["judul"]).toBe("Judul Hoax");
    expect(parsed[0]?.["narasi"]).toContain("Narasi baris 1\nNarasi baris 2, ada koma");
    expect(parsed[0]?.["nama file gambar"]).toBe("1.jpg");

    expect(parsed[1]?.["ID"]).toBe("2");
    expect(parsed[1]?.["label"]).toBe("0");
    expect(parsed[1]?.["judul"]).toBe('Judul "Faktual" Valid');
    expect(parsed[1]?.["narasi"]).toBe("Berita resmi dari pemda");
  });

  it("harus mampu membaca file nyata data/Data_latih.csv secara penuh sebanyak 4.231 baris", () => {
    const dataset = loadTrainingDatasetFromCsv();
    expect(dataset.length).toBe(4231);

    const hoaxCount = dataset.filter((d) => d.label === 1).length;
    const factCount = dataset.filter((d) => d.label === 0).length;

    expect(hoaxCount).toBe(3465);
    expect(factCount).toBe(766);

    // Verifikasi item pertama
    expect(dataset[0]?.externalId).toBe("71");
    expect(dataset[0]?.label).toBe(1);
    expect(dataset[0]?.judul).toContain("Legionnaires");

    // Verifikasi item terakhir
    expect(dataset[dataset.length - 1]?.externalId).toBe("999860");
    expect(dataset[dataset.length - 1]?.label).toBe(1);
  });
});

