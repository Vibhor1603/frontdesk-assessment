import { RoomServiceClient } from "livekit-server-sdk";
import { processQuery, storeQA } from "./knowledgeBase.js";
import { generateVoice } from "./ttsService.js";
import { supabase } from "../db/supabase.js";
import dotenv from "dotenv";

dotenv.config();

// Initialize room service client
const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

class LiveKitAgent {
  constructor(roomName) {
    this.roomName = roomName;
    this.isConnected = false;
    this.conversationHistory = new Map(); // participantId -> history
    this.pendingHelpRequests = new Map();
    this.activeParticipants = new Set();
  }

  async connect() {
    try {
      console.log(`[Agent] Initializing for room: ${this.roomName}`);

      // Ensure room exists
      try {
        await roomService.createRoom({
          name: this.roomName,
          emptyTimeout: 300,
          maxParticipants: 50,
        });
        console.log(`[Agent] Room created: ${this.roomName}`);
      } catch (error) {
        if (error.message?.includes("already exists")) {
          console.log(`[Agent] Room already exists: ${this.roomName}`);
        } else {
          throw error;
        }
      }

      this.isConnected = true;
      console.log(
        `[Agent] Ready to handle customers in room: ${this.roomName}`
      );

      // Start polling for supervisor responses
      this.startSupervisorPolling();

      return true;
    } catch (error) {
      console.error("[Agent] Connection error:", error);
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
        this.conversationHistory.set(participantId, []);
      }

      // Greet the customer
      console.log(`[Agent] 👋 Greeting customer...`);
      await this.greetCustomer(participantId);
    } else {
      console.log(`[Agent] ⏭️ Skipping non-customer participant`);
    }
  }

  async handleParticipantLeft(participantId) {
    console.log(`[Agent] Participant left: ${participantId}`);
    this.activeParticipants.delete(participantId);
  }

  async greetCustomer(participantId) {
    const greeting =
      "Hi! Welcome to Luxe Salon and Spa. How can I help you today?";
    await this.speak(greeting, participantId);
  }

  async handleCustomerInput(text, participantId) {
    try {
      console.log(`\n[Agent] 📝 Processing input from ${participantId}`);
      console.log(`[Agent] 💬 Question: "${text}"`);

      // Get or create conversation history
      if (!this.conversationHistory.has(participantId)) {
        this.conversationHistory.set(participantId, []);
      }
      const history = this.conversationHistory.get(participantId);

      // Add to conversation history
      history.push({
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      });

      console.log(`[Agent] 🔍 Searching knowledge base...`);

      // Process query through knowledge base
      const result = await processQuery(text, participantId, this.roomName);

      console.log(`[Agent] 📊 KB Result:`, {
        found: result.found,
        needsHelp: result.needsHelp,
        outOfScope: result.outOfScope,
        answerLength: result.answer?.length || 0,
      });

      let responseText = result.answer;

      if (result.needsHelp) {
        console.log(`[Agent] 🆘 Escalating to supervisor`);
        // Store the help request ID for polling
        if (result.helpRequestId) {
          this.pendingHelpRequests.set(result.helpRequestId, {
            question: text,
            participantId,
            timestamp: new Date().toISOString(),
          });
          console.log(
            `[Agent] ✅ Help request created: ${result.helpRequestId}`
          );
        }
      } else {
        console.log(`[Agent] ✅ Answering from knowledge base`);
      }

      // Add to conversation history
      history.push({
        role: "assistant",
        content: responseText,
        timestamp: new Date().toISOString(),
      });

      // Speak the response
      console.log(`[Agent] 🗣️ Generating response...`);
      await this.speak(responseText, participantId);
      console.log(`[Agent] ✅ Response sent\n`);
    } catch (error) {
      console.error("[Agent] ❌ Error handling input:", error);
      await this.speak(
        "I'm experiencing some technical difficulties. Please try again in a moment.",
        participantId
      );
    }
  }

  async speak(text, targetParticipantId = null) {
    try {
      console.log(
        `[Agent] Speaking to ${targetParticipantId || "all"}: "${text}"`
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

      // Send to specific participant or broadcast
      const destinationSids = targetParticipantId ? [targetParticipantId] : [];

      await roomService.sendData(this.roomName, data, {
        destinationIdentities:
          destinationSids.length > 0 ? destinationSids : undefined,
      });

      console.log(`[Agent] Sent audio response`);
    } catch (error) {
      console.error("[Agent] Error speaking:", error);
    }
  }

  startSupervisorPolling() {
    // Poll every 5 seconds for supervisor responses
    this.pollingInterval = setInterval(async () => {
      if (this.pendingHelpRequests.size === 0) return;

      try {
        // Check all pending requests
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
              `[Agent] Error checking request ${requestId}:`,
              error
            );
            continue;
          }

          if (data.status === "answered" && data.answer) {
            console.log(`[Agent] Supervisor answered request ${requestId}`);
            await this.handleSupervisorResponse(requestId, data);
          } else if (data.status === "timeout") {
            console.log(`[Agent] Request ${requestId} timed out`);
            this.pendingHelpRequests.delete(requestId);
          }
        }
      } catch (error) {
        console.error("[Agent] Error in supervisor polling:", error);
      }
    }, 5000);
  }

  async handleSupervisorResponse(requestId, requestData) {
    try {
      const { question, answer } = requestData;
      const requestInfo = this.pendingHelpRequests.get(requestId);

      if (!requestInfo) {
        console.log(`[Agent] Request ${requestId} not found in pending map`);
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
        `[Agent] Successfully handled supervisor response for ${requestId}`
      );
    } catch (error) {
      console.error("[Agent] Error handling supervisor response:", error);
    }
  }

  async disconnect() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.isConnected = false;
    console.log("[Agent] Disconnected");
  }

  getStatus() {
    return {
      connected: this.isConnected,
      roomName: this.roomName,
      participantCount: this.activeParticipants.size,
      pendingRequests: this.pendingHelpRequests.size,
      conversationLength: Array.from(this.conversationHistory.values()).reduce(
        (sum, history) => sum + history.length,
        0
      ),
    };
  }
}

// Singleton instance for the customer service room
let agentInstance = null;

export async function startAgent(roomName = "customer-service") {
  if (agentInstance && agentInstance.isConnected) {
    console.log("[Agent] Agent already running");
    return agentInstance;
  }

  agentInstance = new LiveKitAgent(roomName);
  await agentInstance.connect();
  return agentInstance;
}

export function getAgent() {
  return agentInstance;
}

export async function stopAgent() {
  if (agentInstance) {
    await agentInstance.disconnect();
    agentInstance = null;
  }
}

// Export handler for webhook events
export async function handleWebhookEvent(event) {
  if (!agentInstance) return;

  switch (event.event) {
    case "participant_joined":
      await agentInstance.handleParticipantJoined(
        event.participant.identity,
        event.participant.name
      );
      break;
    case "participant_left":
      await agentInstance.handleParticipantLeft(event.participant.identity);
      break;
  }
}
