import express from "express";
import { createToken } from "../auth/livekitAuth.js";
import { handleVoiceData } from "../services/voiceService.js";
import { generateVoice } from "../services/ttsService.js";
import { processQuery } from "../services/knowledgeBase.js";
import { supabase } from "../db/supabase.js";

const router = express.Router();

// Create/join a voice room
router.post("/room", async (req, res) => {
  try {
    const { roomName, participantName } = req.body;

    if (!roomName || !participantName) {
      return res
        .status(400)
        .json({ error: "Room name and participant name are required" });
    }

    const token = await createToken(roomName, participantName);
    res.json({ token });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Handle voice data
router.post("/voice", async (req, res) => {
  try {
    const { roomName, participantId, audioData } = req.body;

    if (!roomName || !participantId || !audioData) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const response = await handleVoiceData(roomName, participantId, audioData);
    res.json(response);
  } catch (error) {
    console.error("Error processing voice:", error);
    res.status(500).json({ error: "Failed to process voice data" });
  }
});

// Get help request status
router.get("/help-request/:roomName", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("help_requests")
      .select("*")
      .eq("room_name", req.params.roomName)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    res.json(data[0] || { status: "no_request" });
  } catch (error) {
    console.error("Error getting help request:", error);
    res.status(500).json({ error: "Failed to get help request status" });
  }
});

// TTS endpoint for frontend to request speech audio (returns base64 mp3)
router.post("/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    console.log(`Generating TTS for: "${text}"`);
    const buf = await generateVoice(text);
    // convert to base64
    const base64 = Buffer.from(buf).toString("base64");
    res.json({ audio: `data:audio/mpeg;base64,${base64}` });
  } catch (error) {
    console.error("Error generating tts:", error);
    res.status(500).json({ error: "Failed to generate tts" });
  }
});

// Test endpoint that combines knowledge base query with TTS
router.post("/ask", async (req, res) => {
  try {
    const { query, participantId, roomName } = req.body;
    if (!query) return res.status(400).json({ error: "query is required" });

    console.log(`Processing ask request: "${query}"`);

    // Get answer from knowledge base
    const result = await processQuery(query, participantId, roomName);

    let responseText = result.answer;
    if (result.outOfScope) {
      responseText = "Sorry, I can't answer that.";
    } else if (result.error) {
      responseText =
        "I'm experiencing some technical difficulties. Please try again in a moment.";
    }

    // Generate voice
    const audioBuffer = await generateVoice(responseText);
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    res.json({
      text: responseText,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      found: result.found,
      needsHelp: result.needsHelp,
      helpRequestId: result.helpRequestId,
    });
  } catch (error) {
    console.error("Error processing ask request:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

export default router;
