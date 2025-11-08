import { supabase } from "../../../core/db/supabase.js";
import { generateEmbedding } from "./embeddingService.js";
import { groqChat } from "../../voice/services/groqService.js";

const SIMILARITY_THRESHOLD = 0.7; // Adjust based on testing

/**
 * Detect if user wants to make a booking
 */
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

/**
 * Check if query is within scope for a salon/spa business
 */
async function checkQueryScope(query) {
  try {
    const prompt = `You are a scope detector for a salon and spa business AI assistant.

Determine if this customer query is relevant to a salon/spa business.

IN SCOPE topics include:
- Services (haircuts, coloring, styling, nails, spa treatments, massages, facials, etc.)
- Pricing and packages
- Hours of operation
- Location and directions
- Booking appointments
- Staff and stylists
- Products sold
- Policies (cancellation, payment, etc.)
- Facilities and amenities
- Gift cards and promotions

OUT OF SCOPE topics include:
- Personal questions about the AI ("how are you", "what's your name")
- Unrelated businesses or services
- General knowledge questions
- Technical support for other products
- Medical advice
- Personal advice or counseling
- Current events, news, politics
- Entertainment, sports, weather (unless asking about weather affecting appointments)

Customer query: "${query}"

Respond with ONLY valid JSON in this format:
{"inScope": true/false, "reason": "brief reason", "response": "polite response if out of scope"}

If IN SCOPE: {"inScope": true}
If OUT OF SCOPE: {"inScope": false, "reason": "personal question", "response": "I'm here to help with salon and spa services. Is there anything about our services, hours, or appointments I can help you with?"}`;

    const response = await groqChat(prompt);
    const parsed = JSON.parse(response.trim());

    return parsed.inScope
      ? { inScope: true }
      : {
          inScope: false,
          reason: parsed.reason || "out of scope",
          response:
            parsed.response ||
            "I'm here to help with salon and spa services. How can I assist you today?",
        };
  } catch (error) {
    console.error("[KB] Error checking scope:", error);
    // If scope check fails, assume in scope to avoid blocking valid queries
    return { inScope: true };
  }
}

export async function processQuery(
  query,
  participantId = null,
  roomName = null
) {
  try {
    // First, check if query is in scope for a salon/spa
    const scopeCheck = await checkQueryScope(query);

    if (!scopeCheck.inScope) {
      return {
        found: true,
        needsHelp: false,
        answer: scopeCheck.response,
        outOfScope: true,
      };
    }

    // Check if user wants to make a booking
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

    // Check if query contains multiple questions
    const multipleQuestions = await detectMultipleQuestions(query);

    if (multipleQuestions.isMultiple) {
      return await handleMultipleQuestions(
        multipleQuestions.questions,
        query,
        participantId,
        roomName
      );
    }

    // Single question - process normally
    return await processSingleQuery(query, participantId, roomName);
  } catch (error) {
    console.error("[KB] Error processing query:", error);
    return await handleUnknownQuery(query, participantId, roomName);
  }
}

/**
 * Detect if query contains multiple questions
 */
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

/**
 * Handle multiple questions intelligently
 */
async function handleMultipleQuestions(
  questions,
  originalQuery,
  participantId,
  roomName
) {
  const results = [];
  let unknownQuestions = [];

  // Process each question
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

  // Combine answers intelligently
  const knownAnswers = results.filter((r) => !r.needsHelp);

  if (knownAnswers.length === 0) {
    // All questions unknownreturn await handleUnknownQuery(originalQuery, participantId, roomName);
  }

  if (unknownQuestions.length > 0) {
    // Some known, some unknown// Create help request for unknown questions
    const unknownQuery = unknownQuestions.join(" ");
    const helpRequestData = await handleUnknownQuery(
      unknownQuery,
      participantId,
      roomName
    );

    // Combine known answers with escalation message
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

  // All questions knownconst combinedAnswer = await combineAnswers(knownAnswers, []);

  return {
    found: true,
    needsHelp: false,
    answer: combinedAnswer,
    outOfScope: false,
  };
}

/**
 * Process a single query
 */
async function processSingleQuery(
  query,
  participantId,
  roomName,
  skipHelp = false
) {
  try {
    // Generate embedding for the user's query
    const queryEmbedding = await generateEmbedding(query);

    // Search for similar questions in the knowledge base
    let similarQuestions = [];
    let error = null;

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "match_knowledge_base",
        {
          query_embedding: queryEmbedding,
          match_threshold: SIMILARITY_THRESHOLD,
          match_count: 3,
        }
      );
      similarQuestions = data || [];
      error = rpcError;
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
              queryLower.includes(queryLower) ||
              queryLower.split(" ").some((word) => questionLower.includes(word))
            );
          })
          .slice(0, 3);
      }
    }

    if (error && similarQuestions.length === 0) {
      if (skipHelp) {
        return { found: false, needsHelp: true, answer: null };
      }
      return await handleUnknownQuery(query, participantId, roomName);
    }

    let context = "";
    if (similarQuestions && similarQuestions.length > 0) {
      // Log similarity scores for debugging
      similarQuestions.forEach((item, i) => {
        const similarity = item.similarity || 0;
        // Similarity logged: ${similarity} - "${item.question.substring(0, 50)}..."
      });

      // Only use if similarity is high enough (above threshold)
      const topMatch = similarQuestions[0];
      const topSimilarity = topMatch.similarity || 0;

      if (topSimilarity < SIMILARITY_THRESHOLD) {
        // Similarity below threshold - escalating
        if (skipHelp) {
          return { found: false, needsHelp: true, answer: null };
        }
        return await handleUnknownQuery(query, participantId, roomName);
      }

      context = similarQuestions
        .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
        .join("\n\n");

      // Increment usage count
      await supabase
        .from("knowledge_base")
        .update({ times_used: (topMatch.times_used || 0) + 1 })
        .eq("id", topMatch.id);
    }

    // If no context found, escalate immediately
    if (!context || similarQuestions.length === 0) {
      if (skipHelp) {
        return { found: false, needsHelp: true, answer: null };
      }
      return await handleUnknownQuery(query, participantId, roomName);
    }

    // Use AI to generate response with strict instructions
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

    // Check if AI needs help
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

/**
 * Combine multiple answers into a natural response
 */
async function combineAnswers(knownAnswers, unknownQuestions) {
  try {
    const answersText = knownAnswers
      .map((r, i) => `Q: ${r.question}\nA: ${r.answer}`)
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
    // Store the question in help_requests table for supervisor to answer
    const { data, error } = await supabase
      .from("help_requests")
      .insert({
        question: query,
        caller_phone: participantId || "web-customer", // Required field
        session_id: roomName || `session-${Date.now()}`, // Required field
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
    // Generate embedding for the question
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
