import LiveKitVoiceChat from "./components/LiveKitVoiceChat";
import SupervisorDashboard from "./components/SupervisorDashboard";

function App() {
  // Simple routing based on URL path
  const path = window.location.pathname;

  if (path === "/supervisor" || path === "/supervisor/") {
    return <SupervisorDashboard />;
  }

  // Default: customer voice interface with LiveKit real-time audio streaming
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <LiveKitVoiceChat />
    </div>
  );
}

export default App;
