-- DropIndex
DROP INDEX "idx_dokumen_vektor_embedding";

-- CreateTable
CREATE TABLE "checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_url" TEXT NOT NULL,
    "normalized_url" TEXT NOT NULL,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress_stage" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "check_id" UUID NOT NULL,
    "media_type" TEXT NOT NULL,
    "storage_key" TEXT,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "duration_sec" DECIMAL(65,30),
    "sha256" TEXT,
    "caption" TEXT,
    "author_handle" TEXT,
    "posted_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "check_id" UUID NOT NULL,
    "language" TEXT,
    "full_text" TEXT NOT NULL,
    "segments" JSONB,
    "provider" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "check_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "frame_time_sec" DECIMAL(65,30),
    "full_text" TEXT NOT NULL,
    "blocks" JSONB,
    "provider" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "check_id" UUID NOT NULL,
    "verdict" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "summary" TEXT,
    "explanation" TEXT NOT NULL,
    "claims" JSONB,
    "model_version" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "check_id" UUID NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "publisher" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "snippet" TEXT,
    "stance" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_events" (
    "id" SERIAL NOT NULL,
    "check_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checks_normalized_url_idx" ON "checks"("normalized_url");

-- CreateIndex
CREATE INDEX "checks_created_at_idx" ON "checks"("created_at" DESC);

-- CreateIndex
CREATE INDEX "checks_status_idx" ON "checks"("status");

-- CreateIndex
CREATE INDEX "media_assets_check_id_idx" ON "media_assets"("check_id");

-- CreateIndex
CREATE INDEX "transcripts_check_id_idx" ON "transcripts"("check_id");

-- CreateIndex
CREATE INDEX "ocr_results_check_id_idx" ON "ocr_results"("check_id");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_results_check_id_key" ON "analysis_results"("check_id");

-- CreateIndex
CREATE INDEX "sources_check_id_idx" ON "sources"("check_id");

-- CreateIndex
CREATE INDEX "check_events_check_id_idx" ON "check_events"("check_id");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_events" ADD CONSTRAINT "check_events_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
