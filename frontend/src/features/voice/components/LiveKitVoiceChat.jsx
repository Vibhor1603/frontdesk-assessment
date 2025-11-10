import { useState, useRef, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import toast, { Toaster } from "react-hot-toast";
import { showEmailToast } from "../../notifications/components/EmailToast";
import { useDeepgramSTT } from "../hooks/useDeepgramSTT";

function AudioVisualizer({ isListening }) {
  const tracks = useTracks([Track.Source.Microphone], {
    onlySubscribed: true,
  });
  const [barHeights, setBarHeights] = useState([]);

  useEffect(() => {
    const barCount = 80;
    const interval = setInterval(() => {
      const newHeights = Array.from({ length: barCount }, (_, i) => {
        const position = i / barCount;
        const wave =
          Math.sin(Date.now() / 300 + position * Math.PI * 4) * 0.5 + 0.5;
        const randomFactor = Math.random() * 0.4 + 0.6;

        if (isListening || tracks.length > 0) {
          return 4 + wave * 50 * randomFactor;
        }
        return 4 + Math.random() * 15;
      });
      setBarHeights(newHeights);
    }, 50);

    return () => clearInterval(interval);
  }, [isListening, tracks]);

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl"></div>
      <div className="relative w-full h-full">
        {barHeights.map((height, i) => {
          const angle = (i / barHeights.length) * 360;
          const radius = 90;
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;

          return (
            <div
              key={i}
              className="absolute w-1 bg-gradient-to-t from-blue-400 via-purple-500 to-pink-400 rounded-full transition-all duration-100"
              style={{
                height: `${height}px`,
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                transformOrigin: "center bottom",
                opacity: isListening || tracks.length > 0 ? 0.9 : 0.4,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function RoomContent({ participantIdRef, onMessage, setParticipantId }) {
  const room = useRoomContext();
  const [hasNotified, setHasNotified] = useState(false);

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
          console.error("Failed to get greeting:", response.status);
          toast.error("Failed to connect to AI receptionist");
        }
      } catch (error) {
        console.error("Error getting greeting:", error);
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
  const [messages, setMessages] = useState([]);
  const [, setParticipantId] = useState(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [showChatInput, setShowChatInput] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const participantIdRef = useRef(null);
  const audioRef = useRef(null);

  // Deepgram hook must be called at the top level
  const handleTranscript = (transcript) => {
    console.log("[Voice] Received transcript:", transcript);
    sendMessage(transcript);
  };

  const { isListening, startListening, stopListening, interimText } =
    useDeepgramSTT(handleTranscript);

  const connectToRoom = async () => {
    try {
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
      setIsConnected(true);
    } catch (err) {
      setError(err.message);
      console.error("Error connecting to voice room:", err);
      toast.error("Failed to connect. Please try again.");
    }
  };

  const handleAgentMessage = (message) => {
    setMessages((prev) => [
      ...prev,
      { text: message.text, source: "agent", timestamp: Date.now() },
    ]);

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

  const sendMessage = async (messageText) => {
    const userMessage = messageText.trim();
    if (!userMessage) return;

    const participantId = participantIdRef.current || `customer-${Date.now()}`;
    setChatMessage("");
    setShowChatInput(false);

    setMessages((prev) => [
      ...prev,
      { text: userMessage, source: "user", timestamp: Date.now() },
    ]);

    try {
      const response = await fetch(
        "http://localhost:3000/api/webhooks/customer-input",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: userMessage, participantId }),
        }
      );

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      if (data.message) {
        handleAgentMessage(data.message);
      }

      if (data.message?.requiresBooking) {
        const { showBookingToast } = await import(
          "../../booking/components/BookingToast.jsx"
        );
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
              }
            } catch (error) {
              console.error("Booking error:", error);
              toast.error("Failed to create booking");
            }
          }
        });
      }

      if (data.message?.needsEmail) {
        showEmailToast(async (email) => {
          if (email) {
            try {
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

  const toggleMicrophone = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    connectToRoom();
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 lg:p-12">
      <Toaster position="top-center" />

      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <button
            className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white transition-all flex items-center justify-center"
            onClick={() => {
              setError(null);
              connectToRoom();
            }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      ) : !isConnected ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-light tracking-wide text-center">
            Welcome to Luxe Salon
          </h1>
          <button
            className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white rounded-full transition-all text-lg"
            onClick={connectToRoom}
          >
            Start Voice Chat
          </button>
        </div>
      ) : !token ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400"></div>
        </div>
      ) : (
        <LiveKitRoom
          token={token}
          serverUrl={import.meta.env.VITE_LIVEKIT_URL}
          connect={true}
          video={false}
          audio={true}
          className="w-full h-full flex flex-col max-w-7xl mx-auto"
        >
          <RoomContent
            participantIdRef={participantIdRef}
            onMessage={handleAgentMessage}
            setParticipantId={setParticipantId}
          />
          <RoomAudioRenderer />

          <div className="w-full flex items-center justify-between mb-8 sm:mb-12 lg:mb-16">
            <button
              className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all flex items-center justify-center"
              onClick={() => {
                stopListening();
                setToken("");
                setMessages([]);
                setIsConnected(false);
              }}
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <button className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center w-full space-y-8 sm:space-y-12 lg:space-y-16">
            <h2 className="text-white text-xl sm:text-2xl md:text-3xl lg:text-4xl font-light tracking-wide">
              {isAgentSpeaking
                ? "Maia is speaking.."
                : isListening
                ? "Listening..."
                : "Maia is listening.."}
            </h2>

            <AudioVisualizer isListening={isListening} />

            {/* Show interim text while listening */}
            {isListening && interimText && (
              <div className="w-full px-4 sm:px-8 max-w-2xl">
                <p className="text-purple-400/60 text-center text-base sm:text-lg italic">
                  "{interimText}"
                </p>
              </div>
            )}

            {/* Show last message */}
            {messages.length > 0 && !interimText && (
              <div className="w-full px-4 sm:px-8 max-w-2xl">
                <p className="text-white/80 text-center text-base sm:text-lg md:text-xl leading-relaxed">
                  {messages[messages.length - 1].text}
                </p>
              </div>
            )}
          </div>

          <div className="w-full flex items-center justify-center gap-6 sm:gap-8 lg:gap-12 mt-8 sm:mt-12 lg:mt-16 mb-4 sm:mb-8">
            <button
              className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all flex items-center justify-center"
              onClick={() => setShowChatInput(!showChatInput)}
            >
              <svg
                className="w-6 h-6 lg:w-8 lg:h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </button>

            <button
              className={`w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full backdrop-blur-xl hover:bg-white/15 transition-all flex items-center justify-center shadow-lg shadow-purple-500/20 ${
                isListening ? "bg-purple-500/30" : "bg-white/10"
              }`}
              onClick={toggleMicrophone}
            >
              <svg
                className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>

            <button
              className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all flex items-center justify-center"
              onClick={() => {
                stopListening();
                setToken("");
                setMessages([]);
                setIsConnected(false);
              }}
            >
              <svg
                className="w-6 h-6 lg:w-8 lg:h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {showChatInput && (
            <div className="w-full max-w-2xl mx-auto mt-4 mb-4">
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-4 flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(chatMessage);
                    }
                  }}
                  placeholder="Type your message..."
                  className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  autoFocus
                />
                <button
                  onClick={() => sendMessage(chatMessage)}
                  disabled={!chatMessage.trim()}
                  className="px-6 py-3 bg-purple-500/30 hover:bg-purple-500/40 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-2xl transition-all"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </LiveKitRoom>
      )}
    </div>
  );
}
