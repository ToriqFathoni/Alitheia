-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "pengguna" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "peran" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_kueri" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pengguna_id" UUID,
    "tipe_input" VARCHAR(32) NOT NULL,
    "input_teks" TEXT,
    "url_sumber" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_kueri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "klaim" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kueri_id" UUID NOT NULL,
    "kalimat_klaim" TEXT NOT NULL,
    "subjek" TEXT,
    "tindakan" TEXT,
    "objek" TEXT,
    "posisi_awal" INTEGER,
    "posisi_akhir" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "klaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bukti" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "klaim_id" UUID NOT NULL,
    "asal_bukti" VARCHAR(64) NOT NULL,
    "url_rujukan" TEXT,
    "kutipan" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bukti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_prediksi" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "klaim_id" UUID NOT NULL,
    "label_nli" VARCHAR(32) NOT NULL,
    "skor_kepercayaan" DECIMAL(5,4) NOT NULL,
    "hasil_akhir" VARCHAR(32) NOT NULL,
    "metadata_konteks" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_prediksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_kesalahan_prediksi" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prediksi_id" UUID NOT NULL,
    "deskripsi_kesalahan" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_kesalahan_prediksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "umpan_balik" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prediksi_id" UUID NOT NULL,
    "pengguna_id" UUID,
    "isi_umpan_balik" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "umpan_balik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_analitik" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "periode" DATE NOT NULL,
    "total_kueri" INTEGER NOT NULL,
    "total_klaim" INTEGER NOT NULL,
    "jumlah_entailment" INTEGER NOT NULL,
    "jumlah_contradiction" INTEGER NOT NULL,
    "jumlah_neutral" INTEGER NOT NULL,
    "rata_skor_kepercayaan" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "data_analitik_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "riwayat_kueri_pengguna_id_created_at_idx" ON "riwayat_kueri"("pengguna_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "riwayat_kueri_status_idx" ON "riwayat_kueri"("status");

-- CreateIndex
CREATE INDEX "klaim_kueri_id_idx" ON "klaim"("kueri_id");

-- CreateIndex
CREATE INDEX "bukti_klaim_id_idx" ON "bukti"("klaim_id");

-- CreateIndex
CREATE INDEX "log_prediksi_klaim_id_idx" ON "log_prediksi"("klaim_id");

-- CreateIndex
CREATE INDEX "log_prediksi_hasil_akhir_created_at_idx" ON "log_prediksi"("hasil_akhir", "created_at");

-- CreateIndex
CREATE INDEX "log_kesalahan_prediksi_prediksi_id_idx" ON "log_kesalahan_prediksi"("prediksi_id");

-- CreateIndex
CREATE INDEX "umpan_balik_prediksi_id_idx" ON "umpan_balik"("prediksi_id");

-- CreateIndex
CREATE INDEX "umpan_balik_pengguna_id_idx" ON "umpan_balik"("pengguna_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_analitik_periode_key" ON "data_analitik"("periode");

-- AddForeignKey
ALTER TABLE "riwayat_kueri" ADD CONSTRAINT "riwayat_kueri_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "klaim" ADD CONSTRAINT "klaim_kueri_id_fkey" FOREIGN KEY ("kueri_id") REFERENCES "riwayat_kueri"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bukti" ADD CONSTRAINT "bukti_klaim_id_fkey" FOREIGN KEY ("klaim_id") REFERENCES "klaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_prediksi" ADD CONSTRAINT "log_prediksi_klaim_id_fkey" FOREIGN KEY ("klaim_id") REFERENCES "klaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_kesalahan_prediksi" ADD CONSTRAINT "log_kesalahan_prediksi_prediksi_id_fkey" FOREIGN KEY ("prediksi_id") REFERENCES "log_prediksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "umpan_balik" ADD CONSTRAINT "umpan_balik_prediksi_id_fkey" FOREIGN KEY ("prediksi_id") REFERENCES "log_prediksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "umpan_balik" ADD CONSTRAINT "umpan_balik_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
