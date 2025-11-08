import fetch from "node-fetch";

async function testTTS() {
  console.log("🧪 Testing TTS endpoint...\n");

  const testText =
    "We are open Tuesday to Saturday from 9:00 AM to 7:00 PM, and Sunday 10:00 AM to 4:00 PM.";

  try {
    const response = await fetch("http://localhost:3000/api/voice/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: testText }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ TTS Response received:");
    console.log(`📝 Text: "${testText}"`);
    console.log(
      `🔊 Audio: ${data.audio ? "Generated successfully" : "Not generated"}`
    );
    console.log(
      `📊 Audio size: ${data.audio ? data.audio.length : 0} characters`
    );
  } catch (error) {
    console.log("❌ TTS Error:");
    console.log(error.message);
  }
}

async function testAskEndpoint() {
  console.log("\n🧪 Testing Ask endpoint (Knowledge Base + TTS)...\n");

  const testQuery = "What are your opening hours?";

  try {
    const response = await fetch("http://localhost:3000/api/voice/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: testQuery,
        participantId: "test-user",
        roomName: "test-room",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ Ask Response received:");
    console.log(`❓ Query: "${testQuery}"`);
    console.log(`📝 Answer: "${data.text}"`);
    console.log(
      `🔊 Audio: ${data.audio ? "Generated successfully" : "Not generated"}`
    );
    console.log(`📊 Found: ${data.found}`);
    console.log(`🆘 Needs Help: ${data.needsHelp}`);
  } catch (error) {
    console.log("❌ Ask Error:");
    console.log(error.message);
  }
}

// Run tests
console.log("Make sure your server is running on http://localhost:3000\n");
testTTS().then(() => testAskEndpoint());
