// components/avatar/useAvatarSession.ts
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Personality } from "@/lib/voices";

interface AvatarSessionState {
  isOpen: boolean;
  isConnecting: boolean;
  conversationUrl: string | null;
  conversationId: string | null;
  error: string | null;
}

export function useAvatarSession(tone: Personality, language: string) {
  const [state, setState] = useState<AvatarSessionState>({
    isOpen: false,
    isConnecting: false,
    conversationUrl: null,
    conversationId: null,
    error: null,
  });

  const conversationIdRef = useRef<string | null>(null);

  const endSessionSilent = useCallback(async (id: string) => {
    await fetch("/api/avatar/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: id }),
    });
  }, []);

  const startSession = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const res = await fetch("/api/avatar/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start session");

      conversationIdRef.current = data.conversationId;
      setState({
        isOpen: true,
        isConnecting: false,
        conversationUrl: data.conversationUrl,
        conversationId: data.conversationId,
        error: null,
      });
    } catch {
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: "Couldn't connect to Coach — try again",
      }));
    }
  }, [tone, language]);

  const endSession = useCallback(async () => {
    const id = conversationIdRef.current;
    conversationIdRef.current = null;
    setState({
      isOpen: false,
      isConnecting: false,
      conversationUrl: null,
      conversationId: null,
      error: null,
    });
    if (id) await endSessionSilent(id);
  }, [endSessionSilent]);

  // Best-effort cleanup on tab close
  useEffect(() => {
    if (!state.isOpen) return;

    const handleUnload = () => {
      const id = conversationIdRef.current;
      if (id) {
        navigator.sendBeacon(
          "/api/avatar/end",
          JSON.stringify({ conversationId: id })
        );
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [state.isOpen]);

  return { ...state, startSession, endSession };
}
