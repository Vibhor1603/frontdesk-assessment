import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import auth from "./routes/auth.js";
import voice from "./routes/voice.js";
import knowledge from "./routes/knowledge.js";
import supervisor from "./routes/supervisor.js";
import agent from "./routes/agent.js";
import webhooks from "./routes/webhooks.js";
import bookings from "./routes/bookings.js";
import { initializeDatabase } from "./db/supabase.js";
import { supabase } from "./db/supabase.js";
import { startAgent } from "./services/audioAgent.js";
import { initializeRealtimeSubscription } from "./services/supervisorNotifications.js";

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
app.use("/oauth2callback", bookings); // OAuth callback route

// Initialize database
initializeDatabase().catch((error) => {
  console.error("Failed to initialize database:", error.message || error);
});

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);

  // Initialize realtime subscription for supervisor dashboard
  initializeRealtimeSubscription();

  // Auto-start the audio agent
  try {
    console.log("Starting audio agent with RAG/KB...");
    await startAgent("customer-service");
    console.log("✅ Audio agent started successfully");
  } catch (error) {
    console.error("Failed to start audio agent:", error);
    console.log("You can manually start it via POST /api/agent/start");
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
      // console.log("Stale help requests marked unresolved (if any)");
    }
  } catch (e) {
    console.error("Error in pending-request cleanup job:", e.message || e);
  }
}, 60 * 1000); // run every minute
