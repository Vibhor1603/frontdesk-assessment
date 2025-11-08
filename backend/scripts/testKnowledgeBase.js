import { processQuery } from "../src/services/knowledgeBase.js";

const TEST_QUERIES = [
  "What time do you open?",
  "How much does a cut cost?",
  "Can I walk in without appointment?",
  "Where is your salon located?",
  "Do you do hair color?",
  "What's your phone number?", // This should trigger NEED_HELP
];

async function testKnowledgeBase() {
  console.log("🧪 Testing AI Knowledge Base...\n");

  for (const query of TEST_QUERIES) {
    console.log(`❓ Query: "${query}"`);

    try {
      const result = await processQuery(query, "test-user", "test-room");

      if (result.found) {
        console.log(`✅ Answer: ${result.answer}`);
        console.log(`📊 Source: ${result.source || "unknown"}`);
      } else if (result.needsHelp) {
        console.log(`🆘 Escalated to supervisor: ${result.answer}`);
      } else {
        console.log(`❌ No answer found`);
      }
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }

    console.log("---\n");
  }
}

testKnowledgeBase();
