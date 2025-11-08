import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

export async function generateEmbedding(text, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
          input: [text],
          model: "voyage-large-2",
        }),
      });

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoffawait new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Voyage API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      if (attempt === retries) {
        console.error("Error generating embedding after all retries:", error);
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export async function generateEmbeddings(texts) {
  try {
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: texts,
        model: "voyage-large-2",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Voyage API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.data.map((item) => item.embedding);
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}
