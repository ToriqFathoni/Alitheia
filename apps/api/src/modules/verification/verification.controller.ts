import { Request, Response } from "express";
import {
  CreateVerificationSchema,
  VerificationIdParamSchema,
  ApiResponseSuccess,
  ApiResponseError,
  CreateVerificationResponseDTO,
  VerificationDetailDataDTO,
} from "@alitheia/shared-types";
import { verificationService } from "./verification.service.js";

export const verificationController = {
  async createVerificationHandler(req: Request, res: Response): Promise<void> {
    const requestId = (res.locals.requestId as string) || "unknown";
    const parsed = CreateVerificationSchema.safeParse(req.body);

    if (!parsed.success) {
      const errorPayload: ApiResponseError = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Data permintaan verifikasi tidak valid.",
          details: parsed.error.flatten().fieldErrors,
        },
        meta: {
          requestId,
        },
      };
      res.status(400).json(errorPayload);
      return;
    }

    const data = await verificationService.createVerification(parsed.data);
    const successPayload: ApiResponseSuccess<CreateVerificationResponseDTO> = {
      success: true,
      data,
      meta: {
        requestId,
      },
    };

    res.status(202).json(successPayload);
  },

  async getVerificationByIdHandler(req: Request, res: Response): Promise<void> {
    const requestId = (res.locals.requestId as string) || "unknown";
    const parsedParam = VerificationIdParamSchema.safeParse(req.params);

    if (!parsedParam.success) {
      const errorPayload: ApiResponseError = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Parameter id harus berformat UUID yang valid.",
          details: parsedParam.error.flatten().fieldErrors,
        },
        meta: {
          requestId,
        },
      };
      res.status(400).json(errorPayload);
      return;
    }

    const data = await verificationService.getVerificationById(parsedParam.data.id);
    const successPayload: ApiResponseSuccess<VerificationDetailDataDTO> = {
      success: true,
      data,
      meta: {
        requestId,
      },
    };

    res.status(200).json(successPayload);
  },
};
