import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_BASE = process.env.API_URL || "http://localhost:3000";
const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";

async function testAdminDashboardAPIs() {
  console.log("🧪 Testing Admin Dashboard APIs\n");
  console.log("API Base:", API_BASE);
  console.log();

  try {
    // Test 1: Get all help requests
    console.log("1️⃣ Testing GET /api/supervisor/help-requests");
    const allRequests = await fetch(`${API_BASE}/api/supervisor/help-requests`);
    const allData = await allRequests.json();
    console.log(`✅ Retrieved ${allData.length} requests`);

    // Test 2: Get pending requests only
    console.log(
      "\n2️⃣ Testing GET /api/supervisor/help-requests?status=pending"
    );
    const pendingRequests = await fetch(
      `${API_BASE}/api/supervisor/help-requests?status=pending`
    );
    const pendingData = await pendingRequests.json();
    console.log(`✅ Retrieved ${pendingData.length} pending requests`);

    // Test 3: Get statistics
    console.log("\n3️⃣ Testing GET /api/supervisor/stats");
    const statsResponse = await fetch(`${API_BASE}/api/supervisor/stats`);
    const stats = await statsResponse.json();
    console.log("✅ Statistics retrieved:");
    console.log("   Total:", stats.total);
    console.log("   Pending:", stats.pending);
    console.log("   Answered:", stats.answered);
    console.log("   Resolved:", stats.resolved);
    console.log("   Timeout:", stats.timeout);
    console.log("   Learned:", stats.learnedAnswers);

    // Test 4: Get learned answers
    console.log("\n4️⃣ Testing GET /api/supervisor/learned-answers");
    const learnedResponse = await fetch(
      `${API_BASE}/api/supervisor/learned-answers`
    );
    const learned = await learnedResponse.json();
    console.log(`✅ Retrieved ${learned.length} learned answers`);

    // Test 5: Create a test request and answer it
    console.log("\n5️⃣ Testing POST /api/supervisor/help-requests/:id/answer");

    // First create a test request via direct API
    console.log("   Creating test help request...");
    const createResponse = await fetch(
      `${API_BASE}/api/webhooks/help-request`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: "test-room-" + Date.now(),
          participantId: "test-participant",
          question: "What are your opening hours?",
          customerEmail: TEST_EMAIL,
        }),
      }
    );

    if (!createResponse.ok) {
      throw new Error("Failed to create test request");
    }

    const created = await createResponse.json();
    console.log("   ✅ Test request created:", created.id);

    // Now answer it
    console.log("   Submitting answer with email...");
    const answerResponse = await fetch(
      `${API_BASE}/api/supervisor/help-requests/${created.id}/answer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: "We are open Monday-Saturday 9am-8pm, and Sunday 10am-6pm.",
        }),
      }
    );

    if (!answerResponse.ok) {
      const error = await answerResponse.json();
      throw new Error(error.error || "Failed to submit answer");
    }

    const answered = await answerResponse.json();
    console.log("   ✅ Answer submitted successfully");
    console.log("   Email sent:", answered.emailSent);
    console.log("   No email:", answered.noEmail);

    if (answered.emailSent) {
      console.log("   📧 Email sent to:", TEST_EMAIL);
    }

    // Cleanup
    console.log("\n6️⃣ Cleaning up test data...");
    // Note: You might want to add a cleanup endpoint or do this manually
    console.log(
      "   ⚠️  Manual cleanup may be needed for test request:",
      created.id
    );

    console.log("\n✨ All API tests passed!");
    console.log("\n📝 Summary:");
    console.log("   - Get all requests ✅");
    console.log("   - Get pending requests ✅");
    console.log("   - Get statistics ✅");
    console.log("   - Get learned answers ✅");
    console.log("   - Submit answer with email ✅");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
console.log("=".repeat(60));
console.log("ADMIN DASHBOARD API TEST");
console.log("=".repeat(60));
console.log();

testAdminDashboardAPIs();
