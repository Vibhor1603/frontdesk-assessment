import express from "express";
import { createToken } from "../auth/livekitAuth.js";
import { createRoom } from "../../features/voice/services/livekitService.js";

const router = express.Router();

router.post("/token", async (req, res) => {
  try {
    const { roomName, participantName } = req.body;

    // Ensure room exists before creating token
    try {
      await createRoom(roomName);
    } catch (error) {
      // Room might already exist, that's okay
      if (!error.message?.includes("already exists")) {
        console.error("Error creating room:", error);
      }
    }

    const token = await createToken(roomName, participantName);
    res.json({ token });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
