import { WebhookReceiver } from "livekit-server-sdk";
import {
  handleParticipantJoined,
  handleCustomerMessage,
} from "../../services/livekitService.js";

const webhookReceiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

export function handleLivekitWebhook(req, res) {
  try {
    webhookReceiver.receive(req.body, req.get("Authorization"));
    res.status(200).send();
  } catch (error) {
    res.status(400).send("Invalid webhook");
  }
}

export async function handleParticipantJoinedWebhook(req, res) {
  try {
    const { participantId } = req.body;
    const greeting = await handleParticipantJoined(participantId);

    if (greeting) {
      res.json({ success: true, message: greeting });
    } else {
      res.status(400).json({ error: "Invalid participant" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to handle participant joined" });
  }
}

export async function handleCustomerInput(req, res) {
  try {
    const { text, participantId } = req.body;
    const response = await handleCustomerMessage(text, participantId);
    res.json({ success: true, message: response });
  } catch (error) {
    res.status(500).json({ error: "Failed to handle customer input" });
  }
}
