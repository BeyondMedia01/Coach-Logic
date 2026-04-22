# Live Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tavus CVI live avatar that speaks coach replies in a side panel, triggered by a 📹 button in the composer bar.

**Architecture:** Two new Next.js API routes (`/api/avatar/session`, `/api/avatar/end`) create and terminate Tavus CVI WebRTC sessions. The frontend joins the session via `@daily-co/daily-js` and renders the avatar video stream in a side panel that splits the layout 60/40 with the existing chat thread.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `@daily-co/daily-js`, Tavus CVI API, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/api/avatar/session/route.ts` | Create | Create Tavus CVI conversation, return `conversationUrl` + `conversationId` |
| `app/api/avatar/end/route.ts` | Create | Terminate Tavus CVI conversation |
| `components/avatar/useAvatarSession.ts` | Create | Hook managing avatar session state and API calls |
| `components/avatar/AvatarPanel.tsx` | Create | WebRTC video panel using Daily.co SDK |
| `components/chat/ComposerBar.tsx` | Modify | Add 📹 camera button + `onAvatarClick` / `isAvatarConnecting` / `micDisabled` props |
| `components/chat/ChatShell.tsx` | Modify | Wire hook, conditional 60/40 split layout, error toast |

---

## Task 1: Install dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `@daily-co/daily-js`**

```bash
npm install @daily-co/daily-js
```

Expected: package added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify TypeScript types are available**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors (Daily.co ships its own types).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @daily-co/daily-js for Tavus CVI"
```

---

## Task 2: API route — create avatar session

**Files:**
- Create: `app/api/avatar/session/route.ts`

The route accepts `{ tone, language }`, builds a Coach Logic system prompt, and calls the Tavus CVI API to create a conversation. It returns `{ conversationUrl, conversationId }`.

- [ ] **Step 1: Create the route file**

```typescript
// app/api/avatar/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Personality } from "@/lib/voices";

const PERSONALITY_DESCRIPTIONS: Record<Personality, string> = {
  Professional: "formal, precise, and business-focused",
  Casual: "relaxed, conversational, and approachable",
  Friendly: "warm, encouraging, and supportive",
  Formal: "structured, polished, and respectful",
  Direct: "clear, concise, and action-oriented",
  Encouraging: "motivating, positive, and uplifting",
  Empathetic: "understanding, compassionate, and patient",
  Creative: "imaginative, insightful, and inspiring",
  Humorous: "light-hearted, witty, and engaging",
  Concise: "brief, focused, and efficient",
};

function buildSystemPrompt(tone: Personality, language: string): string {
  const description = PERSONALITY_DESCRIPTIONS[tone] ?? "professional and supportive";
  return `You are Coach Logic, an AI business coach. Your communication style is ${description}. Always respond in ${language}. Your mission is to offer personalized support and deliver actionable insights to help the user reach their business goals. Ask thoughtful follow-up questions to understand the user's situation. Keep responses concise and conversational since this is a live video call.`;
}

export async function POST(req: NextRequest) {
  const { tone, language } = await req.json();

  const apiKey = process.env.TAVUS_API_KEY;
  const replicaId = process.env.TAVUS_REPLICA_ID;
  const personaId = process.env.TAVUS_PERSONA_ID;

  if (!apiKey || !replicaId) {
    return NextResponse.json({ error: "Avatar not configured" }, { status: 500 });
  }

  const body: Record<string, unknown> = {
    replica_id: replicaId,
    conversational_context: buildSystemPrompt(tone as Personality, language ?? "English"),
    properties: {
      max_call_duration: 1800,
      enable_recording: false,
    },
  };
  if (personaId) body.persona_id = personaId;

  const res = await fetch("https://tavusapi.com/v2/conversations", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Tavus session error:", err);
    return NextResponse.json({ error: "Failed to create avatar session" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({
    conversationUrl: data.conversation_url,
    conversationId: data.conversation_id,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "avatar/session"
```

Expected: no output (no errors for this file).

- [ ] **Step 3: Commit**

```bash
git add app/api/avatar/session/route.ts
git commit -m "feat: add POST /api/avatar/session route"
```

---

## Task 3: API route — end avatar session

**Files:**
- Create: `app/api/avatar/end/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/avatar/end/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { conversationId } = await req.json();

  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey || !conversationId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await fetch(`https://tavusapi.com/v2/conversations/${conversationId}`, {
    method: "DELETE",
    headers: { "x-api-key": apiKey },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "avatar/end"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/avatar/end/route.ts
git commit -m "feat: add POST /api/avatar/end route"
```

---

## Task 4: `useAvatarSession` hook

**Files:**
- Create: `components/avatar/useAvatarSession.ts`

This hook owns all avatar session state. It is called from `ChatShell` with the active `tone` and `language` values.

- [ ] **Step 1: Create the hook**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "useAvatarSession"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/avatar/useAvatarSession.ts
git commit -m "feat: add useAvatarSession hook"
```

---

## Task 5: `AvatarPanel` component

**Files:**
- Create: `components/avatar/AvatarPanel.tsx`

This component joins the Daily.co room, renders the avatar video stream, shows an audio waveform when the avatar is speaking, and handles reconnection.

- [ ] **Step 1: Create the component**

```tsx
// components/avatar/AvatarPanel.tsx
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
```

- [ ] **Step 2: Add waveform animation to `app/globals.css`**

Open `app/globals.css` and add these keyframes inside the file (before or after existing content):

```css
@keyframes waveform {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.8); }
}

.animate-waveform {
  animation: waveform 0.6s ease-in-out infinite;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "AvatarPanel"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/avatar/AvatarPanel.tsx app/globals.css
git commit -m "feat: add AvatarPanel component with Daily.co WebRTC"
```

---

## Task 6: Update `ComposerBar`

**Files:**
- Modify: `components/chat/ComposerBar.tsx`

Add `onAvatarClick`, `isAvatarConnecting`, and `micDisabled` props. Add the camera button to the trailing end of the toolbar, left of the mic button.

- [ ] **Step 1: Update the props interface**

In `ComposerBar.tsx`, replace the `ComposerBarProps` interface:

```typescript
interface ComposerBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onMicClick: () => void;
  isListening: boolean;
  language: Language | string;
  onLanguageChange: (lang: string) => void;
  onAttach: (files: FileList) => void;
  disabled?: boolean;
  micDisabled?: boolean;
  onAvatarClick?: () => void;
  isAvatarConnecting?: boolean;
}
```

- [ ] **Step 2: Destructure new props**

Update the destructuring in the function signature to include:

```typescript
export default function ComposerBar({
  value,
  onChange,
  onSend,
  onMicClick,
  isListening,
  language,
  onLanguageChange,
  onAttach,
  disabled,
  micDisabled,
  onAvatarClick,
  isAvatarConnecting,
}: ComposerBarProps) {
```

- [ ] **Step 3: Add camera button — left of the mic button**

In the "Right cluster" div (find the comment `{/* Right cluster — language / mic / send */}`), add the camera button immediately before the mic button:

```tsx
{/* Avatar / camera button */}
{onAvatarClick && (
  <button
    type="button"
    onClick={onAvatarClick}
    disabled={disabled || isAvatarConnecting}
    className={cn(
      "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
      "text-muted-foreground hover:text-foreground hover:bg-muted",
      "disabled:opacity-40 disabled:cursor-not-allowed"
    )}
    title="Talk to Coach (live avatar)"
  >
    {isAvatarConnecting ? (
      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 8-6 4 6 4V8z"/>
        <rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
      </svg>
    )}
  </button>
)}
```

- [ ] **Step 4: Apply `micDisabled` to the mic button**

Find the mic `<button>` element and update its `disabled` prop:

```tsx
<button
  type="button"
  onClick={onMicClick}
  disabled={disabled || micDisabled}
  ...
>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "ComposerBar"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add components/chat/ComposerBar.tsx
git commit -m "feat: add avatar camera button to ComposerBar"
```

---

## Task 7: Update `ChatShell` — wire avatar into layout

**Files:**
- Modify: `components/chat/ChatShell.tsx`

Wire `useAvatarSession`, conditionally render split layout, pass new props to `ComposerBar`, show error toast.

- [ ] **Step 1: Add imports**

At the top of `ChatShell.tsx`, add:

```typescript
import { useAvatarSession } from "@/components/avatar/useAvatarSession";
import AvatarPanel from "@/components/avatar/AvatarPanel";
```

- [ ] **Step 2: Instantiate the hook**

Inside `ChatShell()`, after the existing state declarations, add:

```typescript
const {
  isOpen: isAvatarOpen,
  isConnecting: isAvatarConnecting,
  conversationUrl,
  error: avatarError,
  startSession: startAvatar,
  endSession: endAvatar,
} = useAvatarSession(tone, language);
```

- [ ] **Step 3: (Skipped — error banner is included in the full layout block in Step 4)**

- [ ] **Step 4: Replace the outer layout with the conditional split**

Find the current outer `<div className="flex flex-col h-screen">` wrapper. Replace the contents so the middle section (everything between `<TopBar>` and `<ComposerBar>`) conditionally renders a split:

```tsx
return (
  <div className="flex flex-col h-screen">
    <TopBar
      messageCount={messageCount}
      voiceGender={voiceGender}
      onToggleGender={() => setVoiceGender((g) => (g === "female" ? "male" : "female"))}
    />

    {/* Middle: split when avatar open, full-width when not */}
    <div className={cn("flex-1 overflow-hidden flex", isAvatarOpen ? "flex-row" : "flex-col")}>
      {/* Chat thread */}
      <div
        className={cn(
          "overflow-y-auto",
          isAvatarOpen ? "flex-[0_0_60%]" : "flex-1"
        )}
      >
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="text-center mb-8">
            <h1 className="font-bricolage font-bold text-2xl text-foreground tracking-tight">
              Let&apos;s get to know each other!
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <MessageThread
            messages={messages}
            tone={tone}
            voiceGender={voiceGender}
            status={isTyping ? "Thinking…" : undefined}
            onToneChange={setTone}
          />
          <div ref={threadEndRef} />
        </div>
      </div>

      {/* Avatar panel — desktop only (hidden on mobile, shown md+) */}
      {isAvatarOpen && conversationUrl && (
        <div className="hidden md:flex md:flex-col flex-[0_0_40%]">
          <AvatarPanel conversationUrl={conversationUrl} onClose={endAvatar} />
        </div>
      )}

      {/* Mobile: bottom sheet when avatar open */}
      {isAvatarOpen && conversationUrl && (
        <div className="fixed bottom-0 left-0 right-0 h-[50vh] z-50 flex flex-col md:hidden">
          <AvatarPanel conversationUrl={conversationUrl} onClose={endAvatar} />
        </div>
      )}
    </div>

    {/* Audio preview strip */}
    {audioPreview && (
      <div className="flex-shrink-0 max-w-3xl mx-auto w-full px-4 pb-2">
        <AudioPreview
          objectUrl={audioPreview.objectUrl}
          seed={7}
          onDiscard={handleDiscardAudio}
          onSend={handleSendAudio}
          isSending={isSendingAudio}
        />
      </div>
    )}

    {/* Error banner */}
    {avatarError && (
      <div className="flex-shrink-0 max-w-3xl mx-auto w-full px-4 pb-2">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg px-4 py-2">
          {avatarError}
        </div>
      </div>
    )}

    <ComposerBar
      value={inputValue}
      onChange={setInputValue}
      onSend={handleSend}
      onMicClick={handleMicClick}
      isListening={isListening}
      language={language}
      onLanguageChange={setLanguage}
      onAttach={handleAttach}
      disabled={isTyping || isSendingAudio}
      micDisabled={isAvatarOpen}
      onAvatarClick={startAvatar}
      isAvatarConnecting={isAvatarConnecting}
    />
  </div>
);
```

- [ ] **Step 5: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: exits with code 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add components/chat/ChatShell.tsx
git commit -m "feat: wire live avatar into ChatShell layout"
```

---

## Task 8: Add environment variables to Vercel

- [ ] **Step 1: Add required env vars locally**

Create or update `.env.local` (never commit this file):

```
TAVUS_API_KEY=your_tavus_api_key_here
TAVUS_REPLICA_ID=your_replica_id_here
TAVUS_PERSONA_ID=your_persona_id_here   # optional — omit if not using
```

- [ ] **Step 2: Add to Vercel**

```bash
vercel env add TAVUS_API_KEY
vercel env add TAVUS_REPLICA_ID
# Only if you have a persona ID:
vercel env add TAVUS_PERSONA_ID
```

When prompted, select **Production** and **Preview** for each.

- [ ] **Step 3: Verify env vars are listed**

```bash
vercel env ls
```

Expected: `TAVUS_API_KEY` and `TAVUS_REPLICA_ID` appear in the output.

---

## Task 9: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open http://localhost:3000**

Verify the 📹 camera icon appears in the composer bar toolbar, to the left of the mic button.

- [ ] **Step 3: Click the camera button**

Expected sequence:
1. Button shows spinner (`isAvatarConnecting`)
2. Layout splits 60/40 — chat thread on left, avatar panel on right with "Connecting to Coach…" spinner
3. Within ~2–5 seconds, avatar video stream appears

- [ ] **Step 4: Speak to the avatar**

Say something to the avatar. Verify:
- Avatar responds in real-time (Tavus CVI handles STT/LLM/TTS)
- Audio waveform bars animate when avatar is speaking
- Mic button in composer bar is disabled (grayed out)

- [ ] **Step 5: Close the panel**

Click ✕. Verify:
- Layout returns to full-width chat thread
- Mic button in composer bar is re-enabled
- Camera button is back to normal state

- [ ] **Step 6: Test mobile layout**

Resize browser to < 768px wide. Open avatar again. Verify the avatar panel appears as a bottom sheet (full-width, ~50% height) rather than a side panel.

- [ ] **Step 7: Commit final state**

```bash
git add .
git commit -m "feat: live avatar feature complete"
```

---

## Task 10: Deploy to Vercel

- [ ] **Step 1: Link project if not already linked**

```bash
vercel link
```

Follow prompts to link to the existing `coach-logic` project under `beyonds-projects-dd8218b3`.

- [ ] **Step 2: Deploy**

```bash
vercel --prod
```

- [ ] **Step 3: Verify deployment**

Open https://coach-logic-ten.vercel.app and repeat the smoke test from Task 9 against production.
