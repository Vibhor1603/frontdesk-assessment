import express from "express";
import { processQuery, storeQA } from "../services/knowledgeBase.js";
import { supabase } from "../db/supabase.js";

const router = express.Router();

// Get an answer from the knowledge base
router.post("/query", async (req, res) => {
  try {
    const { query, participantId, roomName } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const result = await processQuery(query, participantId, roomName);
    res.json(result);
  } catch (error) {
    console.error("Error querying knowledge base:", error);
    res.status(500).json({ error: "Failed to query knowledge base" });
  }
});

// Store a new QA pair
router.post("/store", async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res
        .status(400)
        .json({ error: "Question and answer are required" });
    }

    await storeQA(question, answer);
    res.json({ success: true });
  } catch (error) {
    console.error("Error storing QA:", error);
    res.status(500).json({ error: "Failed to store QA pair" });
  }
});

// List all help requests (for supervisor dashboard)
router.get("/help-requests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("help_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error listing help requests:", error);
    res.status(500).json({ error: "Failed to list help requests" });
  }
});

// Create a new help request (used by text fallback or frontend)
router.post("/help-requests", async (req, res) => {
  try {
    const { room_name, question, participant_id } = req.body;
    if (!question)
      return res.status(400).json({ error: "question is required" });

    const { error } = await supabase.from("help_requests").insert({
      room_name: room_name || "web",
      question,
      participant_id: participant_id || "web",
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Error creating help request:", error);
    res.status(500).json({ error: "Failed to create help request" });
  }
});

// Update help request status and store answer
router.post("/help-requests/:id/resolve", async (req, res) => {
  try {
    const { answer } = req.body;
    const { id } = req.params;

    if (!answer) {
      return res.status(400).json({ error: "Answer is required" });
    }

    // Get the help request to get the original question
    const { data: helpRequest, error: getError } = await supabase
      .from("help_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (getError) throw getError;

    // Store the QA pair with reference to the help request
    await storeQA(helpRequest.question, answer, id);

    // Update help request status
    const { error: updateError } = await supabase
      .from("help_requests")
      .update({ status: "resolved", answer })
      .eq("id", id);

    if (updateError) throw updateError;

    // Notify the original participant (simulated)
    try {
      const participantId = helpRequest.participant_id;
      console.log(
        `Notify participant ${participantId}: Supervisor answered your question: ${answer}`
      );
      // Optionally: call a webhook or push notification here
    } catch (notifyErr) {
      console.error("Error notifying participant:", notifyErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error resolving help request:", error);
    res.status(500).json({ error: "Failed to resolve help request" });
  }
});

export default router;
