import { supabase } from "../../db/supabase.js";
import { sendAnswerEmail, isValidEmail } from "../../services/emailService.js";
import { generateEmbedding } from "../../services/embeddingService.js";

export async function getHelpRequests(req, res) {
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
    res.status(500).json({ error: "Failed to fetch help requests" });
  }
}

export async function submitAnswer(req, res) {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    if (!answer || !answer.trim()) {
      return res.status(400).json({ error: "Answer is required" });
    }

    const { data: originalRequest, error: fetchError } = await supabase
      .from("help_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;
    if (!originalRequest) {
      return res.status(404).json({ error: "Help request not found" });
    }

    let emailSent = false;
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
      }
    }

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

    try {
      const { storeQA } = await import("../../services/knowledgeBase.js");
      await storeQA(originalRequest.question, answer.trim(), id);
    } catch (kbError) {
      console.error(
        "[Supervisor] ⚠️ Failed to add to knowledge base:",
        kbError
      );
    }

    const { error: responseError } = await supabase
      .from("supervisor_responses")
      .insert({
        request_id: id,
        answer: answer.trim(),
      });

    const response = {
      ...updatedRequest,
      emailSent,
      noEmail: !originalRequest.customer_email,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit answer" });
  }
}

export async function getLearnedAnswers(req, res) {
  try {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .not("learned_from_request_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch learned answers" });
  }
}

export async function getStats(req, res) {
  try {
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

    const { count: learnedCount, error: learnedError } = await supabase
      .from("knowledge_base")
      .select("*", { count: "exact", head: true })
      .not("learned_from_request_id", "is", null);

    if (learnedError) throw learnedError;

    stats.learnedAnswers = learnedCount || 0;

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
}

export async function getKnowledgeBase(req, res) {
  try {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch knowledge base" });
  }
}

export async function createKnowledgeBaseItem(req, res) {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res
        .status(400)
        .json({ error: "Question and answer are required" });
    }

    if (question.trim().length < 3 || answer.trim().length < 3) {
      return res
        .status(400)
        .json({ error: "Question and answer must be at least 3 characters" });
    }

    const embedding = await generateEmbedding(question.trim());

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 1536) {
      throw new Error("Invalid embedding generated");
    }

    const { data, error } = await supabase
      .from("knowledge_base")
      .insert({
        question: question.trim(),
        answer: answer.trim(),
        embedding,
        times_used: 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "Failed to create knowledge base item" });
  }
}

export async function updateKnowledgeBaseItem(req, res) {
  try {
    const { id } = req.params;
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res
        .status(400)
        .json({ error: "Question and answer are required" });
    }

    if (question.trim().length < 3 || answer.trim().length < 3) {
      return res
        .status(400)
        .json({ error: "Question and answer must be at least 3 characters" });
    }

    const embedding = await generateEmbedding(question.trim());

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 1536) {
      throw new Error("Invalid embedding generated");
    }

    const { data, error } = await supabase
      .from("knowledge_base")
      .update({
        question: question.trim(),
        answer: answer.trim(),
        embedding,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "Failed to update knowledge base item" });
  }
}

export async function deleteKnowledgeBaseItem(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete knowledge base item" });
  }
}
