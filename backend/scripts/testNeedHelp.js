/**
 * Test NEED_HELP Detection
 * Verifies that unknown questions properly trigger help requests
 */

import { processQuery } from "../src/services/knowledgeBase.js";

console.log("🧪 Testing NEED_HELP Detection\n");

const testQuestions = [
  {
    question: "Can 4 people book at one time?",
    expected: "needsHelp",
    reason: "Not in knowledge base",
  },
  {
    question: "Do you offer gift cards?",
    expected: "needsHelp",
    reason: "Not in knowledge base",
  },
  {
    question: "What are your hours?",
    expected: "found",
    reason: "Should be in knowledge base",
  },
  {
    question: "How much is a haircut?",
    expected: "found",
    reason: "Should be in knowledge base",
  },
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of testQuestions) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Question: "${test.question}"`);
    console.log(`Expected: ${test.expected}`);
    console.log(`Reason: ${test.reason}`);
    console.log("-".repeat(60));

    try {
      const result = await processQuery(
        test.question,
        "test-participant",
        "test-room"
      );

      console.log(`Result:`);
      console.log(`  found: ${result.found}`);
      console.log(`  needsHelp: ${result.needsHelp}`);
      console.log(`  answer: ${result.answer?.substring(0, 100)}...`);

      // Check if result matches expectation
      const isCorrect =
        (test.expected === "needsHelp" && result.needsHelp) ||
        (test.expected === "found" && result.found && !result.needsHelp);

      if (isCorrect) {
        console.log(`\n✅ PASS`);
        passed++;
      } else {
        console.log(`\n❌ FAIL`);
        console.log(
          `   Expected ${test.expected}, got ${
            result.needsHelp ? "needsHelp" : "found"
          }`
        );
        failed++;
      }
    } catch (error) {
      console.log(`\n❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Test Results:`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Total: ${testQuestions.length}`);
  console.log("=".repeat(60));

  if (failed === 0) {
    console.log(`\n🎉 All tests passed!`);
  } else {
    console.log(`\n⚠️  Some tests failed. Check the output above.`);
  }
}

runTests().catch((error) => {
  console.error("\n❌ Test suite failed:", error);
  process.exit(1);
});
