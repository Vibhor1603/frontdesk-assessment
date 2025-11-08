import { BarVisualizer } from "@livekit/components-react";

// Enhanced LiveKit BarVisualizer wrapper optimized for AI speech output
// Features improved dark theme colors and better speech visualization
export default function UniversalVisualizer({
  width = 500,
  height = 120,
  className = "",
  trackRef = null,
}) {
  if (!trackRef) {
    // Fallback visualization when no audio track is available
    return (
      <div
        className={`flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700 ${className}`}
        style={{ width, height }}
      >
        <div className="flex space-x-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-600 rounded-full animate-pulse"
              style={{
                width: "3px",
                height: `${Math.random() * 20 + 10}px`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: "2s",
              }}
            />
          ))}
        </div>
        <span className="ml-4 text-gray-500 text-sm">Waiting for audio...</span>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-gray-900 rounded-lg border border-gray-700 overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* Enhanced BarVisualizer with custom styling */}
      <BarVisualizer
        trackRef={trackRef}
        barCount={32}
        className="w-full h-full"
        style={{
          "--lk-bar-color": "#6366f1",
          "--lk-bar-color-active": "#8b5cf6",
          "--lk-bar-color-peak": "#ec4899",
          "--lk-bar-width": "4px",
          "--lk-bar-gap": "2px",
          "--lk-bar-radius": "2px",
          "--lk-bg-color": "transparent",
        }}
      />

      {/* Overlay gradient for enhanced visual effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(99, 102, 241, 0.1) 0%, transparent 50%, rgba(139, 92, 246, 0.1) 100%)",
        }}
      />

      {/* Activity indicator */}
      <div className="absolute top-2 right-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
