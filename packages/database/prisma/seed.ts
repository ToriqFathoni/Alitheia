import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[Seed] Memulai seeding database Alitheia...");

  // 1. Seed Pengguna per peran domain
  const roles = ["PUBLIK", "JURNALIS", "KREATOR", "AUDITOR", "ADMIN"];
  const users = [];

  for (const peran of roles) {
    const user = await prisma.pengguna.create({
      data: {
        peran,
      },
    });
    users.push(user);
    console.log(`[Seed] Created user: ${user.id} (${peran})`);
  }

  const jurnalisUser = users.find((u) => u.peran === "JURNALIS") ?? users[0]!;

  // 2. Seed Contoh Riwayat Kueri
  const sampleKueri = await prisma.riwayatKueri.create({
    data: {
      penggunaId: jurnalisUser.id,
      tipeInput: "TEKS",
      inputTeks:
        "Eastbridge's electric bus pilot cut average commute times by 20% in its first year, and the city says ridership doubled across all routes since launch.",
      status: "DONE",
    },
  });

  // 3. Seed Contoh Klaim
  const klaim1 = await prisma.klaim.create({
    data: {
      kueriId: sampleKueri.id,
      kalimatKlaim:
        "Eastbridge's electric bus pilot cut average commute times by 20% in its first year",
      subjek: "Eastbridge electric bus pilot",
      tindakan: "cut",
      objek: "average commute times by 20%",
      posisiAwal: 0,
      posisiAkhir: 82,
    },
  });

  // 4. Seed Bukti
  await prisma.bukti.create({
    data: {
      klaimId: klaim1.id,
      asalBukti: "WEB_SEARCH",
      urlRujukan: "https://example.com/eastbridge-transit-report-2025",
      kutipan:
        "Official transportation audit shows average commute times decreased by 19.4% during the electric bus trial period.",
    },
  });

  // 5. Seed Log Prediksi
  await prisma.logPrediksi.create({
    data: {
      klaimId: klaim1.id,
      labelNli: "ENTAILMENT",
      skorKepercayaan: 0.945,
      hasilAkhir: "BENAR",
      metadataKonteks: {
        model: "llm-nli-v1",
        stage: "DONE",
      },
    },
  });

  console.log("[Seed] Seeding database Alitheia selesai dengan sukses!");
}

main()
  .catch((e) => {
    console.error("[Seed] Gagal melakukan seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

