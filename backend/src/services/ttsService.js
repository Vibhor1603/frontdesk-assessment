import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

export async function generateVoice(text) {
  try {
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Default voice ID (Rachel)
    const API_KEY = process.env.ELEVEN_LABS_API_KEY;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `ElevenLabs API error: ${response.status} ${response.statusText}`
      );
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error generating voice:", error);

    throw error;
  }
}
