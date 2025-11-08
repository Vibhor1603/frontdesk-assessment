import { supabase } from "../src/db/supabase.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateSchema() {
  try {
    console.log("Updating help_requests table schema...");

    // Read the SQL file
    const sqlPath = path.join(__dirname, "../sql/update_help_requests.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the SQL
    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct queries
      console.log("Trying direct column additions...");

      // Add columns one by one
      const columns = [
        { name: "participant_id", type: "TEXT" },
        { name: "resolved_at", type: "TIMESTAMPTZ" },
        { name: "answered_at", type: "TIMESTAMPTZ" },
        { name: "answer", type: "TEXT" },
      ];

      for (const col of columns) {
        try {
          await supabase.rpc("exec_sql", {
            sql_query: `ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`,
          });
          console.log(`✓ Added column: ${col.name}`);
        } catch (err) {
          console.log(
            `Column ${col.name} might already exist or error:`,
            err.message
          );
        }
      }
    } else {
      console.log("✓ Schema updated successfully");
    }

    // Verify the schema
    const { data, error: selectError } = await supabase
      .from("help_requests")
      .select("*")
      .limit(1);

    if (selectError) {
      console.error("Error verifying schema:", selectError);
    } else {
      console.log("\n✓ Schema verification successful");
      if (data && data.length > 0) {
        console.log("Available columns:", Object.keys(data[0]));
      }
    }

    console.log("\n✓ Schema update complete!");
  } catch (error) {
    console.error("Error updating schema:", error);
    console.log("\nPlease run the SQL manually in Supabase SQL Editor:");
    console.log("File: backend/sql/update_help_requests.sql");
  }
}

updateSchema();
