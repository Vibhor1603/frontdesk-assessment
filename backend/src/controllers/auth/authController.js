import { createToken } from "../../utils/livekitAuth.js";
import { createRoom } from "../../services/livekitService.js";

export async function generateToken(req, res) {
  try {
    const { roomName, participantName } = req.body;

    try {
      await createRoom(roomName);
    } catch (error) {
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
}
