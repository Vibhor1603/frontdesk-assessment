import express from "express";
import {
  handleOAuthCallback,
  getConnectCalendar,
  createBooking,
} from "../controllers/booking/bookingController.js";

const router = express.Router();

router.get("/oauth2callback", handleOAuthCallback);
router.get("/connect-calendar", getConnectCalendar);
router.post("/create", createBooking);

export default router;
