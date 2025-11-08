import { supabase } from "../../src/core/db/supabase.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  try {
    // Read the SQL file
    const sqlPath = path.join(
      __dirname,
      "../../sql/schema/01_create_match_function.sql"
    );
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
    } else {
    }
  } catch (error) {
    console.error("❌ Error setting up database:", error);
    const sqlPath = path.join(
      __dirname,
      "../../sql/schema/01_create_match_function.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
  }
}

setupDatabase();
