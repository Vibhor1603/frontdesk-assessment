import { handleVoiceData } from "../src/services/voiceService.js";

async function testVoiceProcessing() {
  console.log("🧪 Testing Voice Processing...\n");

  // Simulate voice data (placeholder)
  const mockAudioData = Buffer.from("mock audio data");

  try {
    const result = await handleVoiceData(
      "test-room",
      "test-user",
      mockAudioData
    );

    console.log("✅ Voice Processing Result:");
    console.log(`📝 Type: ${result.type}`);
    console.log(`💬 Text: "${result.text}"`);
    console.log(
      `🔊 Audio: ${result.audio ? "Generated successfully" : "Not generated"}`
    );
    console.log(`🆘 Help Request ID: ${result.helpRequestId || "None"}`);

    if (result.audio) {
      console.log(`📊 Audio size: ${result.audio.length} characters`);
    }
  } catch (error) {
    console.log("❌ Voice Processing Error:");
    console.log(error.message);
  }
}

testVoiceProcessing();
