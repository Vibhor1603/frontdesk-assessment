import express from "express";
import { supabase } from "../../../core/db/supabase.js";
import { sendAnswerEmail, isValidEmail } from "../services/emailService.js";

const router = express.Router();

// SSE functionality removed - not used by current admin dashboard
// The dashboard uses polling instead of SSE for real-time updates

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

// GET /help-requests/:id removed - not used by current admin dashboard

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
    } // Send email if customer provided one
    let emailSent = false;
    let emailError = null;
    const emailSentAt = new Date().toISOString();

    if (
      originalRequest.customer_email &&
      isValidEmail(originalRequest.customer_email)
    ) {
      const emailResult = await sendAnswerEmail(
        originalRequest.customer_email,
        originalRequest.question,
        answer.trim()
      );

      if (emailResult.success) {
        emailSent = true;
      } else {
        emailError = emailResult.error;
        console.error(`[Supervisor] ❌ Email failed:`, emailError);
      }
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
    try {
      const { storeQA } = await import(
        "../../knowledge/services/knowledgeBase.js"
      );
      await storeQA(originalRequest.question, answer.trim(), id);
    } catch (kbError) {
      console.error(
        `[Supervisor] ⚠️ Failed to add to knowledge base:`,
        kbError
      );
    }

    // Store in supervisor_responses table (matching actual schema)
    const { error: responseError } = await supabase
      .from("supervisor_responses")
      .insert({
        request_id: id,
        answer: answer.trim(),
      });

    if (responseError) {
      console.error(`[Supervisor] ⚠️ Failed to store response:`, responseError);
    }

    // SSE notification removed - not used

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

// POST /help-requests/:id/timeout removed - not used by current admin dashboard
// Timeout handling is done via periodic job in index.js

export default router;
