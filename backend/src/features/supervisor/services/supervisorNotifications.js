import { supabase } from "../../../core/db/supabase.js";

// Store active SSE connections
const connections = new Set();

/**
 * Add a new SSE connection
 */
export function addConnection(res) {
  connections.add(res);
}

/**
 * Remove an SSE connection
 */
export function removeConnection(res) {
  connections.delete(res);
}

/**
 * Broadcast update to all connected clients
 */
export function broadcastUpdate(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  connections.forEach((res) => {
    try {
      res.write(message);
    } catch (error) {
      console.error("[Supervisor] Error broadcasting to client:", error);
      connections.delete(res);
    }
  });
}

/**
 * Initialize Supabase realtime subscription for help_requests
 */
export function initializeRealtimeSubscription() {
  const channel = supabase
    .channel("help_requests_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "help_requests",
      },
      (payload) => {
        // Broadcast the change to all connected clients
        broadcastUpdate("help_request_change", {
          type: payload.eventType,
          record: payload.new || payload.old,
        });
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Subscription successful
      }
    });

  return channel;
}

/**
 * Get current stats
 */
export async function getStats() {
  const { data: requests, error } = await supabase
    .from("help_requests")
    .select("status");

  if (error) throw error;

  return {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    resolved: requests.filter((r) => r.status === "resolved").length,
    timeout: requests.filter((r) => r.status === "timeout").length,
  };
}
