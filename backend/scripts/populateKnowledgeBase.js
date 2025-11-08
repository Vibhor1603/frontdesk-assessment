import { storeQA } from "../src/services/knowledgeBase.js";

const INITIAL_SALON_QA = [
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
  {
    question: "Where are you located?",
    answer:
      "We're located at 123 Main St., Downtown. Free street parking is available nearby.",
  },
  {
    question: "How do I book an appointment?",
    answer:
      "You can book an appointment by calling us at (555) 123-4567 or via our website booking form.",
  },
  {
    question: "What services do you offer?",
    answer:
      "We offer haircuts, hair coloring, highlights, perms, blowouts, deep conditioning treatments, eyebrow shaping, and basic facial treatments.",
  },
  {
    question: "Do you offer hair coloring services?",
    answer:
      "Yes, we offer full hair coloring, highlights, lowlights, and color correction services. Prices start at $65 for basic color.",
  },
  {
    question: "Can I cancel or reschedule my appointment?",
    answer:
      "Yes, you can cancel or reschedule up to 24 hours before your appointment. Please call us at (555) 123-4567 to make changes.",
  },
  {
    question: "Do you have parking available?",
    answer:
      "Yes, we have free street parking available nearby. There's also a public parking garage two blocks away.",
  },
  {
    question: "What forms of payment do you accept?",
    answer:
      "We accept cash, credit cards (Visa, MasterCard, American Express), and digital payments like Apple Pay and Google Pay.",
  },
];

async function populateKnowledgeBase() {
  console.log("Starting to populate knowledge base...");

  try {
    for (let i = 0; i < INITIAL_SALON_QA.length; i++) {
      const qa = INITIAL_SALON_QA[i];
      await storeQA(qa.question, qa.answer);
      console.log(`✓ Added: ${qa.question}`);

      // Add delay between requests to avoid rate limiting
      if (i < INITIAL_SALON_QA.length - 1) {
        console.log("Waiting 2 seconds to avoid rate limits...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(
      `\n✅ Successfully populated knowledge base with ${INITIAL_SALON_QA.length} Q&A pairs!`
    );
  } catch (error) {
    console.error("❌ Error populating knowledge base:", error);
  }
}

// Run the script
populateKnowledgeBase();
