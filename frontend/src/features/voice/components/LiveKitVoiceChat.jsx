import { useState, useRef, useEffect } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import toast, { Toaster } from "react-hot-toast";
import { useDeepgramSTT } from "../hooks/useDeepgramSTT";
import { AudioVisualizer } from "./AudioVisualizer";
import { RoomConnection } from "./RoomConnection";
import { VoiceControls } from "./VoiceControls";
import { ChatInput } from "./ChatInput";
import {
  sendMessageToAgent,
  handleBookingRequest,
  handleEmailRequest,
} from "../utils/messageHandler";

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

  const handleTranscript = (transcript) => {
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

      audio.play().catch(() => {
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
      const data = await sendMessageToAgent(userMessage, participantId);

      if (data.message) {
        handleAgentMessage(data.message);
      }

      if (data.message?.requiresBooking) {
        const { showBookingToast } = await import(
          "../../booking/components/BookingToast.jsx"
        );
        showBookingToast(async (bookingData) => {
          if (bookingData) {
            await handleBookingRequest(participantId, bookingData);
          }
        });
      }

      if (data.message?.needsEmail) {
        await handleEmailRequest(participantId, data.message.helpRequestId);
      }
    } catch (error) {
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

  const handleDisconnect = () => {
    stopListening();
    setToken("");
    setMessages([]);
    setIsConnected(false);
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
            aria-label="Retry connection"
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
          <RoomConnection
            participantIdRef={participantIdRef}
            onMessage={handleAgentMessage}
            setParticipantId={setParticipantId}
          />
          <RoomAudioRenderer />

          <div className="w-full flex items-center justify-between mb-8 sm:mb-12 lg:mb-16">
            <button
              className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all flex items-center justify-center"
              onClick={handleDisconnect}
              aria-label="Go back"
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

            <button
              className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all flex items-center justify-center"
              aria-label="Menu"
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center w-full space-y-8 sm:space-y-12 lg:space-y-16">
            <h2 className="text-white text-xl sm:text-2xl md:text-3xl lg:text-4xl font-light tracking-wide">
              {isAgentSpeaking
                ? "Frontdesk Salon Agent is speaking..."
                : isListening
                ? "Listening..."
                : "Frontdesk Salon Agent is listening..."}
            </h2>

            <AudioVisualizer isListening={isListening} />

            {isListening && interimText && (
              <div className="w-full px-4 sm:px-8 max-w-2xl">
                <p className="text-purple-400/60 text-center text-base sm:text-lg italic">
                  "{interimText}"
                </p>
              </div>
            )}

            {messages.length > 0 && !interimText && (
              <div className="w-full px-4 sm:px-8 max-w-2xl">
                <p className="text-white/80 text-center text-base sm:text-lg md:text-xl leading-relaxed">
                  {messages[messages.length - 1].text}
                </p>
              </div>
            )}
          </div>

          <VoiceControls
            isListening={isListening}
            onToggleMicrophone={toggleMicrophone}
            onToggleChat={() => setShowChatInput(!showChatInput)}
            onDisconnect={handleDisconnect}
          />

          {showChatInput && (
            <ChatInput
              value={chatMessage}
              onChange={setChatMessage}
              onSend={() => sendMessage(chatMessage)}
              onClose={() => setShowChatInput(false)}
            />
          )}
        </LiveKitRoom>
      )}
    </div>
  );
}
