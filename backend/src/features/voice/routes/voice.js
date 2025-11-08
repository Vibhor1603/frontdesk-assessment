import express from "express";

const router = express.Router();

// All voice routes have been removed as they are not used by the frontend
// The frontend uses /api/webhooks/participant-joined and /api/webhooks/customer-input instead
// Token generation is handled by /api/auth/token

export default router;
