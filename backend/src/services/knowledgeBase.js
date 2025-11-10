import { supabase } from "../db/supabase.js";
import { generateEmbedding } from "./embeddingService.js";
import { groqChat } from "./groqService.js";

const SIMILARITY_THRESHOLD = 0.7;

async function detectBookingIntent(query) {
  try {
    const prompt = `Determine if this customer query is asking to book/schedule an appointment.

Booking indicators:
- "book an appointment"
- "schedule a visit"
- "make a reservation"
- "I want to book"
- "can I schedule"
- "reserve a time"

Customer query: "${query}"

Respond with ONLY valid JSON:
{"isBooking": true/false, "service": "detected service or null"}

Examples:
- "I want to book a haircut" → {"isBooking": true, "service": "haircut"}
- "Can I schedule a massage?" → {"isBooking": true, "service": "massage"}
- "What are your hours?" → {"isBooking": false, "service": null}`;

    const response = await groqChat(prompt);
    const parsed = JSON.parse(response.trim());

    return parsed;
  } catch (error) {
    console.error("[KB] Error detecting booking intent:", error);
    return { isBooking: false, service: null };
  }
}

async function checkQueryScope(query) {
  try {
    const prompt = `You are a friendly, conversational AI receptionist for Luxe Salon & Spa.

Analyze this customer message: "${query}"

Determine the type:
1. GREETING/SMALL TALK: greetings, how are you, what are you doing, who are you, what's your name, tell me about yourself, casual conversation about the AI
2. SALON SERVICES: anything about haircuts, spa, appointments, hours, pricing, services, location, staff
3. UNRELATED: weather, news, sports, unrelated businesses, general knowledge

Respond with ONLY valid JSON:

For GREETINGS/SMALL TALK about the AI: {"inScope": true, "isGreeting": true, "response": "friendly, natural response + mention you're here to help with salon services"}
For SALON TOPICS: {"inScope": true}
For UNRELATED: {"inScope": false, "response": "polite decline + what you can help with"}

Examples:
"hi" → {"inScope": true, "isGreeting": true, "response": "Hi there! Welcome to Luxe Salon. I'm here to help you with appointments, services, or any questions. What can I do for you?"}
"what are you doing" → {"inScope": true, "isGreeting": true, "response": "I'm here ready to assist you! I help customers with booking appointments, answering questions about our salon and spa services, and anything else you need. How can I help you today?"}
"who are you" → {"inScope": true, "isGreeting": true, "response": "I'm your virtual receptionist for Luxe Salon & Spa! I'm here to help you book appointments, learn about our services, or answer any questions you have. What would you like to know?"}
"how are you" → {"inScope": true, "isGreeting": true, "response": "I'm doing great, thanks for asking! I'm here and ready to help you with anything salon or spa related. What brings you in today?"}
"what's your name" → {"inScope": true, "isGreeting": true, "response": "I'm the Frontdesk Salon Agent for Luxe Salon & Spa! I'm here to help you with bookings, services, and any questions. How can I assist you?"}
"what's the weather" → {"inScope": false, "response": "I wish I could help with that, but I'm specifically here for salon and spa services. However, I'd be happy to help you book an appointment or answer questions about our treatments!"}

Be natural, warm, and conversational. Vary responses - never repeat the same answer.`;

    const response = await groqChat(prompt);
    const parsed = JSON.parse(response.trim());

    return parsed;
  } catch (error) {
    return { inScope: true };
  }
}

export async function processQuery(
  query,
  participantId = null,
  roomName = null
) {
  try {
    const scopeCheck = await checkQueryScope(query);

    if (!scopeCheck.inScope) {
      return {
        found: true,
        needsHelp: false,
        answer: scopeCheck.response,
        outOfScope: true,
      };
    }

    if (scopeCheck.isGreeting && scopeCheck.response) {
      return {
        found: true,
        needsHelp: false,
        answer: scopeCheck.response,
        isGreeting: true,
      };
    }

    const bookingIntent = await detectBookingIntent(query);

    if (bookingIntent.isBooking) {
      return {
        found: true,
        needsHelp: false,
        answer:
          "I'd be happy to help you book an appointment! Please provide your details so I can create your booking.",
        requiresBooking: true,
        bookingType: bookingIntent.service,
      };
    }

    const multipleQuestions = await detectMultipleQuestions(query);

    if (multipleQuestions.isMultiple) {
      return await handleMultipleQuestions(
        multipleQuestions.questions,
        participantId,
        roomName
      );
    }

    return await processSingleQuery(query, participantId, roomName);
  } catch (error) {
    console.error("[KB] Error processing query:", error);
    return await handleUnknownQuery(query, participantId, roomName);
  }
}

async function detectMultipleQuestions(query) {
  try {
    const prompt = `Analyze this customer message and determine if it contains multiple distinct questions.

Customer message: "${query}"

If it contains multiple distinct questions, extract them as a JSON array.
If it's a single question or statement, return {"isMultiple": false}.

Examples:
- "What are your hours and how much is a haircut?" → {"isMultiple": true, "questions": ["What are your hours?", "How much is a haircut?"]}
- "What services do you offer?" → {"isMultiple": false}
- "Do you do nails, can I book for tomorrow, and what's your address?" → {"isMultiple": true, "questions": ["Do you do nails?", "Can I book for tomorrow?", "What's your address?"]}

Respond ONLY with valid JSON, no other text.`;

    const response = await groqChat(prompt);
    const parsed = JSON.parse(response.trim());

    return parsed.isMultiple
      ? { isMultiple: true, questions: parsed.questions }
      : { isMultiple: false };
  } catch (error) {
    console.error("[KB] Error detecting multiple questions:", error);
    return { isMultiple: false };
  }
}

async function handleMultipleQuestions(questions, participantId, roomName) {
  const results = [];
  let unknownQuestions = [];

  for (const question of questions) {
    const result = await processSingleQuery(
      question,
      participantId,
      roomName,
      true
    );
    results.push({
      question,
      ...result,
    });

    if (result.needsHelp) {
      unknownQuestions.push(question);
    }
  }

  const knownAnswers = results.filter((r) => !r.needsHelp);

  if (knownAnswers.length === 0) {
    return await handleUnknownQuery(
      questions.join(" "),
      participantId,
      roomName
    );
  }

  if (unknownQuestions.length > 0) {
    const unknownQuery = unknownQuestions.join(" ");
    const helpRequestData = await handleUnknownQuery(
      unknownQuery,
      participantId,
      roomName
    );

    const combinedAnswer = await combineAnswers(knownAnswers, unknownQuestions);

    return {
      found: true,
      needsHelp: true,
      answer: combinedAnswer,
      helpRequestId: helpRequestData.helpRequestId,
      outOfScope: false,
      partialAnswer: true,
    };
  }

  const combinedAnswer = await combineAnswers(knownAnswers, []);

  return {
    found: true,
    needsHelp: false,
    answer: combinedAnswer,
    outOfScope: false,
  };
}

async function processSingleQuery(
  query,
  participantId,
  roomName,
  skipHelp = false
) {
  try {
    const queryEmbedding = await generateEmbedding(query);

    let similarQuestions = [];

    try {
      const { data } = await supabase.rpc("match_knowledge_base", {
        query_embedding: queryEmbedding,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: 3,
      });
      similarQuestions = data || [];
    } catch (rpcError) {
      const { data: allQuestions, error: fetchError } = await supabase
        .from("knowledge_base")
        .select("id, question, answer, times_used");

      if (!fetchError && allQuestions) {
        const queryLower = query.toLowerCase();
        similarQuestions = allQuestions
          .filter((item) => {
            const questionLower = item.question.toLowerCase();
            return (
              questionLower.includes(queryLower) ||
              queryLower.split(" ").some((word) => questionLower.includes(word))
            );
          })
          .slice(0, 3);
      }
    }

    if (similarQuestions.length === 0) {
      if (skipHelp) {
        return { found: false, needsHelp: true, answer: null };
      }
      return await handleUnknownQuery(query, participantId, roomName);
    }

    const topMatch = similarQuestions[0];
    const topSimilarity = topMatch.similarity || 0;

    if (topSimilarity < SIMILARITY_THRESHOLD) {
      if (skipHelp) {
        return { found: false, needsHelp: true, answer: null };
      }
      return await handleUnknownQuery(query, participantId, roomName);
    }

    const context = similarQuestions
      .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
      .join("\n\n");

    await supabase
      .from("knowledge_base")
      .update({ times_used: (topMatch.times_used || 0) + 1 })
      .eq("id", topMatch.id);

    const aiPrompt = `You are a helpful salon/spa assistant. 

CRITICAL RULES:
1. ONLY answer if the knowledge base below DIRECTLY addresses the user's question
2. If the knowledge base is about a different topic, respond with ONLY "NEED_HELP"
3. DO NOT make up information or guess
4. DO NOT provide general answers - only use the specific information provided
5. If you're not 100% confident the knowledge base answers the question, say "NEED_HELP"

Knowledge Base Context:
${context}

User Question: ${query}

Your response (or "NEED_HELP" if the knowledge base doesn't directly answer this):`;

    const aiResponse = await groqChat(aiPrompt);

    const needsHelp =
      aiResponse.trim().toUpperCase().includes("NEED_HELP") ||
      aiResponse.trim() === "NEED_HELP";

    if (needsHelp) {
      if (skipHelp) {
        return { found: false, needsHelp: true, answer: null };
      }
      return await handleUnknownQuery(query, participantId, roomName);
    }

    return {
      found: true,
      needsHelp: false,
      answer: aiResponse,
      outOfScope: false,
      source: "ai_knowledge_base",
    };
  } catch (error) {
    console.error("[KB] Error processing single query:", error);
    if (skipHelp) {
      return { found: false, needsHelp: true, answer: null };
    }
    return await handleUnknownQuery(query, participantId, roomName);
  }
}

async function combineAnswers(knownAnswers, unknownQuestions) {
  try {
    const answersText = knownAnswers
      .map((r) => `Q: ${r.question}\nA: ${r.answer}`)
      .join("\n\n");

    const hasUnknown = unknownQuestions.length > 0;
    const unknownText = hasUnknown
      ? `\n\nUnknown questions: ${unknownQuestions.join(", ")}`
      : "";

    const prompt = `You are a friendly salon receptionist. Combine these Q&A pairs into a natural, conversational response.

${answersText}${unknownText}

Instructions:
- Combine the answers naturally, don't just list them
- Keep it conversational and friendly
- Keep it concise (3-4 sentences max)
- If there are unknown questions, mention you'll check with your supervisor about those
- Don't use "Q1", "A1" format - just flow naturally

Your combined response:`;

    const combined = await groqChat(prompt);
    return combined;
  } catch (error) {
    console.error("[KB] Error combining answers:", error);
    return knownAnswers.map((r) => r.answer).join(" ");
  }
}

async function handleUnknownQuery(query, participantId, roomName) {
  try {
    const { data, error } = await supabase
      .from("help_requests")
      .insert({
        question: query,
        caller_phone: participantId || "web-customer",
        session_id: roomName || `session-${Date.now()}`,
        participant_id: participantId,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error storing help request:", error);
    }

    return {
      found: false,
      answer:
        "I'm not sure about that. Let me contact my supervisor for help and I'll get back to you shortly.",
      outOfScope: false,
      needsHelp: true,
      helpRequestId: data?.id,
    };
  } catch (error) {
    console.error("Error handling unknown query:", error);
    return {
      found: false,
      answer:
        "I'm experiencing some technical difficulties. Please try again in a moment.",
      outOfScope: false,
      error: true,
    };
  }
}

export async function storeQA(question, answer, learnedFromRequestId = null) {
  try {
    const embedding = await generateEmbedding(question);

    const { error } = await supabase.from("knowledge_base").insert({
      question,
      answer,
      embedding,
      learned_from_request_id: learnedFromRequestId,
      times_used: 0,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error storing QA:", error);
    throw error;
  }
}
