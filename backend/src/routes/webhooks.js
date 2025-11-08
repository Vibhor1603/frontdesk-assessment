import express from "express";
import { WebhookReceiver } from "livekit-server-sdk";
import {
  handleParticipantJoined,
  handleCustomerMessage,
} from "../services/audioAgent.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// LiveKit webhook receiver
const webhookReceiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// LiveKit webhook endpoint
router.post(
  "/livekit",
  express.raw({ type: "application/webhook+json" }),
  async (req, res) => {
    try {
      const event = webhookReceiver.receive(req.body, req.get("Authorization"));
      console.log(`[Webhook] Received event: ${event.event}`);
      res.status(200).send();
    } catch (error) {
      console.error("[Webhook] Error processing webhook:", error);
      res.status(400).send("Invalid webhook");
    }
  }
);

// Participant joined
router.post("/participant-joined", async (req, res) => {
  try {
    const { participantId } = req.body;
    const greeting = await handleParticipantJoined(participantId);

    if (greeting) {
      res.json({ success: true, message: greeting });
    } else {
      res.status(400).json({ error: "Invalid participant" });
    }
  } catch (error) {
    console.error("[Webhook] Error handling participant joined:", error);
    res.status(500).json({ error: "Failed to handle participant joined" });
  }
});

// Customer message
router.post("/customer-input", async (req, res) => {
  try {
    const { text, participantId } = req.body;
    const response = await handleCustomerMessage(text, participantId);
    res.json({ success: true, message: response });
  } catch (error) {
    console.error("[Webhook] Error handling customer input:", error);
    res.status(500).json({ error: "Failed to handle customer input" });
  }
});

export default router;
