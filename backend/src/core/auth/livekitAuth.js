import dotenv from "dotenv";
import { AccessToken } from "livekit-server-sdk";

dotenv.config();
const createToken = async (roomName, participantName) => {
  if (!roomName || !participantName) {
    throw new Error("Room name and participant name are required");
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: participantName,
      ttl: "60m", // Token valid for 1 hour
    }
  );

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return await at.toJwt();
};
export { createToken };
