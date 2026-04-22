# Live Avatar Feature — Design Spec
**Date:** 2026-04-22  
**Project:** Coach Logic  
**Status:** Approved

---

## Overview

Add a live talking-head avatar to Coach Logic powered by Tavus CVI (Conversational Video Interface). When a user is stuck or wants a more human interaction, they click a camera button in the composer bar to open a real-time WebRTC avatar session. The avatar speaks as Coach Logic, using the active personality/tone, giving the user the feeling of talking to a real person.

---

## Architecture

### New API Routes

**`POST /api/avatar/session`**

Request body:
```json
{ "tone": "Professional", "language": "English" }
```

Server-side logic:
1. Build the Coach Logic system prompt string from `tone` and `language` (same logic as `/api/chat`)
2. Call Tavus CVI:

```http
POST https://tavusapi.com/v2/conversations
Authorization: x-api-key <TAVUS_API_KEY>
Content-Type: application/json

{
  "replica_id": "<TAVUS_REPLICA_ID>",
  "persona_id": "<TAVUS_PERSONA_ID>",       // optional — omit if not set
  "conversational_context": "<system prompt>",
  "properties": {
    "max_call_duration": 1800,
    "enable_recording": false
  }
}
```

Response from Tavus:
```json
{
  "conversation_id": "c_abc123",
  "conversation_url": "https://tavus.daily.co/abc123",
  "status": "active"
}
```

Route returns to client:
```json
{ "conversationUrl": "https://tavus.daily.co/abc123", "conversationId": "c_abc123" }
```

Note: Tavus runs its own LLM internally using `conversational_context` as the system prompt. The existing Groq `/api/chat` route is **not** used during avatar sessions — the two are parallel and independent conversation surfaces.

**`POST /api/avatar/end`**

Request body:
```json
{ "conversationId": "c_abc123" }
```

Server-side logic:
```http
DELETE https://tavusapi.com/v2/conversations/<conversationId>
Authorization: x-api-key <TAVUS_API_KEY>
```

Returns: `{ "ok": true }`

Security note: `conversationId` values are UUIDs — guessing is not practical. No user-session auth is added in this iteration; treat as acceptable for v1.

### Frontend Dependencies

- **`@daily-co/daily-js`** — Tavus uses Daily.co for WebRTC transport

### Session Flow

```
User clicks 📹
  → POST /api/avatar/session { tone, language }
    → Tavus CVI API → returns conversationUrl + conversationId
  → Frontend calls DailyIframe.createCallObject()
  → call.join({ url: conversationUrl })
  → Listen for "participant-updated" event to get remote video track
  → Attach track to <video> element in AvatarPanel
  → Avatar streams live (~2s startup)

During session:
  Daily.co captures user mic automatically
  Tavus handles: STT → LLM (Coach Logic prompt) → TTS → avatar lip-sync
  Text chat thread stays usable (independent)
  Composer bar mic button is DISABLED during avatar session to avoid mic conflict

User clicks ✕
  → call.leave() + call.destroy()
  → POST /api/avatar/end { conversationId }
  → Panel closes

Tab close (best-effort cleanup):
  → window beforeunload fires → POST /api/avatar/end (fire-and-forget)
  → Tavus auto-expires session after max_call_duration (1800s) as fallback
```

---

## UI Layout

### Composer Bar (avatar off)
Existing composer bar unchanged except: a 📹 camera icon button is added to the **trailing end of the input row, to the left of the mic button**. When `isConnecting` is true, the camera button shows a spinner in place of the icon and is disabled.

### Split Layout (avatar on)
CSS `flex` row — fixed 60/40 split (no resizable panels):
```
┌─────────────────────────────────────────────────────┐
│  TopBar                                             │
├───────────────────────┬─────────────────────────────┤
│                       │  ✕  Coach Logic             │
│   Message Thread      │                             │
│   (flex: 0 0 60%)     │   <video> stream            │
│                       │   (flex: 0 0 40%)           │
│                       │                             │
│                       │   ▓▓▒▓▒  [waveform anim]   │
├───────────────────────┴─────────────────────────────┤
│  [📹] [  Type a message…  ] [🎤 disabled] [➤]      │
└─────────────────────────────────────────────────────┘
```

If the browser is resized below 768px while a session is active, the layout switches to the mobile bottom sheet without ending the session.

### Mobile (< 768px)
Avatar panel renders as a fixed bottom sheet: full-width, 50vh height, slides up from the bottom. The message thread is still scrollable above it.

### Loading state (`isConnecting`)
Camera button shows a spinner. The avatar panel opens immediately with a centered spinner and "Connecting to Coach…" label. The video element is hidden until the first remote video track is received.

---

## New Components

### `components/avatar/AvatarPanel.tsx`

Props:
```ts
interface AvatarPanelProps {
  conversationUrl: string
  onClose: () => void
}
```

Internal behaviour:
- On mount: `call = DailyIframe.createCallObject(); call.join({ url: conversationUrl })`
- Listen for `"participant-updated"` event: when a remote participant has a video track, attach to `<video ref={videoRef} autoPlay playsInline />`
- Audio waveform: CSS keyframe animation on 4 bars that plays whenever the remote participant's `audioTrack` is active (driven by `"participant-updated"` audio level — no third-party library)
- Reconnect: listen for `"error"` and `"left-meeting"` Daily events → show "Connection lost — Reconnect" button that calls `call.join()` again
- On unmount: `call.leave(); call.destroy()`

### `components/avatar/useAvatarSession.ts`

```ts
function useAvatarSession(tone: Personality, language: string): {
  startSession: () => Promise<void>
  endSession: () => Promise<void>
  isOpen: boolean
  isConnecting: boolean
  conversationUrl: string | null
  conversationId: string | null
  error: string | null   // human-readable error message or null
}
```

- `startSession()` calls `POST /api/avatar/session` with the hook's `tone` and `language` params (sourced from `ChatShell` state, passed to the hook at call site)
- Sets `isConnecting = true` until `conversationUrl` is received
- `endSession()` calls `POST /api/avatar/end`, resets all state
- Registers `beforeunload` listener on session start, removes it on end

---

## Changes to Existing Files

### `components/chat/ComposerBar.tsx`
- Add `onAvatarClick?: () => void` prop
- Add `isAvatarConnecting?: boolean` prop
- Add 📹 camera icon button (or spinner when `isAvatarConnecting`) to the trailing end of the input row, left of the mic button
- Mic button receives `disabled` prop — pass `disabled={isAvatarActive}` from `ChatShell`

### `components/chat/ChatShell.tsx`
- Add `isAvatarActive` boolean derived from `useAvatarSession`'s `isOpen`
- When `isAvatarActive`: render flex row with `MessageThread` (60%) + `AvatarPanel` (40%)
- When not active: render existing full-width layout
- Pass `onAvatarClick={startSession}` and `isAvatarConnecting={isConnecting}` to `ComposerBar`
- Pass `isAvatarActive` as `disabled` to mic button inside `ComposerBar`
- Show error toast when `error` from hook is non-null: *"Couldn't connect to Coach — try again"*

### `app/api/avatar/session/route.ts`
New Next.js App Router POST route (see Architecture section above).

### `app/api/avatar/end/route.ts`
New Next.js App Router POST route (see Architecture section above).

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `TAVUS_API_KEY` | Yes | Authenticate Tavus CVI API calls |
| `TAVUS_REPLICA_ID` | Yes | The avatar replica (talking head) to use |
| `TAVUS_PERSONA_ID` | No | Pre-configured Tavus persona; omit field from request if not set |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Tavus session creation fails (non-2xx) | `error` set to `"Couldn't connect to Coach — try again"` → toast shown in `ChatShell` |
| WebRTC connection drops (`"error"` or `"left-meeting"` Daily event) | Reconnect button shown inside `AvatarPanel` |
| User closes tab with active session | `beforeunload` fires `POST /api/avatar/end` (best-effort); Tavus auto-expires after 1800s |

---

## Out of Scope

- Syncing avatar conversation history with the text chat thread
- Recording or replaying avatar sessions
- Multiple avatar personalities/faces (single replica for now)
- Avatar on mobile native apps
- User-session authentication on `/api/avatar/end` (v1 relies on UUID obscurity)
