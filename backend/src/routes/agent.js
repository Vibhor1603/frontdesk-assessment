import express from "express";
import { storeEmail } from "../controllers/agent/agentController.js";

const router = express.Router();

router.post("/store-email", storeEmail);

export default router;
