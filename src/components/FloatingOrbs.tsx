"use client";

import { useState } from "react";

interface FloatingOrb {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
  blur: number;
}

export default function FloatingOrbs() {
  const [orbs] = useState<FloatingOrb[]>(() => {
    const colors = [
      "rgba(139, 92, 246, 0.15)",   // violet
      "rgba(168, 85, 247, 0.12)",   // purple  
      "rgba(192, 132, 252, 0.1)",   // light purple
      "rgba(124, 58, 237, 0.13)",   // dark purple
    ];

    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 300 + 150,
      duration: Math.random() * 20 + 20,
      delay: Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      blur: Math.random() * 40 + 40,
    }));
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {orbs.map((orb) => (
        <div
          key={orb.id}
          style={{
            position: "absolute",
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            borderRadius: "50%",
            background: `radial-gradient(circle at center, ${orb.color}, transparent 70%)`,
            filter: `blur(${orb.blur}px)`,
            animation: `float-${orb.id} ${orb.duration}s ease-in-out infinite`,
            animationDelay: `${orb.delay}s`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
      <style jsx>{`
        ${orbs
          .map(
            (orb) => `
          @keyframes float-${orb.id} {
            0%, 100% {
              transform: translate(-50%, -50%) translateY(0px) translateX(0px);
            }
            25% {
              transform: translate(-50%, -50%) translateY(-30px) translateX(20px);
            }
            50% {
              transform: translate(-50%, -50%) translateY(-15px) translateX(-25px);
            }
            75% {
              transform: translate(-50%, -50%) translateY(20px) translateX(15px);
            }
          }
        `
          )
          .join("")}
      `}</style>
    </div>
  );
}
