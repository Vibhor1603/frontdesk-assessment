import { storeQA } from "../../src/features/knowledge/services/knowledgeBase.js";

const INITIAL_SALON_QA = [
  {
    question: "What are your hours?",
    answer:
      "We're open Monday-Saturday 9am-8pm, and Sunday 10am-6pm. We're closed on major holidays.",
  },
  {
    question: "Do you take walk-ins?",
    answer:
      "Yes, we accept walk-ins based on availability. However, we recommend booking an appointment to guarantee your preferred time slot.",
  },
  {
    question: "What services do you offer?",
    answer:
      "We offer haircuts, coloring, highlights, balayage, keratin treatments, blowouts, styling, manicures, pedicures, gel nails, acrylic nails, facials, waxing, and massage services.",
  },
  {
    question: "How much does a haircut cost?",
    answer:
      "Our haircut prices range from $45-$85 depending on the stylist level and hair length. Women's cuts start at $65, men's cuts at $45.",
  },
  {
    question: "Do you offer color services?",
    answer:
      "Yes! We offer full color, highlights, balayage, ombre, color correction, and toning services. Prices start at $85 and vary based on hair length and technique.",
  },
  {
    question: "Can I book online?",
    answer:
      "Yes, you can book appointments online through our website or by calling us at (555) 123-4567.",
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "We require 24 hours notice for cancellations or rescheduling. Late cancellations or no-shows may be subject to a fee.",
  },
  {
    question: "Do you offer bridal services?",
    answer:
      "Yes, we offer bridal packages including hair, makeup, and nail services. We recommend booking a trial session 2-3 months before your wedding date.",
  },
  {
    question: "What products do you use?",
    answer:
      "We use professional salon brands including Redken, Olaplex, Moroccan Oil, OPI, and CND for the best results.",
  },
  {
    question: "Do you have parking?",
    answer:
      "Yes, we have free parking available in our lot behind the building. Street parking is also available.",
  },
];

async function populateKnowledgeBase() {
  try {
    for (const qa of INITIAL_SALON_QA) {
      await storeQA(qa.question, qa.answer);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limiting
    }
  } catch (error) {
    console.error("Error populating knowledge base:", error);
  }
}

populateKnowledgeBase();
