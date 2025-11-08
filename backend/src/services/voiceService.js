import { generateVoice } from "./ttsService.js";
import { processQuery } from "./knowledgeBase.js";
import { speechToText } from "./speechService.js";
import { supabase } from "../db/supabase.js";

export async function handleVoiceData(roomName, participantId, audioData) {
  try {
    // TODO: Implement STT using your preferred service
    const text = await convertSpeechToText(audioData);
    console.log(`Processing voice query: "${text}"`);

    // Process the query through the new knowledge base
    const result = await processQuery(text, participantId, roomName);

    let responseText = result.answer;
    let responseType = "answer";

    if (result.outOfScope) {
      responseText = "Sorry, I can't answer that.";
      responseType = "out_of_scope";
    } else if (result.needsHelp) {
      responseText =
        "I'm not sure about that. Let me contact my supervisor for help and I'll get back to you shortly.";
      responseType = "help_needed";
    } else if (result.error) {
      responseText =
        "I'm experiencing some technical difficulties. Please try again in a moment.";
      responseType = "error";
    }

    // Convert answer to speech
    const audioBuffer = await generateVoice(responseText);
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    return {
      type: responseType,
      text: responseText,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      helpRequestId: result.helpRequestId,
    };
  } catch (error) {
    console.error("Error processing voice data:", error);

    // Fallback response
    const fallbackText =
      "I'm experiencing some technical difficulties. Please try again in a moment.";
    try {
      const audioBuffer = await generateVoice(fallbackText);
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");
      return {
        type: "error",
        text: fallbackText,
        audio: `data:audio/mpeg;base64,${audioBase64}`,
      };
    } catch (ttsError) {
      return {
        type: "error",
        text: fallbackText,
      };
    }
  }
}

export async function convertSpeechToText(audioData) {
  try {
    if (!audioData || audioData.length === 0) {
      console.log("No audio data received");
      return "What are your opening hours?"; // Fallback for testing
    }

    // Convert base64 to buffer if needed
    let audioBuffer;
    if (typeof audioData === "string") {
      audioBuffer = Buffer.from(audioData, "base64");
    } else {
      audioBuffer = audioData;
    }

    console.log("Converting speech to text, audio length:", audioBuffer.length);
    const text = await speechToText(audioBuffer);
    console.log("STT result:", text);
    return text || "What are your opening hours?"; // Fallback
  } catch (error) {
    console.error("Error in speech-to-text conversion:", error);
    return "What are your opening hours?"; // Fallback for testing
  }
}

export async function createHelpRequest(roomName, question, participantId) {
  try {
    const { error } = await supabase.from("help_requests").insert({
      room_name: roomName,
      question: question,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
    console.log(`Created help request for room ${roomName}`);
    return true;
  } catch (error) {
    console.error("Error creating help request:", error);
    return false;
  }
}
