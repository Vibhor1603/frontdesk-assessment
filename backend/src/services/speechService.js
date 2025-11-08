import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

// Using Groq's Whisper for Speech-to-Text
export async function speechToText(audioBuffer) {
  try {
    const formData = new FormData();

    // Convert buffer to blob for FormData
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("file", audioBlob, "audio.wav");
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "text");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Groq STT API error: ${response.status} ${response.statusText}`
      );
    }

    const text = await response.text();
    return text.trim();
  } catch (error) {
    console.error("Error in speech-to-text:", error);
    throw error;
  }
}

// Alternative: Using browser's Web Speech API (client-side)
export function createWebSpeechConfig() {
  return {
    continuous: true,
    interimResults: false,
    lang: "en-US",
    maxAlternatives: 1,
  };
}
