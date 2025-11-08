/**
 * LiveKit Audio Streaming Agent with RAG/KB
 * Features:
 * - Multi-question handling
 * - Email collection for help requests
 * - Webhook-based resolution (no polling)
 * - Email notifications
 */

import { RoomServiceClient } from "livekit-server-sdk";
import { processQuery, storeQA } from "./knowledgeBase.js";
import { generateVoice } from "./ttsService.js";
import { groqChat } from "./groqService.js";
import { supabase } from "../db/supabase.js";
import { sendAnswerEmail, isValidEmail } from "./emailService.js";
import dotenv from "dotenv";

dotenv.config();

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

class LiveKitAudioAgent {
  constructor(roomName) {
    this.roomName = roomName;
    this.isActive = false;
    this.conversationHistory = new Map();
    this.pendingHelpRequests = new Map(); // helpRequestId -> {participantId, question}
    this.activeParticipants = new Set();
    this.participantEmails = new Map(); // participantId -> email
    this.awaitingEmail = new Map(); // participantId -> helpRequestId
  }

  async start() {
    try {
      console.log(`\n[AudioAgent] 🚀 Starting for room: ${this.roomName}`);

      // Ensure room exists
      try {
        await roomService.createRoom({
          name: this.roomName,
          emptyTimeout: 0,
          maxParticipants: 50,
        });
        console.log(`[AudioAgent] ✅ Room created`);
      } catch (error) {
        if (error.message?.includes("already exists")) {
          console.log(`[AudioAgent] ✅ Room exists`);
        } else {
          throw error;
        }
      }

      this.isActive = true;
      console.log(`[AudioAgent] ✅ Ready for real-time audio streaming`);
      return true;
    } catch (error) {
      console.error("[AudioAgent] ❌ Failed to start:", error);
      return false;
    }
  }

  async handleParticipantJoined(participantId, participantName) {
    console.log(`\n[AudioAgent] 👤 Participant joined: ${participantId}`);

    if (
      participantId.startsWith("customer-") ||
      participantName?.startsWith("customer-")
    ) {
      console.log(`[AudioAgent] ✅ Customer identified`);
      this.activeParticipants.add(participantId);

      // Initialize conversation
      if (!this.conversationHistory.has(participantId)) {
        this.conversationHistory.set(participantId, [
          {
            role: "system",
            content:
              "You are a friendly AI receptionist for Luxe Salon and Spa. " +
              "Help customers with services, hours, pricing, and appointments. " +
              "Be warm, welcoming, and concise.",
          },
        ]);
      }

      // Load existing email if available
      const existingEmail = await this.getParticipantEmail(participantId);
      if (existingEmail) {
        this.participantEmails.set(participantId, existingEmail);
        console.log(
          `[AudioAgent] 📧 Loaded existing email for ${participantId}: ${existingEmail}`
        );
      }

      // Send greeting
      await this.greetCustomer(participantId);
    }
  }

  async greetCustomer(participantId) {
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

  async handleCustomerMessage(text, participantId) {
    try {
      console.log(`\n[AudioAgent] 📝 Processing: "${text}"`);
      console.log(`[AudioAgent] 🔍 Participant: ${participantId}`);
      console.log(
        `[AudioAgent] 📧 Awaiting email: ${this.awaitingEmail.has(
          participantId
        )}`
      );
      console.log(
        `[AudioAgent] 📧 Has stored email: ${this.participantEmails.has(
          participantId
        )}`
      );

      // Check if we're awaiting email from this participant
      if (this.awaitingEmail.has(participantId)) {
        console.log(
          `[AudioAgent] 📧 Expecting email response from ${participantId}`
        );
        return await this.handleEmailResponse(text, participantId);
      }

      // Check if this looks like an email (even if not awaiting)
      // This handles cases where the flag wasn't set properly
      const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      if (emailMatch && text.length < 100) {
        // Check if the text is primarily an email (not a sentence with an email in it)
        const emailText = emailMatch[0];
        const textWithoutEmail = text.replace(emailText, "").trim();

        // If the remaining text is very short or empty, treat as email
        if (textWithoutEmail.length < 10) {
          console.log(`[AudioAgent] 📧 Detected email pattern: ${emailText}`);
          // Check if we have a recent help request for this participant
          const recentHelpRequest = await this.findRecentHelpRequest(
            participantId
          );
          if (recentHelpRequest) {
            console.log(
              `[AudioAgent] 📧 Found recent help request, treating as email`
            );
            this.awaitingEmail.set(participantId, recentHelpRequest.id);
            return await this.handleEmailResponse(text, participantId);
          }
        }
      }

      // Get conversation history
      const history = this.conversationHistory.get(participantId) || [];

      // Add user message
      history.push({
        role: "user",
        content: text,
      });

      console.log(`[AudioAgent] 🔍 Searching knowledge base...`);

      // Search knowledge base (handles multiple questions intelligently)
      const kbResult = await processQuery(text, participantId, this.roomName);

      console.log(`[AudioAgent] 📊 KB Result:`, {
        found: kbResult.found,
        needsHelp: kbResult.needsHelp,
        outOfScope: kbResult.outOfScope,
      });

      let responseText;

      if (kbResult.needsHelp) {
        // Escalate to supervisor
        console.log(`[AudioAgent] 🆘 Escalating to supervisor`);

        // Check if customer has provided email (check database too)
        let hasEmail = this.participantEmails.has(participantId);
        let email = this.participantEmails.get(participantId);

        // If not in memory, check database
        if (!hasEmail && kbResult.helpRequestId) {
          const existingEmail = await this.getParticipantEmail(participantId);
          if (existingEmail) {
            hasEmail = true;
            email = existingEmail;
            this.participantEmails.set(participantId, existingEmail);
            console.log(
              `[AudioAgent] 📧 Found existing email in DB: ${existingEmail}`
            );
          }
        }

        if (!hasEmail) {
          // First time escalation - ask for email
          console.log(`[AudioAgent] 📧 Requesting email from customer`);

          // Store help request ID for this participant
          if (kbResult.helpRequestId) {
            this.awaitingEmail.set(participantId, kbResult.helpRequestId);
            this.pendingHelpRequests.set(kbResult.helpRequestId, {
              participantId,
              question: text,
            });
            console.log(
              `[AudioAgent] ✅ Set awaitingEmail flag for ${participantId}`
            );
          }

          responseText = `${kbResult.answer} To make sure you get the answer, could you please provide your email address? I'll send you the information as soon as I hear back from my supervisor.`;
        } else {
          // Has email - just acknowledge
          responseText = `${kbResult.answer} I'll email you at ${email} as soon as I get the answer.`;

          if (kbResult.helpRequestId) {
            // Update help request with email
            await this.updateHelpRequestEmail(kbResult.helpRequestId, email);
            this.pendingHelpRequests.set(kbResult.helpRequestId, {
              participantId,
              question: text,
            });
          }
        }
      } else if (kbResult.found) {
        // Use KB answer (already enhanced for multiple questions)
        console.log(`[AudioAgent] ✅ Using KB answer`);
        responseText = kbResult.answer;
      } else {
        responseText =
          "I'm not sure about that. Let me check with my supervisor and get back to you shortly.";
      }

      // Add to history
      history.push({
        role: "assistant",
        content: responseText,
      });

      // Keep history manageable
      if (history.length > 11) {
        this.conversationHistory.set(participantId, [
          history[0],
          ...history.slice(-10),
        ]);
      }

      // Generate audio response
      console.log(`[AudioAgent] 🗣️ Generating speech...`);
      const audioBuffer = await generateVoice(responseText);
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      console.log(`[AudioAgent] ✅ Response ready\n`);

      return {
        type: "agent_response",
        text: responseText,
        audio: `data:audio/mpeg;base64,${audioBase64}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[AudioAgent] ❌ Error:", error);

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

  async findRecentHelpRequest(participantId) {
    try {
      console.log(
        `[AudioAgent] 🔍 Looking for recent help request for ${participantId}`
      );

      const { data, error } = await supabase
        .from("help_requests")
        .select("*")
        .eq("participant_id", participantId)
        .is("customer_email", null)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("[AudioAgent] ❌ Database error:", error);
        return null;
      }

      if (!data || data.length === 0) {
        console.log("[AudioAgent] ⚠️ No recent help request found");
        return null;
      }

      console.log(`[AudioAgent] ✅ Found help request: ${data[0].id}`);
      return data[0];
    } catch (error) {
      console.error(
        "[AudioAgent] ❌ Error finding recent help request:",
        error
      );
      return null;
    }
  }

  async getParticipantEmail(participantId) {
    try {
      const { data, error } = await supabase
        .from("help_requests")
        .select("customer_email")
        .eq("participant_id", participantId)
        .not("customer_email", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("[AudioAgent] ❌ Database error:", error);
        return null;
      }

      if (!data || data.length === 0 || !data[0].customer_email) {
        return null;
      }

      return data[0].customer_email;
    } catch (error) {
      console.error("[AudioAgent] ❌ Error getting participant email:", error);
      return null;
    }
  }

  async handleEmailResponse(text, participantId) {
    try {
      console.log(`[AudioAgent] 📧 Processing email response: "${text}"`);

      // Extract email from text (handle various formats)
      const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      const email = emailMatch
        ? emailMatch[0].toLowerCase().trim()
        : text.toLowerCase().trim();

      if (!isValidEmail(email)) {
        console.log(`[AudioAgent] ❌ Invalid email format: ${email}`);

        const responseText =
          "That doesn't look like a valid email address. Could you please provide it again? For example: yourname@example.com";

        const audioBuffer = await generateVoice(responseText);
        const audioBase64 = Buffer.from(audioBuffer).toString("base64");

        // Keep the awaitingEmail flag - don't remove it
        return {
          type: "agent_response",
          text: responseText,
          audio: `data:audio/mpeg;base64,${audioBase64}`,
          timestamp: new Date().toISOString(),
        };
      }

      // Valid email - store it
      console.log(`[AudioAgent] ✅ Valid email: ${email}`);
      this.participantEmails.set(participantId, email);

      // Update help request with email
      const helpRequestId = this.awaitingEmail.get(participantId);
      if (helpRequestId) {
        await this.updateHelpRequestEmail(helpRequestId, email);
        this.pendingHelpRequests.set(helpRequestId, {
          participantId,
          question: "pending",
        });
        this.awaitingEmail.delete(participantId);
        console.log(
          `[AudioAgent] ✅ Email stored for help request ${helpRequestId}`
        );
      } else {
        // No specific help request, but store email for future use
        console.log(`[AudioAgent] ✅ Email stored for future use`);
        // Try to find and update any recent pending help request
        const recentRequest = await this.findRecentHelpRequest(participantId);
        if (recentRequest) {
          await this.updateHelpRequestEmail(recentRequest.id, email);
          console.log(
            `[AudioAgent] ✅ Updated recent help request ${recentRequest.id}`
          );
        }
      }

      const responseText = `Perfect! I've got your email as ${email}. I'll send you the answer there as soon as I hear back from my supervisor. Is there anything else I can help you with?`;

      const audioBuffer = await generateVoice(responseText);
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      return {
        type: "agent_response",
        text: responseText,
        audio: `data:audio/mpeg;base64,${audioBase64}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[AudioAgent] ❌ Error handling email:", error);

      const errorText =
        "Sorry, I had trouble processing that. Could you provide your email again?";
      const errorAudio = await generateVoice(errorText);
      const errorBase64 = Buffer.from(errorAudio).toString("base64");

      return {
        type: "agent_response",
        text: errorText,
        audio: `data:audio/mpeg;base64,${errorBase64}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateHelpRequestEmail(helpRequestId, email) {
    try {
      const { error } = await supabase
        .from("help_requests")
        .update({ customer_email: email })
        .eq("id", helpRequestId);

      if (error) {
        console.error(`[AudioAgent] ❌ Error updating email:`, error);
      } else {
        console.log(
          `[AudioAgent] ✅ Updated help request ${helpRequestId} with email`
        );
      }
    } catch (error) {
      console.error(
        "[AudioAgent] ❌ Error updating help request email:",
        error
      );
    }
  }

  /**
   * Handle supervisor answer via webhook (replaces polling)
   */
  async handleSupervisorAnswer(requestId, requestData) {
    try {
      console.log(`\n[AudioAgent] 📬 Supervisor answered request ${requestId}`);

      const { question, answer, customer_email } = requestData;
      const requestInfo = this.pendingHelpRequests.get(requestId);

      // Send email if customer provided one
      if (customer_email) {
        console.log(`[AudioAgent] 📧 Sending email to ${customer_email}`);
        const emailResult = await sendAnswerEmail(
          customer_email,
          question,
          answer
        );

        if (emailResult.success) {
          console.log(`[AudioAgent] ✅ Email sent successfully`);

          // Mark email as sent
          await supabase
            .from("help_requests")
            .update({
              email_sent: true,
              email_sent_at: new Date().toISOString(),
            })
            .eq("id", requestId);
        } else {
          console.error(`[AudioAgent] ❌ Email failed:`, emailResult.error);
        }
      }

      // If customer is still in the room, send them a message
      if (
        requestInfo &&
        this.activeParticipants.has(requestInfo.participantId)
      ) {
        console.log(
          `[AudioAgent] 💬 Customer still in room, sending follow-up`
        );

        const followUpMessage = `Great news! I heard back from my supervisor about your question. ${answer}`;

        // Generate audio
        const audioBuffer = await generateVoice(followUpMessage);
        const audioBase64 = Buffer.from(audioBuffer).toString("base64");

        // Send via data channel
        const message = {
          type: "agent_response",
          text: followUpMessage,
          audio: `data:audio/mpeg;base64,${audioBase64}`,
          timestamp: new Date().toISOString(),
        };

        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(message));

        await roomService.sendData(this.roomName, data, {});
      }

      // Store in knowledge base
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

      console.log(`[AudioAgent] ✅ Successfully handled supervisor answer\n`);
    } catch (error) {
      console.error("[AudioAgent] ❌ Error handling supervisor answer:", error);
    }
  }

  async stop() {
    this.isActive = false;
    console.log("[AudioAgent] 🛑 Stopped");
  }

  getStatus() {
    return {
      active: this.isActive,
      roomName: this.roomName,
      participantCount: this.activeParticipants.size,
      pendingRequests: this.pendingHelpRequests.size,
      conversationCount: this.conversationHistory.size,
      emailsCollected: this.participantEmails.size,
    };
  }
}

// Singleton
let agentInstance = null;

export async function startAudioAgent(roomName = "customer-service") {
  if (agentInstance && agentInstance.isActive) {
    console.log("[AudioAgent] ⚠️ Already running");
    return agentInstance;
  }

  agentInstance = new LiveKitAudioAgent(roomName);
  await agentInstance.start();
  return agentInstance;
}

export function getAudioAgent() {
  return agentInstance;
}

export async function stopAudioAgent() {
  if (agentInstance) {
    await agentInstance.stop();
    agentInstance = null;
  }
}
