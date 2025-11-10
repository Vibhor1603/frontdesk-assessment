import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function initializeDatabase() {
  try {
    await supabase
      .from("knowledge_base")
      .insert({
        question: "test",
        answer: "test",
        embedding: Array(1024).fill(0),
      })
      .select();
    await supabase
      .from("help_requests")
      .insert({
        room_name: "test",
        question: "test",
        participant_id: "test",
        status: "test",
      })
      .select();
    await supabase.from("knowledge_base").delete().eq("question", "test");
    await supabase.from("help_requests").delete().eq("room_name", "test");
  } catch (error) {
    console.error("Error initializing database:", error.message || error);
  }
}
