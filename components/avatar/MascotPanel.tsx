"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, User } from "lucide-react";
import Mascot, { useTalkAnimation } from "./Mascot";

// Fetches audio from /api/speak, plays it, and drives mouth animation by
// polling the HTMLAudioElement's currentTime against a character-rate estimate.
function useElevenLabsSpeech(text: string) {
  const [revealed, setRevealed] = useState(text);
  const [talking, setTalking] = useState(false);
  const prevTextRef = useRef(text);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setTalking(false);
  }, []);

  useEffect(() => {
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;

    stop();
    if (!text) return;

    let cancelled = false;
    setTalking(true);
    setRevealed("");

    (async () => {
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok || cancelled) { setTalking(false); return; }

        const blob = await res.blob();
        if (cancelled) { setTalking(false); return; }

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          cancelAnimationFrame(rafRef.current);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setRevealed(text);
          setTalking(false);
        };

        await audio.play();

        // Estimate chars per second based on text length vs a typical speaking rate (~14 chars/s)
        const charsPerSec = text.length / Math.max(1, text.length / 14);

        const tick = () => {
          if (!audioRef.current) return;
          const charPos = Math.min(
            Math.floor(audioRef.current.currentTime * charsPerSec),
            text.length,
          );
          setRevealed(text.slice(0, charPos));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setTalking(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [text, stop]);

  return { revealed, talking };
}

interface MascotPanelProps {
  latestAssistantText: string;
  onClose: () => void;
  onSwitchToHuman?: () => void;
}

export default function MascotPanel({ latestAssistantText, onClose, onSwitchToHuman }: MascotPanelProps) {
  const { revealed, talking } = useElevenLabsSpeech(latestAssistantText);
  const { openness, vowel } = useTalkAnimation(revealed, talking);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-amber-50 to-orange-50 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-sm font-semibold text-foreground">Coach Logic</span>
        <div className="flex items-center gap-1">
          {onSwitchToHuman && (
            <button
              type="button"
              onClick={onSwitchToHuman}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Switch to live avatar"
            >
              <User className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mascot area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <Mascot
          openness={openness}
          vowel={vowel}
          excited={talking}
          intensity={talking ? 0.7 : 0.3}
          sizePx={300}
        />
      </div>

      {/* Waveform footer */}
      <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-border flex-shrink-0 h-12">
        {[3, 5, 2, 4, 3].map((h, i) => (
          <div
            key={i}
            className={`w-1 rounded-full bg-primary transition-all duration-150 ${talking ? "animate-waveform" : "opacity-30"}`}
            style={{
              height: talking ? `${h * 4}px` : "4px",
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
