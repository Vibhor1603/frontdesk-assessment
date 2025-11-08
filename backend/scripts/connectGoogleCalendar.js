import fetch from "node-fetch";

async function connectGoogleCalendar() {
  console.log("🔗 Connecting Google Calendar...\n");

  try {
    // Get auth URL
    const response = await fetch(
      "http://localhost:3000/api/bookings/connect-calendar"
    );
    const data = await response.json();

    if (!data.authUrl) {
      console.error("❌ Failed to get auth URL");
      console.error("Make sure:");
      console.error("  1. Backend is running");
      console.error("  2. GOOGLE_CLIENT_ID is in .env");
      console.error("  3. GOOGLE_CLIENT_SECRET is in .env");
      process.exit(1);
    }

    console.log("✅ Auth URL generated!\n");
    console.log("📋 COPY THIS URL AND OPEN IN YOUR BROWSER:\n");
    console.log(data.authUrl);
    console.log("\n");
    console.log("After authorizing, you'll be redirected to a success page.");
    console.log("Then Google Calendar will be connected! 🎉\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("\nMake sure backend is running: npm start");
    process.exit(1);
  }
}

connectGoogleCalendar();
