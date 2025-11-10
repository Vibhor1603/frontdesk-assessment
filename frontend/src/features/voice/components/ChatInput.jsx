export function ChatInput({ value, onChange, onSend, onClose }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 mb-4">
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-4 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          autoFocus
        />
        <button
          onClick={onSend}
          disabled={!value.trim()}
          className="px-6 py-3 bg-purple-500/30 hover:bg-purple-500/40 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-2xl transition-all"
        >
          Send
        </button>
      </div>
    </div>
  );
}
