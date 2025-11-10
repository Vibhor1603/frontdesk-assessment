import express from "express";
import {
  handleLivekitWebhook,
  handleParticipantJoinedWebhook,
  handleCustomerInput,
} from "../controllers/webhook/webhookController.js";

const router = express.Router();

router.post(
  "/livekit",
  express.raw({ type: "application/webhook+json" }),
  handleLivekitWebhook
);
router.post("/participant-joined", handleParticipantJoinedWebhook);
router.post("/customer-input", handleCustomerInput);

export default router;
