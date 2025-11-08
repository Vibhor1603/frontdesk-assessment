import express from "express";
import { supabase } from "../db/supabase.js";
import {
  getAuthUrl,
  setTokens,
  createCalendarEvent,
  cancelCalendarEvent,
  oauth2Client,
} from "../services/googleCalendarService.js";

const router = express.Router();

// OAuth callback
router.get("/oauth2callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("❌ No authorization code provided");
    }

    const { tokens } = await oauth2Client.getToken(code);
    await setTokens(tokens);

    console.log("[OAuth] Google Calendar connected successfully");

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendar Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
            }
            h1 { color: #667eea; margin: 0 0 10px 0; }
            p { color: #666; margin: 10px 0; }
            .checkmark { font-size: 48px; color: #10b981; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✅</div>
            <h1>Google Calendar Connected!</h1>
            <p>You can now create bookings with calendar integration.</p>
            <p style="font-size: 14px; color: #999;">You may close this window.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("[OAuth] Error:", error);
    res.status(500).send("❌ Failed to connect Google Calendar");
  }
});

// Get auth URL
router.get("/connect-calendar", (req, res) => {
  const authUrl = getAuthUrl();
  res.json({ authUrl });
});

// Create booking
router.post("/create", async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      service,
      appointmentDate,
      appointmentTime,
      durationMinutes,
      notes,
      participantId,
      roomName,
    } = req.body;

    // Validate required fields
    if (
      !customerName ||
      !customerEmail ||
      !service ||
      !appointmentDate ||
      !appointmentTime
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        required: [
          "customerName",
          "customerEmail",
          "service",
          "appointmentDate",
          "appointmentTime",
        ],
      });
    }

    console.log("[Booking] Creating new booking:", {
      customerName,
      service,
      appointmentDate,
      appointmentTime,
    });

    // Create Google Calendar event (optional - continues if fails)
    let calendarResult = { success: false };
    try {
      calendarResult = await createCalendarEvent({
        customerName,
        customerEmail,
        service,
        appointmentDate,
        appointmentTime,
        durationMinutes: durationMinutes || 60,
        notes,
      });

      if (calendarResult.success) {
        console.log("[Booking] ✅ Google Calendar event created");
      } else {
        console.log(
          "[Booking] ⚠️ Google Calendar not connected (booking still created)"
        );
      }
    } catch (calendarError) {
      console.log(
        "[Booking] ⚠️ Google Calendar error (booking still created):",
        calendarError.message
      );
    }

    // Store in database
    const { data: booking, error: dbError } = await supabase
      .from("bookings")
      .insert({
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        service,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        duration_minutes: durationMinutes || 60,
        notes,
        status: "confirmed",
        google_calendar_event_id: calendarResult.eventId || null,
        participant_id: participantId,
        room_name: roomName,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    console.log("[Booking] ✅ Booking created:", booking.id);

    res.json({
      success: true,
      booking,
      calendarEventCreated: calendarResult.success,
      calendarEventLink: calendarResult.eventLink,
    });
  } catch (error) {
    console.error("[Booking] Error:", error);
    res.status(500).json({
      error: "Failed to create booking",
      details: error.message,
    });
  }
});

// Get all bookings
router.get("/", async (req, res) => {
  try {
    const { status, email, date } = req.query;

    let query = supabase
      .from("bookings")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (status) query = query.eq("status", status);
    if (email) query = query.eq("customer_email", email);
    if (date) query = query.eq("appointment_date", date);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("[Booking] Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Get single booking
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("[Booking] Error:", error);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// Cancel booking
router.post("/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Cancel Google Calendar event
    if (booking.google_calendar_event_id) {
      await cancelCalendarEvent(booking.google_calendar_event_id);
    }

    // Update database
    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log("[Booking] ✅ Booking cancelled:", id);

    res.json({
      success: true,
      booking: updated,
    });
  } catch (error) {
    console.error("[Booking] Error cancelling:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

export default router;
