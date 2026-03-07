"use client";

import { useState, useEffect } from "react";

interface FloatingOrb {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
  blur: number;
  animIndex: number; // 0-2, picks one of 3 shared keyframes
}

// 3 shared float paths — no per-orb keyframe injection
const FLOAT_STYLES = `
@keyframes orb-float-0 {
  0%,100% { transform: translate(-50%,-50%) translateY(0)   translateX(0); }
  33%      { transform: translate(-50%,-50%) translateY(-28px) translateX(20px); }
  66%      { transform: translate(-50%,-50%) translateY(14px)  translateX(-18px); }
}
@keyframes orb-float-1 {
  0%,100% { transform: translate(-50%,-50%) translateY(0)   translateX(0); }
  33%      { transform: translate(-50%,-50%) translateY(22px)  translateX(-25px); }
  66%      { transform: translate(-50%,-50%) translateY(-18px) translateX(16px); }
}
@keyframes orb-float-2 {
  0%,100% { transform: translate(-50%,-50%) translateY(0)   translateX(0); }
  50%      { transform: translate(-50%,-50%) translateY(-20px) translateX(22px); }
}
`;

export default function FloatingOrbs() {
  const [orbs, setOrbs] = useState<FloatingOrb[]>([]);

  useEffect(() => {
    const colors = [
      "rgba(139, 92, 246, 0.15)",
      "rgba(168, 85, 247, 0.12)",
      "rgba(192, 132, 252, 0.1)",
      "rgba(124, 58, 237, 0.13)",
    ];

    setOrbs(Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 300 + 150,
      duration: Math.random() * 20 + 20,
      delay: Math.random() * 5,
      color: colors[i % colors.length],
      blur: Math.random() * 40 + 40,
      animIndex: i % 3,
    })));
  }, []);

  if (orbs.length === 0) return null;

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
      <style>{FLOAT_STYLES}</style>
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
            animation: `orb-float-${orb.animIndex} ${orb.duration}s ease-in-out ${orb.delay}s infinite`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}

