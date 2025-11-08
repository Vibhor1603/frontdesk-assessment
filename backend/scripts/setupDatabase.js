import { supabase } from "../src/db/supabase.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  try {
    console.log("Setting up database functions...");

    // Read the SQL file
    const sqlPath = path.join(__dirname, "../sql/create_match_function.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the SQL
    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      // Try alternative approach - direct query
      const { error: directError } = await supabase
        .from("knowledge_base")
        .select("id")
        .limit(1);
      if (directError) {
        console.error("Database connection error:", directError);
        return;
      }

      console.log(
        "⚠️  Could not create function via RPC. Please run the SQL manually:"
      );
      console.log("---");
      console.log(sql);
      console.log("---");
    } else {
      console.log("✅ Database function created successfully!");
    }
  } catch (error) {
    console.error("❌ Error setting up database:", error);
    console.log(
      "\n📝 Please run this SQL manually in your Supabase SQL editor:"
    );
    console.log("---");
    const sqlPath = path.join(__dirname, "../sql/create_match_function.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    console.log(sql);
    console.log("---");
  }
}

setupDatabase();
