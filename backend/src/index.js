import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import auth from "./core/routes/auth.js";
import voice from "./features/voice/routes/voice.js";
import knowledge from "./features/knowledge/routes/knowledge.js";
import supervisor from "./features/supervisor/routes/supervisor.js";
import agent from "./features/agent/routes/agent.js";
import webhooks from "./features/supervisor/routes/webhooks.js";
import bookings from "./features/booking/routes/bookings.js";
import { initializeDatabase } from "./core/db/supabase.js";
import { supabase } from "./core/db/supabase.js";
import { startAgent } from "./features/voice/services/livekitService.js";
import { initializeRealtimeSubscription } from "./features/supervisor/services/supervisorNotifications.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", auth);
app.use("/api/voice", voice);
app.use("/api/knowledge", knowledge);
app.use("/api/supervisor", supervisor);
app.use("/api/agent", agent);
app.use("/api/webhooks", webhooks);
app.use("/api/bookings", bookings);
app.use("/", bookings); // OAuth callback route at root level

// Initialize database
initializeDatabase().catch((error) => {
  console.error("Failed to initialize database:", error.message || error);
});

app.listen(port, async () => {
  // Initialize realtime subscription for supervisor dashboard
  initializeRealtimeSubscription();

  // Auto-start the audio agent
  try {
    await startAgent("customer-service");
  } catch (error) {
    console.error("Failed to start audio agent:", error);
  }
});

// Periodic job: mark pending help requests older than 15 minutes as unresolved
const PENDING_TIMEOUT_MINUTES = 15;
setInterval(async () => {
  try {
    const cutoff = new Date(
      Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000
    ).toISOString();
    const { error } = await supabase
      .from("help_requests")
      .update({ status: "unresolved" })
      .lt("created_at", cutoff)
      .eq("status", "pending");

    if (error) {
      console.error(
        "Error updating stale help requests:",
        error.message || error
      );
    } else {
      //");
    }
  } catch (e) {
    console.error("Error in pending-request cleanup job:", e.message || e);
  }
}, 60 * 1000); // run every minute
