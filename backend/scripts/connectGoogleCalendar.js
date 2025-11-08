import fetch from "node-fetch";

async function connectGoogleCalendar() {try {
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
    }} catch (error) {
    console.error("❌ Error:", error.message);
    console.error("\nMake sure backend is running: npm start");
    process.exit(1);
  }
}

connectGoogleCalendar();
