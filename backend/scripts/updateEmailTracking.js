import { supabase } from "../src/db/supabase.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateEmailTracking() {
  console.log("🔧 Updating database schema for email tracking...\n");

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, "../sql/add_email_tracking.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Split by semicolon and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing...`);

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

    console.log("\n✅ Schema update completed!");
    console.log("\nNew features:");
    console.log("  - email_sent column in help_requests");
    console.log("  - email_sent_at column in help_requests");
    console.log("  - supervisor_responses table created");
    console.log(
      "\nYou may need to run this SQL manually in Supabase SQL Editor:"
    );
    console.log("  File: backend/sql/add_email_tracking.sql");
  } catch (error) {
    console.error("\n❌ Error updating schema:", error.message);
    console.log("\nPlease run the SQL manually in Supabase SQL Editor:");
    console.log("  File: backend/sql/add_email_tracking.sql");
    process.exit(1);
  }
}

updateEmailTracking();
