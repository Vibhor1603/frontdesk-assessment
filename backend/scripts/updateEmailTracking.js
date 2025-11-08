import { supabase } from "../src/core/db/supabase.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateEmailTracking() {
  try {
    // Read the SQL file
    const sqlPath = path.join(
      __dirname,
      "../sql/migrations/add_email_tracking.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Split by semicolon and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const { error } = await supabase.rpc("exec_sql", { sql: statement });

      if (error) {
        // Try direct query if RPC doesn't work
        const { error: directError } = await supabase
          .from("_")
          .select(statement);

        if (directError && !directError.message.includes("does not exist")) {
          console.error(`⚠️  Warning:`, directError.message);
        }
      }
    }
  } catch (error) {
    console.error("\n❌ Error updating schema:", error.message);
    process.exit(1);
  }
}

updateEmailTracking();
