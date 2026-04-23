"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarPanelProps {
  conversationUrl: string;
  onClose: () => void;
}

export default function AvatarPanel({ conversationUrl, onClose }: AvatarPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  const joinCall = useCallback(async (url: string) => {
    setConnectionError(false);

    const call = DailyIframe.createCallObject({ audioSource: true, videoSource: false });
    callRef.current = call;

    call.on("participant-updated", (event) => {
      if (!event || event.participant.local) return;

      // Attach remote video track
      const videoTrack = event.participant.tracks.video?.persistentTrack;
      if (videoTrack && videoRef.current) {
        videoRef.current.srcObject = new MediaStream([videoTrack]);
        setIsVideoReady(true);
      }

      // Drive waveform from audio track presence
      const audioTrack = event.participant.tracks.audio?.persistentTrack;
      setIsSpeaking(!!audioTrack && event.participant.tracks.audio?.state === "playable");
    });

    call.on("error", () => setConnectionError(true));
    call.on("left-meeting", () => setConnectionError(true));

    await call.join({ url });
  }, []);

  useEffect(() => {
    joinCall(conversationUrl);

    return () => {
      callRef.current?.leave();
      callRef.current?.destroy();
      callRef.current = null;
    };
  }, [conversationUrl, joinCall]);

  const handleReconnect = useCallback(() => {
    callRef.current?.leave();
    callRef.current?.destroy();
    callRef.current = null;
    setIsVideoReady(false);
    joinCall(conversationUrl);
  }, [conversationUrl, joinCall]);

  return (
    <div className="flex flex-col h-full bg-muted/30 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-sm font-semibold text-foreground">Coach Logic</span>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="End session"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Video area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
        {/* Spinner while connecting */}
        {!isVideoReady && !connectionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Connecting to Coach…</p>
          </div>
        )}

        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={cn("w-full h-full object-cover", !isVideoReady && "invisible")}
        />

        {/* Reconnect overlay */}
        {connectionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 z-10">
            <p className="text-sm text-muted-foreground">Connection lost</p>
            <button
              type="button"
              onClick={handleReconnect}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reconnect
            </button>
          </div>
        )}
      </div>

      {/* Audio waveform */}
      <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-border flex-shrink-0 h-12">
        {[3, 5, 2, 4, 3].map((h, i) => (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full bg-primary transition-all duration-150",
              isSpeaking ? "animate-waveform" : "opacity-30"
            )}
            style={{
              height: isSpeaking ? `${h * 4}px` : "4px",
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
