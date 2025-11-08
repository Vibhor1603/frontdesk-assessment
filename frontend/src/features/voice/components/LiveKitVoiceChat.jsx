import { useState, useRef, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import toast, { Toaster } from "react-hot-toast";
import { showEmailToast } from "../../notifications/components/EmailToast";

function ConnectionStateLabel() {
  try {
    const state = useConnectionState();
    return (
      <div className="text-center text-sm text-white/60 mb-6">
        {state === "connected" ? "🟢 Connected to LiveKit" : "Connecting..."}
      </div>
    );
  } catch {
    return null;
  }
}

// Audio visualizer that responds to actual audio tracks
function AudioVisualizer() {
  const tracks = useTracks([Track.Source.Microphone], {
    onlySubscribed: true,
  });
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setIsPlaying(tracks.length > 0);
  }, [tracks]);

  if (isPlaying) {
    return (
      <div
        key={i}
        className="w-1 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-full transition-all duration-75"
        style={{ height: `${height}px` }}
      />
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 w-full border border-white/10">
      <div className="text-center text-white/40 text-sm">Ready to listen</div>
    </div>
  );
}

// Component that runs inside LiveKitRoom context
function RoomContent({ participantIdRef, onMessage, setParticipantId }) {
  const room = useRoomContext();
  const [hasNotified, setHasNotified] = useState(false);

  // Notify backend when connected (only once)
  useEffect(() => {
    if (!room || !room.localParticipant || hasNotified) {
      return;
    }

    setHasNotified(true);

    const timer = setTimeout(async () => {
      const participant = room.localParticipant;
      let participantId =
        participant.identity || participant.sid || `customer-${Date.now()}`;

      participantIdRef.current = participantId;
      setParticipantId(participantId);
      try {
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
          if (data.message) {
            onMessage(data.message);
          }
        } else {
          console.error("❌ Failed to get greeting:", response.status);
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

export default function LiveKitVoiceChat() {
  const [token, setToken] = useState("");
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [, setParticipantId] = useState(null);
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
      return;
    }

    const participantId = participantIdRef.current || `customer-${Date.now()}`;
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

      const data = await response.json(); // Display and play response FIRST (don't wait)
      if (data.message) {
        handleAgentMessage(data.message);
      }

      // Then check if booking is required (show form while audio plays)
      if (data.message?.requiresBooking) {
        const { showBookingToast } = await import(
          "../../booking/components/BookingToast.jsx"
        );

        // Show form (non-blocking - audio continues playing)
        showBookingToast(async (bookingData) => {
          if (bookingData) {
            try {
              const response = await fetch(
                "http://localhost:3000/api/bookings/create",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...bookingData,
                    participantId,
                    roomName: "customer-service",
                  }),
                }
              );

              const result = await response.json();

              if (result.success) {
                toast.success("Appointment booked successfully! 📅");
              } else {
                toast.error("Failed to book appointment");
                console.error("❌ Booking failed:", result.error);
              }
            } catch (error) {
              console.error("❌ Booking error:", error);
              toast.error("Failed to create booking");
            }
          }
        });
      }

      // Continue with other checks
      if (data.message) {
        // Check if email is needed
        if (data.message.needsEmail) {
          showEmailToast(async (email) => {
            if (email) {
              try {
                // Store email
                const emailResponse = await fetch(
                  "http://localhost:3000/api/agent/store-email",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      participantId,
                      email,
                      helpRequestId: data.message.helpRequestId,
                    }),
                  }
                );

                if (emailResponse.ok) {
                  toast.success(`Email saved! We'll notify you at ${email}`);
                } else {
                  toast.error("Failed to save email");
                }
              } catch (error) {
                console.error("Error storing email:", error);
                toast.error("Failed to save email");
              }
            }
          });
        }
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
            <p className="text-white/40 text-sm mt-4">
              Real-time audio streaming with LiveKit + RAG/KB
            </p>
          </div>
        ) : (
          <LiveKitRoom
            token={token}
            serverUrl={import.meta.env.VITE_LIVEKIT_URL}
            connect={true}
            video={false}
            audio={true}
          >
            <RoomContent
              participantIdRef={participantIdRef}
              onMessage={handleAgentMessage}
              setParticipantId={setParticipantId}
            />

            <div className="space-y-8">
              {/* LiveKit audio renderer for real-time audio */}
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

              {/* Text Input */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-4 border border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-white/10"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!inputText.trim()}
                    className="px-6 py-3 bg-indigo-500/30 hover:bg-indigo-500/40 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-2xl transition-all border border-indigo-400/30 disabled:border-white/10"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}
