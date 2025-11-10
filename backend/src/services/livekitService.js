import { RoomServiceClient } from "livekit-server-sdk";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { processQuery } from "./knowledgeBase.js";
import { supabase } from "../db/supabase.js";

dotenv.config();

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

const agentState = {
  roomName: "customer-service",
  isActive: false,
  conversationHistory: new Map(),
  pendingHelpRequests: new Map(),
  activeParticipants: new Set(),
  participantEmails: new Map(),
};

export async function createRoom(roomName, options = {}) {
  try {
    const room = await roomService.createRoom({
      name: roomName,
      emptyTimeout: options.emptyTimeout || 300,
      maxParticipants: options.maxParticipants || 10,
      metadata: JSON.stringify({
        type: "frontdesk-ai",
        createdAt: new Date().toISOString(),
        ...options.metadata,
      }),
    });
    return room;
  } catch (error) {
    if (error.message.includes("already exists")) {
      return await getRoomInfo(roomName);
    }
    throw error;
  }
}

async function getRoomInfo(roomName) {
  const rooms = await roomService.listRooms([roomName]);
  return rooms[0];
}

export async function generateVoice(text) {
  try {
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const API_KEY = process.env.ELEVEN_LABS_API_KEY;

    if (!API_KEY) {
      throw new Error(
        "ELEVEN_LABS_API_KEY is not set in environment variables"
      );
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": API_KEY.trim(),
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.arrayBuffer();
  } catch (error) {
    throw error;
  }
}

export async function startAgent(roomName = "customer-service") {
  if (agentState.isActive) {
    return true;
  }

  try {
    agentState.roomName = roomName;

    try {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 0,
        maxParticipants: 50,
      });
    } catch (error) {
      if (!error.message?.includes("already exists")) {
        throw error;
      }
    }

    agentState.isActive = true;
    return true;
  } catch (error) {
    console.error("[Agent] ❌ Failed to start:", error);
    return false;
  }
}

export async function stopAgent() {
  agentState.isActive = false;
}

export function getAgentStatus() {
  return {
    active: agentState.isActive,
    roomName: agentState.roomName,
    participantCount: agentState.activeParticipants.size,
    pendingRequests: agentState.pendingHelpRequests.size,
    conversationCount: agentState.conversationHistory.size,
    emailsCollected: agentState.participantEmails.size,
  };
}

export async function handleParticipantJoined(participantId) {
  if (participantId.startsWith("customer-")) {
    agentState.activeParticipants.add(participantId);

    if (!agentState.conversationHistory.has(participantId)) {
      agentState.conversationHistory.set(participantId, [
        {
          role: "system",
          content:
            "You are a friendly AI receptionist for Luxe Salon and Spa. " +
            "Help customers with services, hours, pricing, and appointments. " +
            "Be warm, welcoming, and concise.",
        },
      ]);
    }

    const greeting =
      "Hi! Welcome to Luxe Salon and Spa. How can I help you today?";
    const audioBuffer = await generateVoice(greeting);
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    return {
      type: "agent_response",
      text: greeting,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      timestamp: new Date().toISOString(),
    };
  }

  return null;
}

export async function handleCustomerMessage(text, participantId) {
  try {
    const history = agentState.conversationHistory.get(participantId) || [];
    history.push({ role: "user", content: text });

    const kbResult = await processQuery(
      text,
      participantId,
      agentState.roomName
    );
    let responseText;
    let needsEmail = false;
    let requiresBooking = false;
    let bookingType = null;

    if (kbResult.requiresBooking) {
      responseText = kbResult.answer;
      requiresBooking = true;
      bookingType = kbResult.bookingType;
    } else if (kbResult.needsHelp) {
      needsEmail = true;
      responseText = kbResult.answer;

      if (kbResult.helpRequestId) {
        agentState.pendingHelpRequests.set(kbResult.helpRequestId, {
          participantId,
          question: text,
        });
      }
    } else {
      responseText = kbResult.answer;
    }

    history.push({ role: "assistant", content: responseText });

    if (history.length > 11) {
      agentState.conversationHistory.set(participantId, [
        history[0],
        ...history.slice(-10),
      ]);
    }

    const audioBuffer = await generateVoice(responseText);
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    return {
      type: "agent_response",
      text: responseText,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      timestamp: new Date().toISOString(),
      needsEmail,
      requiresBooking,
      bookingType,
      helpRequestId: kbResult.helpRequestId,
    };
  } catch (error) {
    console.error("[Agent] ❌ Error:", error);

    const errorAudio = await generateVoice(
      "I'm experiencing technical difficulties. Please try again."
    );
    const errorBase64 = Buffer.from(errorAudio).toString("base64");

    return {
      type: "agent_response",
      text: "I'm experiencing technical difficulties. Please try again.",
      audio: `data:audio/mpeg;base64,${errorBase64}`,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function storeParticipantEmail(
  participantId,
  email,
  helpRequestId
) {
  try {
    agentState.participantEmails.set(participantId, email);

    if (helpRequestId) {
      await updateHelpRequestEmail(helpRequestId, email);
    }

    return { success: true };
  } catch (error) {
    console.error("[Agent] ❌ Error storing email:", error);
    return { success: false, error: error.message };
  }
}

async function updateHelpRequestEmail(helpRequestId, email) {
  try {
    const { error } = await supabase
      .from("help_requests")
      .update({ customer_email: email })
      .eq("id", helpRequestId);

    if (error) {
      console.error(`[Agent] ❌ Error updating email:`, error);
    }
  } catch (error) {
    console.error("[Agent] ❌ Error updating help request email:", error);
  }
}
