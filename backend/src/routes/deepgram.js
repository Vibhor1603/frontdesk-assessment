import express from "express";
import { getApiKey } from "../controllers/deepgram/deepgramController.js";

const router = express.Router();

router.get("/api-key", getApiKey);

export default router;
