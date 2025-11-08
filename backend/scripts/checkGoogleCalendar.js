import { supabase } from "../src/db/supabase.js";
import dotenv from "dotenv";

dotenv.config();

async function checkGoogleCalendar() {
  console.log("🔍 Checking Google Calendar Setup...\n");

  // Check environment variables
  console.log("1️⃣ Environment Variables:");
  console.log(
    "   GOOGLE_CLIENT_ID:",
    process.env.GOOGLE_CLIENT_ID ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "   GOOGLE_CLIENT_SECRET:",
    process.env.GOOGLE_CLIENT_SECRET ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "   GOOGLE_REDIRECT_URI:",
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback"
  );

  // Check if table exists
  console.log("\n2️⃣ Database Table:");
  try {
    const { data: tables, error: tableError } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .limit(1);

    if (tableError) {
      if (tableError.code === "42P01") {
        console.log("   ❌ Table 'google_calendar_tokens' does NOT exist");
        console.log(
          "   → Run the SQL from backend/sql/create_google_tokens_table.sql"
        );
      } else {
        console.log("   ❌ Error:", tableError.message);
      }
    } else {
      console.log("   ✅ Table exists");
    }
  } catch (error) {
    console.log("   ❌ Error checking table:", error.message);
  }

  // Check for tokens
  console.log("\n3️⃣ Stored Tokens:");
  try {
    const { data, error } = await supabase
      .from("google_calendar_tokens")
      .select("*");

    if (error) {
      console.log("   ❌ Error:", error.message);
    } else if (!data || data.length === 0) {
      console.log("   ❌ No tokens found");
      console.log("   → You need to authorize Google Calendar");
      console.log("   → Run: node scripts/connectGoogleCalendar.js");
    } else {
      console.log("   ✅ Tokens found!");
      console.log(
        "   → Access token:",
        data[0].access_token ? "Present" : "Missing"
      );
      console.log(
        "   → Refresh token:",
        data[0].refresh_token ? "Present" : "Missing"
      );
      console.log("   → Created:", data[0].created_at);
    }
  } catch (error) {
    console.log("   ❌ Error:", error.message);
  }

  // Check googleapis package
  console.log("\n4️⃣ Dependencies:");
  try {
    await import("googleapis");
    console.log("   ✅ googleapis package installed");
  } catch (error) {
    console.log("   ❌ googleapis package NOT installed");
    console.log("   → Run: npm install googleapis");
  }

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
  const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;

  if (!hasClientId || !hasClientSecret) {
    console.log("\n❌ Missing credentials in .env");
    console.log("Add these to backend/.env:");
    console.log("GOOGLE_CLIENT_ID=your-client-id");
    console.log("GOOGLE_CLIENT_SECRET=your-client-secret");
  } else {
    console.log("\n✅ Credentials configured");
    console.log("\nNext steps:");
    console.log("1. Make sure table exists (run SQL)");
    console.log("2. Run: node scripts/connectGoogleCalendar.js");
    console.log("3. Open URL in browser and authorize");
    console.log("4. Restart backend");
  }
}

checkGoogleCalendar();
