import { useState, useEffect } from "react";
import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";

export function AudioVisualizer({ isListening }) {
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
