import express from "express";
import {
  getHelpRequests,
  submitAnswer,
  getLearnedAnswers,
  getStats,
  getKnowledgeBase,
  createKnowledgeBaseItem,
  updateKnowledgeBaseItem,
  deleteKnowledgeBaseItem,
} from "../controllers/supervisor/supervisorController.js";

const router = express.Router();

router.get("/help-requests", getHelpRequests);
router.post("/help-requests/:id/answer", submitAnswer);
router.get("/learned-answers", getLearnedAnswers);
router.get("/stats", getStats);
router.get("/knowledge-base", getKnowledgeBase);
router.post("/knowledge-base", createKnowledgeBaseItem);
router.put("/knowledge-base/:id", updateKnowledgeBaseItem);
router.delete("/knowledge-base/:id", deleteKnowledgeBaseItem);

export default router;
