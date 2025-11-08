/**
 * Test if LiveKit server SDK can send data messages that clients receive
 */

import { RoomServiceClient } from "livekit-server-sdk";
import dotenv from "dotenv";

dotenv.config();

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

async function testDataSend() {
  const roomName = "customer-service";

  console.log("Testing data send to room:", roomName);

  const message = {
    type: "test_message",
    text: "Hello from server!",
    timestamp: new Date().toISOString(),
  };

  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(message));

  try {
    await roomService.sendData(roomName, data, {});
    console.log("✅ Data sent successfully");
    console.log("Message:", message);
  } catch (error) {
    console.error("❌ Error sending data:", error);
  }
}

testDataSend();
