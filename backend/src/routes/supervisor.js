import express from "express";
import { supabase } from "../db/supabase.js";
import { sendAnswerEmail, isValidEmail } from "../services/emailService.js";

const router = express.Router();

// Store SSE clients
const sseClients = new Set();

// Notify all connected clients
function notifyClients(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(message);
    } catch (error) {
      sseClients.delete(client);
    }
  });
}

// SSE endpoint for real-time updates
router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  // Add client to set
  sseClients.add(res);

  // Remove client on disconnect
  req.on("close", () => {
    sseClients.delete(res);
  });
});

// Get all help requests with optional status filter
router.get("/help-requests", async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from("help_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error fetching help requests:", error);
    res.status(500).json({ error: "Failed to fetch help requests" });
  }
});

// Get a specific help request
router.get("/help-requests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("help_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: "Help request not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching help request:", error);
    res.status(500).json({ error: "Failed to fetch help request" });
  }
});

// Submit answer to a help request
router.post("/help-requests/:id/answer", async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    if (!answer || !answer.trim()) {
      return res.status(400).json({ error: "Answer is required" });
    }

    // Get the original request first
    const { data: originalRequest, error: fetchError } = await supabase
      .from("help_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;
    if (!originalRequest) {
      return res.status(404).json({ error: "Help request not found" });
    }

    console.log(`[Supervisor] Answering request ${id}`);

    // Send email if customer provided one
    let emailSent = false;
    let emailError = null;
    const emailSentAt = new Date().toISOString();

    if (
      originalRequest.customer_email &&
      isValidEmail(originalRequest.customer_email)
    ) {
      console.log(
        `[Supervisor] Sending email to ${originalRequest.customer_email}`
      );
      const emailResult = await sendAnswerEmail(
        originalRequest.customer_email,
        originalRequest.question,
        answer.trim()
      );

      if (emailResult.success) {
        emailSent = true;
        console.log(`[Supervisor] ✅ Email sent successfully`);
      } else {
        emailError = emailResult.error;
        console.error(`[Supervisor] ❌ Email failed:`, emailError);
      }
    } else {
      console.log(
        `[Supervisor] No valid email provided, skipping email notification`
      );
    }

    // Update the help request with answer and email status
    const { data: updatedRequest, error: updateError } = await supabase
      .from("help_requests")
      .update({
        answer: answer.trim(),
        status: "resolved",
        answered_at: emailSentAt,
        resolved_at: emailSentAt,
        email_sent: emailSent,
        email_sent_at: emailSent ? emailSentAt : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Add to knowledge base for AI learning (with embeddings)
    console.log(`[Supervisor] Adding Q&A to knowledge base with embeddings`);
    try {
      const { storeQA } = await import("../services/knowledgeBase.js");
      await storeQA(originalRequest.question, answer.trim(), id);
      console.log(`[Supervisor] ✅ Added to knowledge base with embeddings`);
    } catch (kbError) {
      console.error(
        `[Supervisor] ⚠️ Failed to add to knowledge base:`,
        kbError
      );
    }

    // Store in supervisor_responses table (matching actual schema)
    console.log(`[Supervisor] Storing supervisor response`);
    const { error: responseError } = await supabase
      .from("supervisor_responses")
      .insert({
        request_id: id,
        answer: answer.trim(),
      });

    if (responseError) {
      console.error(`[Supervisor] ⚠️ Failed to store response:`, responseError);
    } else {
      console.log(`[Supervisor] ✅ Stored supervisor response`);
    }

    // Notify all connected SSE clients
    notifyClients("request-answered", { id, status: "resolved" });

    // Return response with email status
    const response = {
      ...updatedRequest,
      emailSent,
      noEmail: !originalRequest.customer_email,
    };

    if (emailError) {
      response.emailError = emailError;
    }

    res.json(response);
  } catch (error) {
    console.error("[Supervisor] Error submitting answer:", error);
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

// Get learned answers (KB entries created from supervisor responses)
router.get("/learned-answers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .not("learned_from_request_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error fetching learned answers:", error);
    res.status(500).json({ error: "Failed to fetch learned answers" });
  }
});

// Get statistics
router.get("/stats", async (req, res) => {
  try {
    // Get counts by status
    const { data: requests, error: requestsError } = await supabase
      .from("help_requests")
      .select("status");

    if (requestsError) throw requestsError;

    const stats = {
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      resolved: requests.filter((r) => r.status === "resolved").length,
      timeout: requests.filter((r) => r.status === "timeout").length,
    };

    // Get learned answers count
    const { count: learnedCount, error: learnedError } = await supabase
      .from("knowledge_base")
      .select("*", { count: "exact", head: true })
      .not("learned_from_request_id", "is", null);

    if (learnedError) throw learnedError;

    stats.learnedAnswers = learnedCount || 0;

    res.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Mark request as timeout (for cleanup)
router.post("/help-requests/:id/timeout", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("help_requests")
      .update({
        status: "timeout",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Notify all connected SSE clients
    notifyClients("request-timeout", { id, status: "timeout" });

    res.json(data);
  } catch (error) {
    console.error("Error marking timeout:", error);
    res.status(500).json({ error: "Failed to mark as timeout" });
  }
});

// Function to notify clients about new help requests (called from webhooks)
export function notifyNewHelpRequest(request) {
  notifyClients("new-request", request);
}

export default router;
