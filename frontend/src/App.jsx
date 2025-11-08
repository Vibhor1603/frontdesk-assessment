import LiveKitVoiceChat from "./features/voice/components/LiveKitVoiceChat";

function App() {
  // Default: customer voice interface with LiveKit real-time audio streaming
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <LiveKitVoiceChat />
    </div>
  );
}

export default App;
