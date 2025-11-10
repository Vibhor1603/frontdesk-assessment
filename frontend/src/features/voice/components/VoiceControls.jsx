export function VoiceControls({
  isListening,
  onToggleMicrophone,
  onToggleChat,
  onDisconnect,
}) {
  return (
    <div className="w-full flex items-center justify-center gap-6 sm:gap-8 lg:gap-12 mt-8 sm:mt-12 lg:mt-16 mb-4 sm:mb-8">
      <button
        className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all flex items-center justify-center"
        onClick={onToggleChat}
        aria-label="Toggle chat input"
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
        onClick={onToggleMicrophone}
        aria-label={isListening ? "Stop listening" : "Start listening"}
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
        onClick={onDisconnect}
        aria-label="Disconnect"
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
  );
}
