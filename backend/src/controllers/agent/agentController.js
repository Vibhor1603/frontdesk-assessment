import { storeParticipantEmail } from "../../services/livekitService.js";
import { isValidEmail } from "../../services/emailService.js";

export const storeEmail = async (req, res) => {
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
};
