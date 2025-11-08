import {
  startAgent,
  getAgent,
  stopAgent,
} from "../src/services/livekitAgent.js";

async function testAgent() {
  console.log("=== LiveKit Agent Test ===\n");

  try {
    // Start the agent
    console.log("1. Starting agent...");
    const agent = await startAgent("customer-service");
    console.log("✓ Agent started successfully\n");

    // Check status
    console.log("2. Checking agent status...");
    const status = agent.getStatus();
    console.log("Status:", JSON.stringify(status, null, 2));
    console.log("✓ Agent is running\n");

    // Wait a bit
    console.log("3. Agent is now listening for customers...");
    console.log("   - Customers can join the room via the frontend");
    console.log("   - Agent will greet them automatically");
    console.log("   - Agent will respond to their questions\n");

    console.log("Press Ctrl+C to stop the agent and exit");

    // Keep the script running
    process.on("SIGINT", async () => {
      console.log("\n\nStopping agent...");
      await stopAgent();
      console.log("✓ Agent stopped");
      process.exit(0);
    });

    // Keep alive
    setInterval(() => {
      const currentStatus = getAgent()?.getStatus();
      if (currentStatus) {
        console.log(
          `[${new Date().toLocaleTimeString()}] Agent status:`,
          `Connected: ${currentStatus.connected}, `,
          `Participants: ${currentStatus.participantCount}, `,
          `Pending requests: ${currentStatus.pendingRequests}`
        );
      }
    }, 30000); // Log every 30 seconds
  } catch (error) {
    console.error("Error testing agent:", error);
    process.exit(1);
  }
}

testAgent();
