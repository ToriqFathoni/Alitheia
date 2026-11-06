import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  NINEROUTER_BASE_URL: z.string().default("http://localhost:20128/v1"),
  NINEROUTER_API_KEY: z.string().default(""),
  NINEROUTER_MODEL: z.string().default("kr/claude-haiku-4.5"),
  MAX_TRAINING_DATA_ROWS: z.coerce.number().default(5000),
  TRAINING_CSV_PATH: z.string().default("data/Data_latih.csv"),
  GEMINI_RATE_LIMIT_COOLDOWN_MS: z.coerce.number().default(60000),
  EXTERNAL_TIMEOUT_MS: z.coerce.number().default(15000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Konfigurasi environment variable tidak valid:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
