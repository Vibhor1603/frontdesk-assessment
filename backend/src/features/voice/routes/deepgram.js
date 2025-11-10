import express from "express";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Endpoint to get Deepgram API key for client-side usage
router.get("/api-key", (req, res) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Deepgram API key not configured" });
  }

  res.json({ apiKey });
});

export default router;
