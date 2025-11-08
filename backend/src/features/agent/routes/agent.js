import express from "express";
import { storeParticipantEmail } from "../../voice/services/livekitService.js";
import { isValidEmail } from "../../supervisor/services/emailService.js";

const router = express.Router();

// Agent control routes removed (POST /start, POST /stop, GET /status)
// Agent is auto-started in index.js and doesn't need manual control from frontend

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
