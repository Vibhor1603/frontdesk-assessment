/**
 * Real-time Voice Agent using LiveKit
 * Pure Node.js implementation with proper audio streaming
 *
 * Architecture:
 * 1. Customer speaks in browser (Web Speech API or Deepgram)
 * 2. Frontend sends transcribed text via data channel
 * 3. Agent processes through KB + LLM
 * 4. Agent generates TTS audio
 * 5. Agent sends audio back via data channel
 * 6. Frontend plays audio
 *
 * This is the proper way to do LiveKit agents in Node.js without Python
 */

import { RoomServiceClient } from "livekit-server-sdk";
import { processQuery, storeQA } from "./knowledgeBase.js";
import { generateVoice } from "./ttsService.js";
import { groqChat } from "./groqService.js";
import { supabase } from "../db/supabase.js";
import dotenv from "dotenv";

dotenv.config();

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

class RealtimeVoiceAgent {
  constructor(roomName) {
    this.roomName = roomName;
    this.isActive = false;
    this.conversationHistory = new Map(); // participantId -> messages[]
    this.pendingHelpRequests = new Map();
    this.activeParticipants = new Set();
    this.processingQueue = new Map(); // participantId -> queue
  }

  async start() {
    try {
      console.log(
        `\n[Agent] 🚀 Starting real-time voice agent for room: ${this.roomName}`
      );

      // Ensure room exists
      try {
        await roomService.createRoom({
          name: this.roomName,
          emptyTimeout: 0, // Never delete room when empty
          maxParticipants: 50,
        });
        console.log(`[Agent] ✅ Room created: ${this.roomName}`);
      } catch (error) {
        if (error.message?.includes("already exists")) {
          console.log(`[Agent] ✅ Room already exists: ${this.roomName}`);
        } else {
          console.error(`[Agent] ❌ Error creating room:`, error);
          throw error;
        }
      }

      this.isActive = true;
      console.log(`[Agent] ✅ Agent is active and ready`);

      // Start supervisor polling
      this.startSupervisorPolling();

      return true;
    } catch (error) {
      console.error("[Agent] ❌ Failed to start:", error);
      return false;
    }
  }

  async handleParticipantJoined(participantId, participantName) {
    console.log(`\n[Agent] 👤 Participant joined: ${participantId}`);

    if (
      participantId.startsWith("customer-") ||
      participantName?.startsWith("customer-")
    ) {
      console.log(`[Agent] ✅ Identified as customer`);
      this.activeParticipants.add(participantId);

      // Initialize conversation history
      if (!this.conversationHistory.has(participantId)) {
        this.conversationHistory.set(participantId, [
          {
            role: "system",
            content:
              "You are a friendly and professional AI receptionist for Luxe Salon and Spa. " +
              "Help customers with questions about services, hours, pricing, and appointments. " +
              "Be warm, welcoming, and concise. Keep responses natural and conversational.",
          },
        ]);
      }

      // Initialize processing queue
      if (!this.processingQueue.has(participantId)) {
        this.processingQueue.set(participantId, []);
      }

      // Greet the customer
      console.log(`[Agent] 👋 Greeting customer...`);
      await this.greetCustomer(participantId);
    } else {
      console.log(`[Agent] ⏭️  Skipping non-customer participant`);
    }
  }

  async handleParticipantLeft(participantId) {
    console.log(`\n[Agent] 👋 Participant left: ${participantId}`);
    this.activeParticipants.delete(participantId);
    // Keep conversation history for potential reconnection
  }

  async getGreeting(participantId, participantName) {
    console.log(`\n[Agent] 👋 Generating greeting for ${participantId}`);

    // Track participant
    this.activeParticipants.add(participantId);

    // Initialize conversation history
    if (!this.conversationHistory.has(participantId)) {
      this.conversationHistory.set(participantId, [
        {
          role: "system",
          content:
            "You are a friendly and professional AI receptionist for Luxe Salon and Spa. " +
            "Help customers with questions about services, hours, pricing, and appointments. " +
            "Be warm, welcoming, and concise. Keep responses natural and conversational.",
        },
      ]);
    }

    // Initialize processing queue
    if (!this.processingQueue.has(participantId)) {
      this.processingQueue.set(participantId, []);
    }

    const greeting =
      "Hi! Welcome to Luxe Salon and Spa. How can I help you today?";

    // Generate audio
    const audioBuffer = await generateVoice(greeting);
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    console.log(`[Agent] ✅ Greeting generated`);

    return {
      type: "agent_response",
      text: greeting,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      timestamp: new Date().toISOString(),
    };
  }

  async handleCustomerMessage(text, participantId) {
    try {
      console.log(`\n[Agent] 📝 Processing message from ${participantId}`);
      console.log(`[Agent] 💬 Message: "${text}"`);

      // Get conversation history
      const history = this.conversationHistory.get(participantId) || [];

      // Add user message to history
      history.push({
        role: "user",
        content: text,
      });

      console.log(`[Agent] 🔍 Searching knowledge base...`);

      // Search knowledge base
      const kbResult = await processQuery(text, participantId, this.roomName);

      console.log(`[Agent] 📊 KB Result:`, {
        found: kbResult.found,
        needsHelp: kbResult.needsHelp,
        outOfScope: kbResult.outOfScope,
      });

      let responseText;

      if (kbResult.needsHelp) {
        // Escalate to supervisor
        console.log(`[Agent] 🆘 Escalating to supervisor`);
        responseText = kbResult.answer;

        if (kbResult.helpRequestId) {
          this.pendingHelpRequests.set(kbResult.helpRequestId, {
            question: text,
            participantId,
            timestamp: new Date().toISOString(),
          });
          console.log(
            `[Agent] ✅ Help request created: ${kbResult.helpRequestId}`
          );
        }
      } else if (kbResult.found) {
        // Use KB answer with LLM to make it conversational
        console.log(`[Agent] 🤖 Generating conversational response...`);

        const prompt = `Based on this information from our knowledge base, provide a natural, conversational response to the customer.

Knowledge Base Answer: ${kbResult.answer}

Customer Question: ${text}

Provide a friendly, concise response (2-3 sentences max). Don't mention "knowledge base" or "according to". Just answer naturally as if you know this information.`;

        try {
          responseText = await groqChat(prompt);
          console.log(`[Agent] ✅ Generated conversational response`);
        } catch (error) {
          console.error(
            `[Agent] ⚠️  LLM error, using KB answer directly:`,
            error
          );
          responseText = kbResult.answer;
        }
      } else {
        // Fallback
        responseText =
          "I'm not sure about that. Let me check with my supervisor and get back to you shortly.";
      }

      // Add assistant response to history
      history.push({
        role: "assistant",
        content: responseText,
      });

      // Keep history manageable (last 10 messages)
      if (history.length > 11) {
        // Keep system message + last 10
        this.conversationHistory.set(participantId, [
          history[0],
          ...history.slice(-10),
        ]);
      }

      // Speak the response
      console.log(`[Agent] 🗣️  Generating speech...`);
      await this.speak(responseText, participantId);
      console.log(`[Agent] ✅ Response sent\n`);
    } catch (error) {
      console.error("[Agent] ❌ Error handling message:", error);
      await this.speak(
        "I'm experiencing some technical difficulties. Please try again in a moment.",
        participantId
      );
    }
  }

  async speak(text, targetParticipantId = null) {
    try {
      console.log(
        `[Agent] 🔊 Speaking to ${
          targetParticipantId || "all"
        }: "${text.substring(0, 50)}..."`
      );

      // Generate audio using TTS
      const audioBuffer = await generateVoice(text);
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      // Create message
      const message = {
        type: "agent_response",
        text: text,
        audio: `data:audio/mpeg;base64,${audioBase64}`,
        timestamp: new Date().toISOString(),
      };

      // Send via LiveKit data message
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));

      // TEMPORARY: Broadcast to ALL participants to test
      // This helps debug participant ID mismatch issues
      console.log(
        `[Agent] 📤 Broadcasting message to all participants in room`
      );

      await roomService.sendData(this.roomName, data, {
        // No destinationIdentities = broadcast to everyone
      });

      console.log(`[Agent] ✅ Audio sent successfully (broadcast mode)`);
    } catch (error) {
      console.error("[Agent] ❌ Error speaking:", error);
      throw error;
    }
  }

  startSupervisorPolling() {
    console.log(`[Agent] 🔄 Starting supervisor polling (every 5 seconds)`);

    this.pollingInterval = setInterval(async () => {
      if (this.pendingHelpRequests.size === 0) return;

      try {
        for (const [
          requestId,
          requestData,
        ] of this.pendingHelpRequests.entries()) {
          const { data, error } = await supabase
            .from("help_requests")
            .select("*")
            .eq("id", requestId)
            .single();

          if (error) {
            console.error(
              `[Agent] ❌ Error checking request ${requestId}:`,
              error
            );
            continue;
          }

          if (data.status === "answered" && data.answer) {
            console.log(
              `\n[Agent] 📬 Supervisor answered request ${requestId}`
            );
            await this.handleSupervisorResponse(requestId, data);
          } else if (data.status === "timeout") {
            console.log(`[Agent] ⏱️  Request ${requestId} timed out`);
            this.pendingHelpRequests.delete(requestId);
          }
        }
      } catch (error) {
        console.error("[Agent] ❌ Error in supervisor polling:", error);
      }
    }, 5000);
  }

  async handleSupervisorResponse(requestId, requestData) {
    try {
      const { question, answer } = requestData;
      const requestInfo = this.pendingHelpRequests.get(requestId);

      if (!requestInfo) {
        console.log(
          `[Agent] ⚠️  Request ${requestId} not found in pending map`
        );
        return;
      }

      const { participantId } = requestInfo;

      // Generate follow-up message
      const followUpMessage = `Great news! I heard back from my supervisor about your question. ${answer}`;

      // Speak to the customer
      await this.speak(followUpMessage, participantId);

      // Add to knowledge base
      await storeQA(question, answer, requestId);

      // Mark as resolved
      await supabase
        .from("help_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      // Remove from pending
      this.pendingHelpRequests.delete(requestId);

      console.log(
        `[Agent] ✅ Successfully handled supervisor response for ${requestId}\n`
      );
    } catch (error) {
      console.error("[Agent] ❌ Error handling supervisor response:", error);
    }
  }

  async stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.isActive = false;
    console.log("[Agent] 🛑 Agent stopped");
  }

  getStatus() {
    return {
      active: this.isActive,
      roomName: this.roomName,
      participantCount: this.activeParticipants.size,
      pendingRequests: this.pendingHelpRequests.size,
      conversationCount: this.conversationHistory.size,
    };
  }
}

// Singleton instance
let agentInstance = null;

export async function startRealtimeAgent(roomName = "customer-service") {
  if (agentInstance && agentInstance.isActive) {
    console.log("[Agent] ⚠️  Agent already running");
    return agentInstance;
  }

  agentInstance = new RealtimeVoiceAgent(roomName);
  await agentInstance.start();
  return agentInstance;
}

export function getRealtimeAgent() {
  return agentInstance;
}

export async function stopRealtimeAgent() {
  if (agentInstance) {
    await agentInstance.stop();
    agentInstance = null;
  }
}
