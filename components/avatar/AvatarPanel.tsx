"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { X, RefreshCw, Ghost } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarPanelProps {
  conversationUrl: string;
  onClose: () => void;
  onTranscript?: (text: string, role: "user" | "assistant", isFinal: boolean) => void;
  onSwitchToMascot?: () => void;
}

export default function AvatarPanel({ conversationUrl, onClose, onTranscript, onSwitchToMascot }: AvatarPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  const joinCall = useCallback(async (url: string) => {
    setConnectionError(false);

    // Reuse existing Daily instance if present (React Strict Mode runs effects twice)
    const existing = DailyIframe.getCallInstance();
    const call = existing ?? DailyIframe.createCallObject({ audioSource: true, videoSource: false });
    callRef.current = call;

    call.on("participant-updated", (event) => {
      if (!event || event.participant.local) return;

      const videoTrack = event.participant.tracks.video?.persistentTrack;
      if (videoTrack && videoRef.current) {
        videoRef.current.srcObject = new MediaStream([videoTrack]);
        setIsVideoReady(true);
      }

      const audioTrack = event.participant.tracks.audio?.persistentTrack;
      if (audioTrack && audioRef.current) {
        audioRef.current.srcObject = new MediaStream([audioTrack]);
        audioRef.current.play().catch(() => {});
      }

      setIsSpeaking(!!audioTrack && event.participant.tracks.audio?.state === "playable");
    });

    // Real-time transcription — fires as each participant speaks
    call.on("transcription-message", (event) => {
      console.log("[AvatarPanel] transcription-message", event);
      if (!event) return;
      const localId = call.participants()?.local?.session_id;
      const role: "user" | "assistant" = event.participantId === localId ? "user" : "assistant";
      const isFinal = event.rawResponse?.is_final ?? false;
      onTranscriptRef.current?.(event.text, role, isFinal);
    });

    // Tavus may send conversation data via app-message instead of transcription-message
    call.on("app-message", (event) => {
      console.log("[AvatarPanel] app-message", event);
      if (!event?.data) return;
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (data?.event_type === "utterance" || data?.type === "utterance") {
        const role: "user" | "assistant" = data.role ?? (data.properties?.role ?? "assistant");
        const text: string = data.text ?? data.properties?.text ?? "";
        if (text) onTranscriptRef.current?.(text, role, true);
      }
    });

    call.on("error", () => setConnectionError(true));
    call.on("left-meeting", () => setConnectionError(true));

    await call.join({ url });

    // Start transcription after joining
    try {
      await call.startTranscription();
      console.log("[AvatarPanel] transcription started");
    } catch (e) {
      console.log("[AvatarPanel] startTranscription not available:", e);
    }
  }, []);

  useEffect(() => {
    joinCall(conversationUrl);

    return () => {
      callRef.current?.leave();
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
        <div className="flex items-center gap-1">
          {onSwitchToMascot && (
            <button
              type="button"
              onClick={onSwitchToMascot}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Switch to mascot"
            >
              <Ghost className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="End session"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
        {!isVideoReady && !connectionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Connecting to Coach…</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={cn("w-full h-full object-cover", !isVideoReady && "invisible")}
        />

        {/* Hidden audio element for remote audio track */}
        <audio ref={audioRef} autoPlay playsInline className="hidden" />

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
