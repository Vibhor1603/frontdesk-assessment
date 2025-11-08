import express from "express";
import {
  startAgent,
  stopAgent,
  getAgentStatus,
  storeParticipantEmail,
} from "../services/audioAgent.js";
import { isValidEmail } from "../services/emailService.js";

const router = express.Router();

// Start the agent
router.post("/start", async (req, res) => {
  try {
    const { roomName } = req.body;
    const success = await startAgent(roomName || "customer-service");
    res.json({
      success,
      status: getAgentStatus(),
    });
  } catch (error) {
    console.error("Error starting agent:", error);
    res.status(500).json({ error: "Failed to start agent" });
  }
});

// Stop the agent
router.post("/stop", async (req, res) => {
  try {
    await stopAgent();
    res.json({ success: true });
  } catch (error) {
    console.error("Error stopping agent:", error);
    res.status(500).json({ error: "Failed to stop agent" });
  }
});

// Get agent status
router.get("/status", (req, res) => {
  try {
    const status = getAgentStatus();
    res.json({
      running: status.active,
      status,
    });
  } catch (error) {
    console.error("Error getting agent status:", error);
    res.status(500).json({ error: "Failed to get agent status" });
  }
});

// Store participant email
router.post("/store-email", async (req, res) => {
  try {
    const { participantId, email, helpRequestId } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const result = await storeParticipantEmail(
      participantId,
      email,
      helpRequestId
    );
    res.json(result);
  } catch (error) {
    console.error("Error storing email:", error);
    res.status(500).json({ error: "Failed to store email" });
  }
});

export default router;
