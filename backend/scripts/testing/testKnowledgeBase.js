import { processQuery } from "../../src/features/knowledge/services/knowledgeBase.js";

const TEST_QUERIES = [
  "What are your hours?",
  "Do you take walk-ins?",
  "How much is a haircut?",
  "Do you offer color services?",
  "What is your cancellation policy?",
];

async function testKnowledgeBase() {
  try {
    for (const query of TEST_QUERIES) {
      const result = await processQuery(query);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("Error testing knowledge base:", error);
  }
}

testKnowledgeBase();
