import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function groqChat(input) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: input,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 512,
    });

    return chatCompletion.choices[0]?.message?.content || "NEED_HELP";
  } catch (error) {
    console.error("Error in Groq chat:", error);
    return "NEED_HELP";
  }
}
