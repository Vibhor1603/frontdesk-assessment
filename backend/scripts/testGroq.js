import { groqChat } from "../src/services/groqService.js";

async function testGroq() {
  console.log("🧪 Testing Groq AI...\n");

  const testPrompt = `You are a helpful front desk assistant for a salon/spa business. 
    
Based on the following knowledge base information, answer the user's question. If you can confidently answer based on the provided context, give a helpful and professional response. If you're not sure or the information isn't sufficient, respond with exactly "NEED_HELP".

Knowledge Base Context:
Q: What are your opening hours?
A: We are open Tuesday to Saturday from 9:00 AM to 7:00 PM, and Sunday 10:00 AM to 4:00 PM. We are closed on Mondays.

Q: Do you accept walk-ins?
A: Yes, we accept walk-ins when slots are available, but we recommend booking in advance to guarantee a preferred time and stylist.

User Question: What time do you open?

Response:`;

  try {
    const response = await groqChat(testPrompt);
    console.log("✅ Groq AI Response:");
    console.log(response);
  } catch (error) {
    console.log("❌ Groq AI Error:");
    console.log(error.message);
  }
}

testGroq();
