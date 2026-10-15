import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Alitheia AI Detection API",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[Alitheia API] Server is running on port ${PORT}`);
});
