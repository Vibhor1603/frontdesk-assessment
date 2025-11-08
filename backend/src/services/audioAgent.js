/**
 * Audio Agent with RAG/KB - Functional Implementation
 * Email collection via frontend toast, not chat
 */

import { RoomServiceClient } from "livekit-server-sdk";
import { processQuery, storeQA } from "./knowledgeBase.js";
import { generateVoice } from "./ttsService.js";
import { supabase } from "../db/supabase.js";
import { sendAnswerEmail } from "./emailService.js";
import dotenv from "dotenv";

dotenv.config();

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// Agent state
const state = {
  roomName: "customer-service",
  isActive: false,
  conversationHistory: new Map(),
  pendingHelpRequests: new Map(),
  activeParticipants: new Set(),
  participantEmails: new Map(),
};

export async function startAgent(roomName = "customer-service") {
  if (state.isActive) {
    console.log("[Agent] Already running");
    return true;
  }

  try {
    console.log(`\n[Agent] 🚀 Starting for room: ${roomName}`);
    state.roomName = roomName;

    // Ensure room exists
    try {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 0,
        maxParticipants: 50,
      });
      console.log(`[Agent] ✅ Room created`);
    } catch (error) {
      if (error.message?.includes("already exists")) {
        console.log(`[Agent] ✅ Room exists`);
      } else {
        throw error;
      }
    }

    state.isActive = true;
    console.log(`[Agent] ✅ Ready`);
    return true;
  } catch (error) {
    console.error("[Agent] ❌ Failed to start:", error);
    return false;
  }
}

export async function stopAgent() {
  state.isActive = false;
  console.log("[Agent] 🛑 Stopped");
}

export function getAgentStatus() {
  return {
    active: state.isActive,
    roomName: state.roomName,
    participantCount: state.activeParticipants.size,
    pendingRequests: state.pendingHelpRequests.size,
    conversationCount: state.conversationHistory.size,
    emailsCollected: state.participantEmails.size,
  };
}

export async function handleParticipantJoined(participantId) {
  console.log(`\n[Agent] 👤 Participant joined: ${participantId}`);

  if (participantId.startsWith("customer-")) {
    state.activeParticipants.add(participantId);

    // Initialize conversation
    if (!state.conversationHistory.has(participantId)) {
      state.conversationHistory.set(participantId, [
        {
          role: "system",
          content:
            "You are a friendly AI receptionist for Luxe Salon and Spa. " +
            "Help customers with services, hours, pricing, and appointments. " +
            "Be warm, welcoming, and concise.",
        },
      ]);
    }

    // Generate greeting
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
    console.log(`\n[Agent] 📝 Processing: "${text}"`);

    // Get conversation history
    const history = state.conversationHistory.get(participantId) || [];
    history.push({ role: "user", content: text });

    // Search knowledge base (handles multiple questions)
    const kbResult = await processQuery(text, participantId, state.roomName);

    console.log(`[Agent] 📊 Result:`, {
      found: kbResult.found,
      needsHelp: kbResult.needsHelp,
    });

    let responseText;
    let needsEmail = false;

    if (kbResult.needsHelp) {
      console.log(`[Agent] 🆘 Escalating to supervisor`);

      // Always ask for email when escalating (don't reuse old email)
      needsEmail = true;
      responseText = kbResult.answer;

      // Store help request
      if (kbResult.helpRequestId) {
        state.pendingHelpRequests.set(kbResult.helpRequestId, {
          participantId,
          question: text,
        });
      }
    } else {
      // Found in KB
      responseText = kbResult.answer;
    }

    // Add to history
    history.push({ role: "assistant", content: responseText });

    // Keep history manageable
    if (history.length > 11) {
      state.conversationHistory.set(participantId, [
        history[0],
        ...history.slice(-10),
      ]);
    }

    // Generate audio
    const audioBuffer = await generateVoice(responseText);
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    return {
      type: "agent_response",
      text: responseText,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      timestamp: new Date().toISOString(),
      needsEmail, // Signal frontend to show email toast
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
    console.log(`[Agent] 📧 Storing email for ${participantId}: ${email}`);

    // Store in memory
    state.participantEmails.set(participantId, email);

    // Update help request in database
    if (helpRequestId) {
      await updateHelpRequestEmail(helpRequestId, email);
    }

    return { success: true };
  } catch (error) {
    console.error("[Agent] ❌ Error storing email:", error);
    return { success: false, error: error.message };
  }
}

export async function handleSupervisorAnswer(requestId, requestData) {
  try {
    console.log(`\n[Agent] 📬 Supervisor answered request ${requestId}`);

    const { question, answer, customer_email } = requestData;
    const requestInfo = state.pendingHelpRequests.get(requestId);

    // Send email if available
    if (customer_email) {
      console.log(`[Agent] 📧 Sending email to ${customer_email}`);
      const emailResult = await sendAnswerEmail(
        customer_email,
        question,
        answer
      );

      if (emailResult.success) {
        await supabase
          .from("help_requests")
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }
    }

    // If customer still in room, send message
    if (
      requestInfo &&
      state.activeParticipants.has(requestInfo.participantId)
    ) {
      const followUpMessage = `Great news! I heard back from my supervisor. ${answer}`;
      const audioBuffer = await generateVoice(followUpMessage);
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      const message = {
        type: "agent_response",
        text: followUpMessage,
        audio: `data:audio/mpeg;base64,${audioBase64}`,
        timestamp: new Date().toISOString(),
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));
      await roomService.sendData(state.roomName, data, {});
    }

    // Store in KB
    await storeQA(question, answer, requestId);

    // Mark as resolved
    await supabase
      .from("help_requests")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    state.pendingHelpRequests.delete(requestId);
    console.log(`[Agent] ✅ Handled supervisor answer\n`);
  } catch (error) {
    console.error("[Agent] ❌ Error handling supervisor answer:", error);
  }
}

// Helper functions
async function updateHelpRequestEmail(helpRequestId, email) {
  try {
    const { error } = await supabase
      .from("help_requests")
      .update({ customer_email: email })
      .eq("id", helpRequestId);

    if (error) {
      console.error(`[Agent] ❌ Error updating email:`, error);
    } else {
      console.log(
        `[Agent] ✅ Updated help request ${helpRequestId} with email`
      );
    }
  } catch (error) {
    console.error("[Agent] ❌ Error updating help request email:", error);
  }
}

async function getParticipantEmail(participantId) {
  try {
    const { data, error } = await supabase
      .from("help_requests")
      .select("customer_email")
      .eq("participant_id", participantId)
      .not("customer_email", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0].customer_email;
  } catch (error) {
    console.error("[Agent] ❌ Error getting participant email:", error);
    return null;
  }
}
