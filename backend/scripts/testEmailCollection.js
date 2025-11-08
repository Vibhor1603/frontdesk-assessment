/**
 * Test Email Collection Flow
 *
 * This script tests the complete email collection workflow:
 * 1. Ask unknown question
 * 2. AI asks for email
 * 3. Provide email
 * 4. AI confirms email
 * 5. Ask another unknown question
 * 6. AI uses stored email (doesn't ask again)
 */

import fetch from "node-fetch";

const API_BASE = "http://localhost:3000";
const participantId = `test-${Date.now()}`;

console.log("🧪 Testing Email Collection Flow\n");
console.log(`Participant ID: ${participantId}\n`);

async function sendMessage(text) {
  console.log(`\n📤 Sending: "${text}"`);

  const response = await fetch(`${API_BASE}/api/webhooks/customer-input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      participantId,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  console.log(`📥 Response: "${data.message.text}"`);
  return data.message.text;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  try {
    // Test 1: Ask a known question (should answer normally)
    console.log("\n=== Test 1: Known Question ===");
    const response1 = await sendMessage("What are your hours?");
    if (response1.toLowerCase().includes("email")) {
      console.log("❌ FAIL: Should not ask for email on known question");
      return;
    }
    console.log("✅ PASS: Answered without asking for email");

    await wait(1000);

    // Test 2: Ask unknown question (should ask for email)
    console.log("\n=== Test 2: Unknown Question (First Time) ===");
    const response2 = await sendMessage("Do you offer gift cards?");
    if (!response2.toLowerCase().includes("email")) {
      console.log("❌ FAIL: Should ask for email on unknown question");
      return;
    }
    console.log("✅ PASS: Asked for email");

    await wait(1000);

    // Test 3: Provide invalid email
    console.log("\n=== Test 3: Invalid Email ===");
    const response3 = await sendMessage("invalid-email");
    if (
      !response3.toLowerCase().includes("valid") &&
      !response3.toLowerCase().includes("again")
    ) {
      console.log("❌ FAIL: Should reject invalid email");
      return;
    }
    console.log("✅ PASS: Rejected invalid email");

    await wait(1000);

    // Test 4: Provide valid email
    console.log("\n=== Test 4: Valid Email ===");
    const testEmail = `test-${Date.now()}@example.com`;
    const response4 = await sendMessage(testEmail);
    if (
      !response4.toLowerCase().includes("perfect") &&
      !response4.toLowerCase().includes("got")
    ) {
      console.log("❌ FAIL: Should confirm email");
      return;
    }
    console.log("✅ PASS: Email confirmed");

    await wait(1000);

    // Test 5: Ask another unknown question (should NOT ask for email again)
    console.log("\n=== Test 5: Unknown Question (Second Time) ===");
    const response5 = await sendMessage("Do you offer wedding packages?");
    if (
      response5.toLowerCase().includes("provide your email") ||
      response5.toLowerCase().includes("could you please provide")
    ) {
      console.log("❌ FAIL: Should not ask for email again");
      return;
    }
    if (!response5.toLowerCase().includes("email you")) {
      console.log("⚠️  WARNING: Should mention emailing the answer");
    }
    console.log("✅ PASS: Used stored email, didn't ask again");

    await wait(1000);

    // Test 6: Verify email is in database
    console.log("\n=== Test 6: Verify Database ===");
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { data: helpRequests, error } = await supabase
      .from("help_requests")
      .select("*")
      .eq("participant_id", participantId)
      .not("customer_email", "is", null);

    if (error) {
      console.log("❌ FAIL: Database error:", error.message);
      return;
    }

    if (!helpRequests || helpRequests.length === 0) {
      console.log("❌ FAIL: No help requests with email found in database");
      return;
    }

    console.log(
      `✅ PASS: Found ${helpRequests.length} help request(s) with email`
    );
    helpRequests.forEach((req, i) => {
      console.log(`   ${i + 1}. Email: ${req.customer_email}`);
      console.log(`      Question: ${req.question}`);
      console.log(`      Status: ${req.status}`);
    });

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("🎉 ALL TESTS PASSED!");
    console.log("=".repeat(50));
    console.log("\n✅ Email collection flow is working correctly:");
    console.log("   1. Asks for email on first unknown question");
    console.log("   2. Validates email format");
    console.log("   3. Stores email in database");
    console.log("   4. Reuses email for subsequent questions");
    console.log("   5. Never asks for email again from same participant");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error.message);
    console.error(error.stack);
  }
}

// Check if server is running
console.log("Checking if server is running...");
try {
  const response = await fetch(`${API_BASE}/api/agent/status`);
  if (!response.ok) {
    throw new Error("Server not responding");
  }
  console.log("✅ Server is running\n");

  // Run the test
  await runTest();
} catch (error) {
  console.error("❌ Server is not running!");
  console.error("Please start the backend server first:");
  console.error("  cd backend && npm run dev");
  process.exit(1);
}
