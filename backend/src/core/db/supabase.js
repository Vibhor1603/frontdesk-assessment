import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Initialize the database schema
export async function initializeDatabase() {
  try {
    // Create knowledge_base table
    await supabase
      .from("knowledge_base")
      .insert({
        question: "test",
        answer: "test",
        embedding: Array(1024).fill(0), // Initialize with zero vector
      })
      .select(); // Create help_requests table
    await supabase
      .from("help_requests")
      .insert({
        room_name: "test",
        question: "test",
        participant_id: "test",
        status: "test",
      })
      .select(); // Clean up test data
    await supabase.from("knowledge_base").delete().eq("question", "test");
    await supabase.from("help_requests").delete().eq("room_name", "test");
  } catch (error) {
    console.error("Error initializing database:", error.message || error);
  }
}
