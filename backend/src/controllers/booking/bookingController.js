import { supabase } from "../../db/supabase.js";
import {
  getAuthUrl,
  setTokens,
  createCalendarEvent,
  oauth2Client,
} from "../../services/googleCalendarService.js";

export async function handleOAuthCallback(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("❌ No authorization code provided");
    }

    const { tokens } = await oauth2Client.getToken(code);
    await setTokens(tokens);
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
    res.status(500).send("❌ Failed to connect Google Calendar");
  }
}

export function getConnectCalendar(req, res) {
  const authUrl = getAuthUrl();
  res.json({ authUrl });
}

export async function createBooking(req, res) {
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
    } catch (calendarError) {}

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
    res.json({
      success: true,
      booking,
      calendarEventCreated: calendarResult.success,
      calendarEventLink: calendarResult.eventLink,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to create booking",
      details: error.message,
    });
  }
}
