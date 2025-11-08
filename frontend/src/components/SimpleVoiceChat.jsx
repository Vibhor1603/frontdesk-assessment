import { useState, useRef, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";

export default function SimpleVoiceChat() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("📝 Transcribed:", transcript);
        sendMessage(transcript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          toast.error("Microphone access denied");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Get greeting on mount
  useEffect(() => {
    if (!isConnected) {
      connectAndGreet();
    }
  }, []);

  const connectAndGreet = async () => {
    try {
      const participantId = `customer-${Date.now()}`;

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
        setIsConnected(true);

        if (data.message) {
          displayAndPlayMessage(data.message);
        }
      } else {
        toast.error("Failed to connect to AI");
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Connection failed");
    }
  };

  const displayAndPlayMessage = (message) => {
    // Add to chat
    setMessages((prev) => [
      ...prev,
      {
        text: message.text,
        source: "agent",
        timestamp: Date.now(),
      },
    ]);

    // Play audio
    if (message.audio) {
      const audio = new Audio(message.audio);
      audioRef.current = audio;

      audio.onplay = () => setIsAgentSpeaking(true);
      audio.onended = () => setIsAgentSpeaking(false);
      audio.onerror = () => setIsAgentSpeaking(false);

      audio.play().catch((err) => {
        console.error("Audio error:", err);
        setIsAgentSpeaking(false);
      });
    }
  };

  const sendMessage = async (messageText = null) => {
    const userMessage = messageText || inputText.trim();

    if (!userMessage) return;

    setInputText("");

    // Add user message
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
          body: JSON.stringify({
            text: userMessage,
            participantId: `customer-${Date.now()}`,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.message) {
          displayAndPlayMessage(data.message);
        }
      } else {
        toast.error("Failed to get response");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to send message");
    }
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        toast.error("Could not start voice input");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <Toaster position="top-right" />

      <div className="max-w-4xl w-full space-y-8">
        {/* Status */}
        <div className="text-center text-white/60 text-sm">
          {isConnected ? "🟢 Connected" : "Connecting..."}
        </div>

        {/* Visualizer */}
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

        {/* Chat */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 min-h-[400px] max-h-[500px] overflow-y-auto space-y-4 border border-white/10">
          {messages.length === 0 ? (
            <div className="text-center text-white/40 py-12 animate-pulse">
              Waiting for AI receptionist...
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
                      : "bg-white/10 text-white border border-white/20"
                  }`}
                >
                  <div className="text-xs opacity-60 mb-1">
                    {msg.source === "user" ? "You" : "AI Receptionist"}
                  </div>
                  <div>{msg.text}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="flex gap-3">
          {/* Voice button */}
          <button
            onClick={toggleVoice}
            className={`px-5 py-4 rounded-2xl transition-all backdrop-blur-xl border ${
              isListening
                ? "bg-red-500/20 border-red-400/30 text-red-300 animate-pulse"
                : "bg-white/10 border-white/20 text-white hover:bg-white/20"
            }`}
          >
            <svg
              className="w-5 h-5"
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

          {/* Text input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={isListening ? "Listening..." : "Type your question..."}
            className="flex-1 bg-white/10 backdrop-blur-xl text-white rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/20 placeholder-white/40"
            disabled={isListening}
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
            disabled={!inputText.trim()}
            className="px-8 py-4 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 hover:from-indigo-500/40 hover:to-purple-500/40 disabled:opacity-30 text-white rounded-2xl transition-all backdrop-blur-xl border border-indigo-400/30"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
