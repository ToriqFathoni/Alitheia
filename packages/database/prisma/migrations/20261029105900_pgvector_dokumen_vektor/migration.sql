-- CreateTable for pgvector internal document store
CREATE TABLE IF NOT EXISTS "dokumen_vektor" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "judul" TEXT,
  "isi" TEXT,
  "url_rujukan" TEXT,
  "sumber" VARCHAR(128),
  "label_sumber" VARCHAR(32),
  "kredibilitas" NUMERIC(3, 2),
  "diterbitkan_pada" DATE,
  "embedding" vector(1536)
);

-- CreateIndex using HNSW for cosine similarity
CREATE INDEX IF NOT EXISTS "idx_dokumen_vektor_embedding" ON "dokumen_vektor" USING hnsw ("embedding" vector_cosine_ops);

