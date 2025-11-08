import { useState, useRef, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import VoiceInput from "./VoiceInput";
import toast, { Toaster } from "react-hot-toast";

function ConnectionStateLabel() {
  try {
    const state = useConnectionState();
    return (
      <div className="text-center text-sm text-white/60 mb-6">
        {state === "connected" ? "🟢 Connected" : "Connecting..."}
      </div>
    );
  } catch {
    return null;
  }
}

// Component that runs inside LiveKitRoom context
function RoomContent({ participantIdRef, onMessage, setParticipantId }) {
  const room = useRoomContext();
  const [hasNotified, setHasNotified] = useState(false);

  // Note: We don't use LiveKit data channel because server-to-client
  // data messages don't work with useDataChannel() hook.
  // Instead, we return responses via HTTP which is simpler and more reliable.

  // Notify backend when connected (only once)
  useEffect(() => {
    // Strict check to prevent multiple calls
    if (!room || !room.localParticipant || hasNotified) {
      return;
    }

    // Mark as notified immediately to prevent race conditions
    setHasNotified(true);

    // Wait a bit for participant identity to be set by LiveKit
    const timer = setTimeout(async () => {
      const participant = room.localParticipant;

      // Try multiple ways to get participant ID
      let participantId = participant.identity;

      if (!participantId || participantId === "") {
        participantId = participant.sid;
      }

      if (!participantId || participantId === "") {
        participantId = `customer-${Date.now()}`;
      }

      participantIdRef.current = participantId;
      setParticipantId(participantId);

      console.log("✅ Connected! Participant ID:", participantId);

      try {
        // Notify backend and get greeting
        const response = await fetch(
          "http://localhost:3000/api/webhooks/participant-joined",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              participantId,
              participantName: participantId,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log("✅ Received greeting from agent");

          // Display and play greeting
          if (data.message) {
            onMessage(data.message);
          }
        } else {
          const errorText = await response.text();
          console.error(
            "❌ Failed to get greeting:",
            response.status,
            errorText
          );
          toast.error("Failed to connect to AI receptionist");
        }
      } catch (error) {
        console.error("❌ Error getting greeting:", error);
        toast.error("Connection error. Please try again.");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [room, hasNotified, participantIdRef, setParticipantId, onMessage]);

  return null;
}

export default function VoiceCall() {
  const [token, setToken] = useState("");
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [participantId, setParticipantId] = useState(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const participantIdRef = useRef(null);
  const audioRef = useRef(null);

  const connectToRoom = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      const response = await fetch("http://localhost:3000/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: "customer-service",
          participantName: `customer-${Date.now()}`,
        }),
      });

      if (!response.ok) throw new Error("Failed to get room token");
      const data = await response.json();
      setToken(data.token);
    } catch (err) {
      setError(err.message);
      console.error("Error connecting to voice room:", err);
      toast.error("Failed to connect. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAgentMessage = (message) => {
    // Add agent message to chat
    setMessages((prev) => [
      ...prev,
      {
        text: message.text,
        source: "agent",
        timestamp: Date.now(),
      },
    ]);

    // Play audio if provided
    if (message.audio) {
      console.log("🔊 Playing audio response");
      const audio = new Audio(message.audio);
      audioRef.current = audio;

      audio.onplay = () => setIsAgentSpeaking(true);
      audio.onended = () => setIsAgentSpeaking(false);
      audio.onerror = () => {
        setIsAgentSpeaking(false);
        toast.error("Audio playback failed");
      };

      audio.play().catch((err) => {
        console.error("Error playing audio:", err);
        setIsAgentSpeaking(false);
        toast.error("Could not play audio");
      });
    }
  };

  const sendMessage = async (messageText = null) => {
    const userMessage = messageText || inputText.trim();

    if (!userMessage) {
      console.log("Empty message, not sending");
      return;
    }

    const participantId = participantIdRef.current || `customer-${Date.now()}`;

    console.log("Sending message:", userMessage);
    setInputText("");

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      { text: userMessage, source: "user", timestamp: Date.now() },
    ]);

    try {
      // Send to backend and get response
      const response = await fetch(
        "http://localhost:3000/api/webhooks/customer-input",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: userMessage,
            participantId: participantId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Received response from agent");

      // Display and play response
      if (data.message) {
        handleAgentMessage(data.message);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      setMessages((prev) => [
        ...prev,
        {
          text: "Failed to send message. Please try again.",
          source: "system",
          timestamp: Date.now(),
        },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <Toaster position="top-right" />

      <div className="max-w-4xl w-full">
        {error ? (
          <div className="text-center space-y-4">
            <p className="text-red-400">{error}</p>
            <button
              className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-lg text-white rounded-2xl transition-all"
              onClick={() => setError(null)}
            >
              Try Again
            </button>
          </div>
        ) : !token ? (
          <div className="text-center">
            <button
              className={`px-12 py-6 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white rounded-3xl transition-all inline-flex items-center text-xl font-light border border-white/10 ${
                isConnecting ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={connectToRoom}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-7 h-7 mr-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                  <span>Talk to AI Receptionist</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <LiveKitRoom
            token={token}
            serverUrl={import.meta.env.VITE_LIVEKIT_URL}
            connect={true}
            video={false}
            audio={true}
          >
            {/* Room content component that uses hooks */}
            <RoomContent
              participantIdRef={participantIdRef}
              onMessage={handleAgentMessage}
              setParticipantId={setParticipantId}
            />

            <div className="space-y-8">
              <RoomAudioRenderer />
              <ConnectionStateLabel />

              {/* Audio Visualizer */}
              <div className="flex justify-center">
                {isAgentSpeaking ? (
                  <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 w-full border border-white/10">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="flex space-x-1">
                        {[...Array(20)].map((_, i) => (
                          <div
                            key={i}
                            className="bg-gradient-to-t from-indigo-500 to-purple-500 rounded-full animate-pulse"
                            style={{
                              width: "4px",
                              height: `${Math.random() * 40 + 20}px`,
                              animationDelay: `${i * 0.05}s`,
                              animationDuration: "0.8s",
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-white/60 text-sm ml-4">
                        AI is speaking...
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 w-full border border-white/10">
                    <div className="text-center text-white/40 text-sm">
                      Ready to listen
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Messages */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 min-h-[400px] max-h-[500px] overflow-y-auto space-y-4 border border-white/10">
                {messages.length === 0 ? (
                  <div className="text-center text-white/40 py-12">
                    <div className="animate-pulse">
                      Waiting for AI receptionist...
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        msg.source === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-5 py-3 backdrop-blur-xl ${
                          msg.source === "user"
                            ? "bg-indigo-500/30 text-white border border-indigo-400/30"
                            : msg.source === "agent"
                            ? "bg-white/10 text-white border border-white/20"
                            : "bg-white/5 text-white/60 border border-white/10"
                        }`}
                      >
                        <div className="text-xs opacity-60 mb-1">
                          {msg.source === "user"
                            ? "You"
                            : msg.source === "agent"
                            ? "AI Receptionist"
                            : "System"}
                        </div>
                        <div>{msg.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <VoiceInput
                onVoiceInput={(text) => {
                  sendMessage(text);
                }}
                onTextInput={(text) => {
                  setInputText(text);
                }}
                inputText={inputText}
                onSend={sendMessage}
                disabled={false}
              />
            </div>
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}
