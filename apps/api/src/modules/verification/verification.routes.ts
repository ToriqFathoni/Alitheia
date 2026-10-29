import { Router } from "express";
import { asyncHandler } from "../../middleware/error.middleware.js";
import { verificationController } from "./verification.controller.js";

export const verificationRouter = Router();

verificationRouter.post("/", asyncHandler(verificationController.createVerificationHandler));
verificationRouter.get("/:id", asyncHandler(verificationController.getVerificationByIdHandler));
