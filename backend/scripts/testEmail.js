import {
  sendTestEmail,
  sendAnswerEmail,
  isValidEmail,
} from "../src/services/emailService.js";

console.log("🧪 Testing Email Service\n");

// Test 1: Email Validation
console.log("Test 1: Email Validation");
const testEmails = [
  "valid@example.com",
  "user.name@domain.co.uk",
  "invalid@",
  "@invalid.com",
  "no-at-sign.com",
  "spaces in@email.com",
];

testEmails.forEach((email) => {
  const isValid = isValidEmail(email);
  console.log(`  ${email}: ${isValid ? "✅ Valid" : "❌ Invalid"}`);
});

// Test 2: Send Test Email
console.log("\nTest 2: Send Test Email");
const testEmailAddress = process.argv[2] || "test@example.com";
console.log(`  Sending to: ${testEmailAddress}`);

try {
  const result = await sendTestEmail(testEmailAddress);
  if (result.success) {
    console.log(`  ✅ Test email sent successfully!`);
    console.log(`  Message ID: ${result.messageId}`);
  } else {
    console.log(`  ❌ Failed to send test email`);
    console.log(`  Error: ${result.error}`);
  }
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
}

// Test 3: Send Answer Email
console.log("\nTest 3: Send Answer Email");
const question = "What are your hours?";
const answer =
  "We're open Monday through Saturday from 9 AM to 7 PM, and Sunday from 10 AM to 5 PM.";

try {
  const result = await sendAnswerEmail(testEmailAddress, question, answer);
  if (result.success) {
    console.log(`  ✅ Answer email sent successfully!`);
    console.log(`  Message ID: ${result.messageId}`);
  } else {
    console.log(`  ❌ Failed to send answer email`);
    console.log(`  Error: ${result.error}`);
  }
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
}

console.log("\n✅ Email service tests complete!");
console.log("\nUsage: node scripts/testEmail.js [email-address]");
console.log("Example: node scripts/testEmail.js your-email@gmail.com");
