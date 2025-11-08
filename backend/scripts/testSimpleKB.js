import { groqChat } from "../src/services/groqService.js";

// Simple in-memory knowledge base for testing
const KNOWLEDGE_BASE = [
  {
    question: "What are your opening hours?",
    answer:
      "We are open Tuesday to Saturday from 9:00 AM to 7:00 PM, and Sunday 10:00 AM to 4:00 PM. We are closed on Mondays.",
  },
  {
    question: "How much is a haircut?",
    answer:
      "A standard haircut starts at $35 for adults and $20 for children. Prices vary for senior stylists or special treatments.",
  },
  {
    question: "Do you accept walk-ins?",
    answer:
      "Yes, we accept walk-ins when slots are available, but we recommend booking in advance to guarantee a preferred time and stylist.",
  },
];

async function simpleProcessQuery(query) {
  console.log(`Processing query: "${query}"`);

  // Simple text matching
  const queryLower = query.toLowerCase();
  const matches = KNOWLEDGE_BASE.filter((item) => {
    const questionLower = item.question.toLowerCase();
    return (
      questionLower.includes(queryLower) ||
      queryLower.includes(questionLower) ||
      queryLower.split(" ").some((word) => questionLower.includes(word))
    );
  });

  let context = "";
  if (matches.length > 0) {
    context = matches
      .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
      .join("\n\n");
    console.log(`Found ${matches.length} matching questions`);
  }

  // Use AI to generate response
  const aiPrompt = `You are a helpful front desk assistant for a salon/spa business. 
    
Based on the following knowledge base information, answer the user's question. If you can confidently answer based on the provided context, give a helpful and professional response. If you're not sure or the information isn't sufficient, respond with exactly "NEED_HELP".

Knowledge Base Context:
${context || "No relevant information found in knowledge base."}

User Question: ${query}

Response:`;

  const aiResponse = await groqChat(aiPrompt);

  if (aiResponse === "NEED_HELP" || !context) {
    return {
      found: false,
      answer:
        "I'm not sure about that. Let me contact my supervisor for help and I'll get back to you shortly.",
      needsHelp: true,
    };
  }

  return {
    found: true,
    answer: aiResponse,
    source: "ai_knowledge_base",
  };
}

const TEST_QUERIES = [
  "What time do you open?",
  "How much does a cut cost?",
  "Can I walk in without appointment?",
  "What's your phone number?", // Should trigger NEED_HELP
];

async function testSimpleKB() {
  console.log("🧪 Testing Simple AI Knowledge Base...\n");

  for (const query of TEST_QUERIES) {
    console.log(`❓ Query: "${query}"`);

    try {
      const result = await simpleProcessQuery(query);

      if (result.found) {
        console.log(`✅ Answer: ${result.answer}`);
        console.log(`📊 Source: ${result.source || "unknown"}`);
      } else if (result.needsHelp) {
        console.log(`🆘 Escalated: ${result.answer}`);
      } else {
        console.log(`❌ No answer found`);
      }
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }

    console.log("---\n");
  }
}

testSimpleKB();
