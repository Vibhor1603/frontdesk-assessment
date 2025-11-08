import { useState, useEffect, useRef } from "react";

export default function VoiceInput({
  onVoiceInput,
  onTextInput,
  inputText,
  onSend,
  disabled,
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check if Web Speech API is supported
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);

      // Initialize speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        console.log("🎤 Listening...");
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("📝 Transcribed:", transcript);

        // Send voice input directly
        if (onVoiceInput && transcript.trim()) {
          onVoiceInput(transcript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);

        // Handle specific errors
        if (event.error === "not-allowed") {
          alert(
            "Microphone access denied. Please allow microphone access in your browser settings."
          );
        } else if (event.error === "no-speech") {
          console.log("No speech detected, try speaking again");
        } else if (event.error === "network") {
          console.log("Network error - Web Speech API unavailable");
          // Don't auto-retry to avoid infinite loop
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        console.log("🎤 Stopped listening");
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening, onVoiceInput]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Could not start speech recognition:", error);
        alert(
          "Speech recognition is not available. Please type your question instead."
        );
      }
    }
  };

  return (
    <div className="flex gap-3">
      {/* Voice button */}
      {isSupported && (
        <button
          onClick={toggleListening}
          disabled={disabled}
          className={`px-5 py-4 rounded-2xl transition-all backdrop-blur-xl border ${
            isListening
              ? "bg-red-500/20 border-red-400/30 text-red-300 animate-pulse"
              : "bg-white/10 border-white/20 text-white hover:bg-white/20"
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title={isListening ? "Stop listening" : "Click to speak"}
        >
          {isListening ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
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
          )}
        </button>
      )}

      {/* Text input */}
      <input
        type="text"
        value={inputText}
        onChange={(e) => onTextInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={
          isListening ? "Listening..." : "Type or click mic to speak..."
        }
        className="flex-1 bg-white/10 backdrop-blur-xl text-white rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/20 placeholder-white/40"
        disabled={disabled || isListening}
      />

      {/* Send button */}
      <button
        onClick={() => onSend()}
        disabled={!inputText.trim() || disabled}
        className="px-8 py-4 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 hover:from-indigo-500/40 hover:to-purple-500/40 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl transition-all backdrop-blur-xl border border-indigo-400/30 font-light"
      >
        Send
      </button>
    </div>
  );
}
