import { EventEmitter } from "node:events";
import { logger } from "../logger.js";

export interface VerificationJobPayload {
  verificationId: string;
  type: "URL" | "TEKS";
  url?: string;
  text?: string;
}

export type VerificationJobHandler = (job: VerificationJobPayload) => Promise<void>;

class VerificationQueue {
  private emitter = new EventEmitter();
  private handler: VerificationJobHandler | null = null;

  constructor() {
    this.emitter.on("job", async (payload: VerificationJobPayload) => {
      if (!this.handler) {
        logger.error(
          { verificationId: payload.verificationId },
          "[VerificationQueue] Handler belum terdaftar untuk memproses job."
        );
        return;
      }

      try {
        await this.handler(payload);
      } catch (error) {
        logger.error(
          { error, verificationId: payload.verificationId },
          "[VerificationQueue] Galat tidak tertangani saat memproses job verifikasi."
        );
      }
    });
  }

  registerHandler(handler: VerificationJobHandler) {
    this.handler = handler;
  }

  async enqueue(payload: VerificationJobPayload): Promise<void> {
    logger.info(
      { verificationId: payload.verificationId, type: payload.type },
      "[VerificationQueue] Job verifikasi didaftarkan ke antrean."
    );

    // Jalankan secara asinkron di microtask / nextTick agar response 202 langsung kembali ke klien
    setImmediate(() => {
      this.emitter.emit("job", payload);
    });
  }
}

export const verificationQueue = new VerificationQueue();
