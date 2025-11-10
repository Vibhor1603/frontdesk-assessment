import { useEffect, useState } from "react";

export function SimpleVisualizer({ isActive }) {
  const [bars, setBars] = useState([]);

  useEffect(() => {
    const barCount = 50;
    const interval = setInterval(() => {
      const newBars = Array.from({ length: barCount }, () => {
        if (isActive) {
          return Math.random() * 100 + 20;
        }
        return Math.random() * 20 + 5;
      });
      setBars(newBars);
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className="flex items-end justify-center gap-1 h-48 w-full max-w-3xl px-4">
      {bars.map((height, i) => (
        <div
          key={i}
          className="bg-gradient-to-t from-purple-500 to-blue-400 rounded-t transition-all duration-100"
          style={{
            height: `${height}px`,
            width: "8px",
            opacity: isActive ? 0.9 : 0.4,
          }}
        />
      ))}
    </div>
  );
}
