import { google } from "googleapis";
import { supabase } from "../db/supabase.js";
import dotenv from "dotenv";

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback"
);

// Load tokens from database on startup
let tokensLoaded = false;

async function loadTokensFromDatabase() {
  try {
    const { data, error } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No tokens found - not an error
        console.log("[Google Calendar] No tokens found in database");
        return null;
      }
      throw error;
    }

    if (data) {
      const tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        scope: data.scope,
        token_type: data.token_type,
        expiry_date: data.expiry_date,
      };

      oauth2Client.setCredentials(tokens);
      console.log("[Google Calendar] ✅ Tokens loaded from database");
      return tokens;
    }

    return null;
  } catch (error) {
    console.error("[Google Calendar] Error loading tokens:", error);
    return null;
  }
}

async function saveTokensToDatabase(tokens) {
  try {
    const { error } = await supabase.from("google_calendar_tokens").upsert(
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date,
      },
      {
        onConflict: "id",
      }
    );

    if (error) throw error;

    console.log("[Google Calendar] ✅ Tokens saved to database");
    return true;
  } catch (error) {
    console.error("[Google Calendar] Error saving tokens:", error);
    return false;
  }
}

export function getAuthUrl() {
  const scopes = ["https://www.googleapis.com/auth/calendar"];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
}

export async function setTokens(authTokens) {
  oauth2Client.setCredentials(authTokens);
  await saveTokensToDatabase(authTokens);
}

export async function getTokens() {
  if (!tokensLoaded) {
    await loadTokensFromDatabase();
    tokensLoaded = true;
  }

  return oauth2Client.credentials;
}

async function ensureValidTokens() {
  // Load tokens if not already loaded
  if (!tokensLoaded) {
    await loadTokensFromDatabase();
    tokensLoaded = true;
  }

  const credentials = oauth2Client.credentials;

  if (!credentials || !credentials.access_token) {
    throw new Error(
      "Google Calendar not connected. Please authenticate first."
    );
  }

  // Check if token is expired and refresh if needed
  if (credentials.expiry_date && credentials.expiry_date < Date.now()) {
    console.log("[Google Calendar] Token expired, refreshing...");
    try {
      const { credentials: newCredentials } =
        await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(newCredentials);
      await saveTokensToDatabase(newCredentials);
      console.log("[Google Calendar] ✅ Token refreshed");
    } catch (error) {
      console.error("[Google Calendar] Failed to refresh token:", error);
      throw new Error("Failed to refresh Google Calendar token");
    }
  }

  return true;
}

export async function createCalendarEvent(bookingDetails) {
  try {
    await ensureValidTokens();

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const {
      customerName,
      customerEmail,
      service,
      appointmentDate,
      appointmentTime,
      durationMinutes = 60,
      notes,
    } = bookingDetails;

    // Combine date and time
    const startDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    const endDateTime = new Date(
      startDateTime.getTime() + durationMinutes * 60000
    );

    const event = {
      summary: `${service} - ${customerName}`,
      description: `
Appointment Details:
- Service: ${service}
- Customer: ${customerName}
- Email: ${customerEmail}
${notes ? `- Notes: ${notes}` : ""}

Booked via Luxe Salon & Spa AI Assistant
      `.trim(),
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "America/New_York",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "America/New_York",
      },
      attendees: [{ email: customerEmail }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 60 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      sendUpdates: "all",
    });

    console.log("[Google Calendar] ✅ Event created:", response.data.id);

    return {
      success: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
    };
  } catch (error) {
    console.error("[Google Calendar] ❌ Error creating event:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function updateCalendarEvent(eventId, updates) {
  try {
    await ensureValidTokens();

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const response = await calendar.events.patch({
      calendarId: "primary",
      eventId: eventId,
      resource: updates,
      sendUpdates: "all",
    });

    return {
      success: true,
      eventId: response.data.id,
    };
  } catch (error) {
    console.error("[Google Calendar] Error updating event:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function cancelCalendarEvent(eventId) {
  try {
    await ensureValidTokens();

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    await calendar.events.delete({
      calendarId: "primary",
      eventId: eventId,
      sendUpdates: "all",
    });

    return { success: true };
  } catch (error) {
    console.error("[Google Calendar] Error cancelling event:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Initialize tokens on module load
loadTokensFromDatabase();

export { oauth2Client };
