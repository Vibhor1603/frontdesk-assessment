import { supabase } from "../../db/supabase.js";
import { generateEmbedding } from "../../services/embeddingService.js";

export const getAllKnowledgeBase = async (req, res) => {
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
};

export const createKnowledgeBase = async (req, res) => {
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
};

export const updateKnowledgeBase = async (req, res) => {
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
};

export const deleteKnowledgeBase = async (req, res) => {
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
};

export const getLearnedAnswers = async (req, res) => {
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
};
