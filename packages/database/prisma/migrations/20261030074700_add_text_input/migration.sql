-- AlterTable
ALTER TABLE "checks" ADD COLUMN IF NOT EXISTS "input_text" TEXT;
ALTER TABLE "checks" ADD COLUMN IF NOT EXISTS "input_type" TEXT NOT NULL DEFAULT 'url';
ALTER TABLE "checks" ALTER COLUMN "source_url" SET DEFAULT '';
ALTER TABLE "checks" ALTER COLUMN "normalized_url" SET DEFAULT '';
