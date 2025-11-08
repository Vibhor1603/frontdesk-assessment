import express from "express";

const router = express.Router();

// All knowledge routes have been removed as they are not used by the current frontend/admin dashboard
// Knowledge base queries are handled internally by the agent via livekitService and knowledgeBase services
// Help requests are managed through /api/supervisor routes
// QA storage is handled internally by the supervisor answer endpoint

export default router;
