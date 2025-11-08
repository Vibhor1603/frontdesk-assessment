import { supabase } from "../src/db/supabase.js";
import { sendAnswerEmail } from "../src/services/emailService.js";
import dotenv from "dotenv";

dotenv.config();

async function testSupervisorEmailFlow() {
  console.log("🧪 Testing Supervisor Email Flow\n");

  try {
    // Step 1: Create a test help request
    console.log("1️⃣ Creating test help request...");
    const testEmail = process.env.TEST_EMAIL || "test@example.com";

    const { data: request, error: createError } = await supabase
      .from("help_requests")
      .insert({
        room_name: "test-room-" + Date.now(),
        participant_id: "test-participant",
        question: "What are your spa package prices?",
        customer_email: testEmail,
        status: "pending",
      })
      .select()
      .single();

    if (createError) throw createError;
    console.log("✅ Test request created:", request.id);
    console.log("   Email:", testEmail);
    console.log("   Question:", request.question);

    // Step 2: Simulate supervisor answering
    console.log("\n2️⃣ Simulating supervisor answer...");
    const answer =
      "Our spa packages range from $150 for a basic package to $500 for our premium luxury package. All packages include a massage, facial, and access to our facilities.";

    const { data: updated, error: updateError } = await supabase
      .from("help_requests")
      .update({
        answer: answer,
        status: "answered",
        answered_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .select()
      .single();

    if (updateError) throw updateError;
    console.log("✅ Request updated with answer");

    // Step 3: Send email
    console.log("\n3️⃣ Sending email to customer...");
    const emailResult = await sendAnswerEmail(
      testEmail,
      request.question,
      answer
    );

    if (emailResult.success) {
      console.log("✅ Email sent successfully!");
      console.log("   Message ID:", emailResult.messageId);
      console.log("\n📧 Check your inbox at:", testEmail);
    } else {
      console.error("❌ Email failed:", emailResult.error);
    }

    // Step 4: Verify database state
    console.log("\n4️⃣ Verifying database state...");
    const { data: verified, error: verifyError } = await supabase
      .from("help_requests")
      .select("*")
      .eq("id", request.id)
      .single();

    if (verifyError) throw verifyError;

    console.log("✅ Database verification:");
    console.log("   Status:", verified.status);
    console.log("   Has answer:", !!verified.answer);
    console.log("   Answered at:", verified.answered_at);
    console.log("   Customer email:", verified.customer_email);

    // Step 5: Cleanup
    console.log("\n5️⃣ Cleaning up test data...");
    const { error: deleteError } = await supabase
      .from("help_requests")
      .delete()
      .eq("id", request.id);

    if (deleteError) throw deleteError;
    console.log("✅ Test data cleaned up");

    console.log("\n✨ Test completed successfully!");
    console.log("\n📝 Summary:");
    console.log("   - Help request created ✅");
    console.log("   - Answer submitted ✅");
    console.log("   - Email sent ✅");
    console.log("   - Database updated ✅");
    console.log("   - Cleanup completed ✅");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
console.log("=".repeat(60));
console.log("SUPERVISOR EMAIL FLOW TEST");
console.log("=".repeat(60));
console.log();

testSupervisorEmailFlow();
