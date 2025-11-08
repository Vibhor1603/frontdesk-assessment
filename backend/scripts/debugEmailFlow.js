/**
 * Debug Email Flow
 * Run this to see exactly what's happening with email collection
 */

import fetch from "node-fetch";

const API_BASE = "http://localhost:3000";
const participantId = `debug-${Date.now()}`;

console.log("🔍 Debugging Email Flow\n");
console.log(`Participant ID: ${participantId}\n`);

async function sendMessage(text, step) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`STEP ${step}: "${text}"`);
  console.log("=".repeat(60));

  const response = await fetch(`${API_BASE}/api/webhooks/customer-input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      participantId,
    }),
  });

  if (!response.ok) {
    console.error(`❌ HTTP ${response.status}`);
    const errorText = await response.text();
    console.error(errorText);
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log(`\n📥 AI Response:`);
  console.log(`"${data.message.text}"`);

  return data;
}

async function wait(ms) {
  console.log(`\n⏳ Waiting ${ms}ms...\n`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

try {
  // Step 1: Ask unknown question
  await sendMessage("Do you offer gift cards?", 1);

  console.log("\n💡 Expected: AI should ask for email");
  console.log("💡 Check backend logs for:");
  console.log("   - [AudioAgent] 🆘 Escalating to supervisor");
  console.log("   - [AudioAgent] 📧 Requesting email from customer");
  console.log("   - [AudioAgent] ✅ Set awaitingEmail flag");

  await wait(2000);

  // Step 2: Provide email
  await sendMessage("aaryansharmanew@gmail.com", 2);

  console.log("\n💡 Expected: AI should confirm email");
  console.log("💡 Check backend logs for:");
  console.log("   - [AudioAgent] 📧 Expecting email response");
  console.log("   - [AudioAgent] 📧 Processing email response");
  console.log("   - [AudioAgent] ✅ Valid email");

  console.log("\n" + "=".repeat(60));
  console.log("✅ Debug complete!");
  console.log("=".repeat(60));
  console.log("\nCheck the backend console logs above to see:");
  console.log("1. Was awaitingEmail flag set? (should be true)");
  console.log(
    "2. Was email detected? (should show 'Expecting email response')"
  );
  console.log("3. Was email validated? (should show 'Valid email')");
  console.log("4. Any errors?");
} catch (error) {
  console.error("\n❌ Error:", error.message);
  console.error("\nMake sure backend is running: npm run dev");
}
