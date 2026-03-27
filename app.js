const form = document.getElementById("composer-form");
const input = document.getElementById("message-input");
const thread = document.getElementById("thread");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const composerStatus = document.getElementById("composer-status");
const composerMeta = document.getElementById("composer-meta");
const attachmentInput = document.getElementById("attachment-input");
const attachmentList = document.getElementById("attachment-list");
const floatingMenu = document.getElementById("floating-menu");
const languageSelect = document.getElementById("language-select");
const personalitySelect = document.getElementById("personality-select");

const SPEEDS = [1, 1.5, 2];

const state = {
  messageCount: 1,
  tone: "Professional",
  language: "English",
  attachments: [],
  isListening: false,
  mediaRecorder: null,
  micStream: null,
  menuOwner: null,
  history: [], // conversation history sent to Groq
};

const menus = {
  tone: [
    "Professional",
    "Casual",
    "Friendly",
    "Formal",
    "Direct",
    "Encouraging",
    "Empathetic",
    "Creative",
    "Humorous",
    "Concise",
  ],
  language: ["English", "Spanish", "French", "Portuguese", "German"],
};

const assistantReplies = {
  English:    "Thanks for sharing. I’m capturing that so I can tailor the next onboarding questions for your business.",
  Spanish:    "Gracias por compartirlo. Lo estoy registrando para adaptar las siguientes preguntas de onboarding a tu negocio.",
  French:     "Merci pour votre partage. Je l’enregistre pour adapter les prochaines questions d’onboarding a votre entreprise.",
  Portuguese: "Obrigado por compartilhar. Estou registrando isso para adaptar as proximas perguntas de onboarding ao seu negocio.",
  German:     "Danke fürs Teilen. Ich erfasse das, um die nächsten Onboarding-Fragen auf Ihr Unternehmen abzustimmen.",
};

// Personality → ElevenLabs voice ID mapping.
// Each personality has a distinct voice character.
// Replace voice_id values with your chosen Coach Logic voice IDs from ElevenLabs.
const personalityVoices = {
  Professional: { name: "Rachel",  voice_id: "21m00Tcm4TlvDq8ikWAM" }, // calm, articulate
  Casual:       { name: "Sam",     voice_id: "yoZ06aMxZJJ28mfd3POQ" }, // relaxed, conversational
  Friendly:     { name: "Bella",   voice_id: "EXAVITQu4vr4xnSDxMaL" }, // warm, approachable
  Formal:       { name: "Arnold",  voice_id: "VR6AewLTigWG4xSOukaG" }, // crisp, authoritative
  Direct:       { name: "Domi",    voice_id: "AZnzlk1XvdvUeBnXmlld" }, // strong, confident
  Encouraging:  { name: "Elli",    voice_id: "MF3mGyEYCl7XYWbV9V6O" }, // upbeat, expressive
  Empathetic:   { name: "Josh",    voice_id: "TxGEqnHWrfWFTfGW9XjX" }, // warm, understanding
  Creative:     { name: "Antoni",  voice_id: "ErXwobaYiN019PkySvjV" }, // engaging, dynamic
  Humorous:     { name: "Sam",     voice_id: "yoZ06aMxZJJ28mfd3POQ" }, // light, playful
  Concise:      { name: "Adam",    voice_id: "pNInz6obpgDQGcFmaJgB" }, // deep, clear
};

// Language → fallback voice (used when personality voice not resolved)
const elevenLabsVoices = {
  English:    { voice: "Rachel",  voice_id: "21m00Tcm4TlvDq8ikWAM" },
  Spanish:    { voice: "Sofia",   voice_id: "EXAVITQu4vr4xnSDxMaL" },
  French:     { voice: "Camille", voice_id: "EXAVITQu4vr4xnSDxMaL" },
  Portuguese: { voice: "Mateus",  voice_id: "EXAVITQu4vr4xnSDxMaL" },
  German:     { voice: "Hans",    voice_id: "EXAVITQu4vr4xnSDxMaL" },
};

const languagePlaceholders = {
  English: "Message Coach logic...",
  Spanish: "Escribe a Coach Logic...",
  French: "Envoyez un message a Coach Logic...",
  Portuguese: "Envie uma mensagem para o Coach Logic...",
};

// Maps ElevenLabs/ISO language codes → state.language names
const langCodeMap = {
  en: "English", es: "Spanish", fr: "French", pt: "Portuguese", de: "German",
};

// Lightweight heuristic detector for the 5 supported languages.
// Returns the detected language name, or null if confidence is low.
const langPatterns = {
  German:     /[äöüÄÖÜß]|\b(ich|sie|und|das|ist|nicht|auch|mit|für|auf|eine?|des|der|die)\b/i,
  French:     /[éèêëàâùûîïœç]|\b(je|vous|nous|est|les|des|une?|pour|que|dans|avec|sur|pas|ne)\b/i,
  Spanish:    /[ñ¿¡]|[áéíóú]|\b(el|la|los|las|es|que|en|un|una|por|con|del|al|me|te|se)\b/i,
  Portuguese: /[ãõ]|ç|\b(não|isso|para|com|que|por|mais|como|tem|ser|são|uma)\b/i,
};

const detectLanguage = (text) => {
  if (text.length < 3) return null;
  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(text)) return lang;
  }
  return null; // null = don't change; fall back to current setting
};

const setStatus = (text) => {
  composerStatus.textContent = text;
  composerMeta.classList.toggle("is-visible", !!text);
};

const updateProgress = () => {
  const progress = Math.min(state.messageCount * 12, 100);
  progressFill.style.width = `${progress}%`;
  progressLabel.textContent = `${progress}%`;
};

const autosizeInput = () => {
  input.style.height = "34px";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
};

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const scrollToBottom = () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
};

const closeMenu = () => {
  floatingMenu.hidden = true;
  floatingMenu.innerHTML = "";
  state.menuOwner = null;
};

const openMenu = (owner, anchor, items, onSelect) => {
  if (state.menuOwner === owner && !floatingMenu.hidden) {
    closeMenu();
    return;
  }

  state.menuOwner = owner;
  const rect = anchor.getBoundingClientRect();
  floatingMenu.innerHTML = items
    .map(
      (item) =>
        `<button class="menu-item" type="button" data-value="${escapeHtml(item)}">${item}</button>`
    )
    .join("");

  floatingMenu.hidden = false;
  floatingMenu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 180))}px`;
  floatingMenu.style.top = `${rect.top - 8}px`;
  floatingMenu.dataset.owner = owner;

  floatingMenu.querySelectorAll(".menu-item").forEach((button) => {
    button.addEventListener("click", () => {
      onSelect(button.dataset.value);
      closeMenu();
    });
  });

  requestAnimationFrame(() => {
    const menuRect = floatingMenu.getBoundingClientRect();
    const showAbove = rect.top >= menuRect.height + 12;
    floatingMenu.style.transform = showAbove ? "translateY(-100%)" : "translateY(0)";
    floatingMenu.style.top = showAbove ? `${rect.top - 8}px` : `${rect.bottom + 8}px`;
  });
};

const updateAttachmentList = () => {
  attachmentList.innerHTML = "";

  state.attachments.forEach((attachment, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "attachment-chip";
    chip.innerHTML = `<span>${attachment.name}</span><strong>&times;</strong>`;
    chip.addEventListener("click", () => {
      state.attachments.splice(index, 1);
      updateAttachmentList();
      setStatus(state.attachments.length ? "Attachments updated" : "");
    });
    attachmentList.appendChild(chip);
  });

  composerMeta.classList.toggle("is-visible", state.attachments.length > 0);
};

const applyFeedbackState = (actions, value) => {
  actions.dataset.feedback = actions.dataset.feedback === value ? "" : value;
  actions.querySelectorAll('[data-action="like"], [data-action="dislike"]').forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.action === actions.dataset.feedback);
  });
  setStatus(actions.dataset.feedback ? `Feedback marked: ${actions.dataset.feedback}` : "Feedback cleared");
};

const createActionRow = (includeTone = true) => {
  const actions = document.createElement("div");
  actions.className = "message-actions";
  actions.innerHTML = `
    ${includeTone ? `<button class="pill-btn tone-pill" type="button">${state.tone}</button>` : ""}
    <button class="icon-btn message-action-btn" type="button" title="Copy" data-action="copy">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z"></path>
      </svg>
    </button>
    <button class="icon-btn message-action-btn" type="button" title="Like" data-action="like">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M2 21h4V9H2v12Zm20-11.39A2.61 2.61 0 0 0 19.39 7H14.7l.71-3.42.02-.24A1.33 1.33 0 0 0 14.1 2c-.35 0-.69.14-.94.39L8 7.59V21h9.55c.83 0 1.54-.5 1.85-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.39Z"></path>
      </svg>
    </button>
    <button class="icon-btn message-action-btn" type="button" title="Dislike" data-action="dislike">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M22 3h-4v12h4V3ZM2 14.39A2.61 2.61 0 0 0 4.61 17H9.3l-.71 3.42-.02.24A1.33 1.33 0 0 0 9.9 22c.35 0 .69-.14.94-.39L16 16.41V3H6.45c-.83 0-1.54.5-1.85 1.22L1.58 11.27c-.09.23-.14.47-.14.73v1.39Z"></path>
      </svg>
    </button>
  `;
  return actions;
};

const createUserMessage = (text) => {
  const row = document.createElement("article");
  row.className = "message-row message-row-right";
  row.innerHTML = `
    <div class="message-bubble bubble-user">${escapeHtml(text)}</div>
    <div class="avatar avatar-sm avatar-user" aria-hidden="true">
      <span class="avatar-face"></span>
    </div>
  `;
  return row;
};

const createAttachmentMarkup = () =>
  state.attachments.length
    ? `<div class="message-attachments">${state.attachments
        .map((file) => `<span class="message-attachment">${escapeHtml(file.name)}</span>`)
        .join("")}</div>`
    : "";

const createAssistantReply = (text) => {
  const seed = state.messageCount;
  const row = document.createElement("article");
  row.className = "message-row message-row-left";
  row.innerHTML = `
    <div class="avatar avatar-sm" aria-hidden="true">
      <span class="avatar-face"></span>
    </div>
    <div class="message-cluster">
      <div class="message-bubble bubble-assistant">
        <p>${escapeHtml(text)}</p>
        ${createAttachmentMarkup()}
      </div>
    </div>
  `;

  const cluster = row.querySelector(".message-cluster");
  const voiceProfile =
    personalityVoices[state.tone] ||
    elevenLabsVoices[state.language] ||
    elevenLabsVoices.English;

  const player = createVoicePlayer({
    getSrc: async () => {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: state.language, voice_id: voiceProfile.voice_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    seed,
    variant: "assistant",
  });

  cluster.appendChild(player);
  cluster.appendChild(createActionRow());
  return row;
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Message copied");
  } catch {
    setStatus("Copy failed — please copy manually");
  }
};

// ── VoicePlayer ──────────────────────────────────────────────
// Reusable waveform player. Appears between each message bubble
// and its action row. Supports lazy TTS fetch via getSrc().

const VP_BAR_COUNT = 46;

function vpSeededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 0x100000000;
  };
}

function vpGenerateBars(count, seed) {
  const rand = vpSeededRand(seed);
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const envelope = Math.sin(Math.PI * t);
    const f1 = 0.6 * Math.exp(-Math.pow((t - 0.3) * 6, 2));
    const f2 = 0.8 * Math.exp(-Math.pow((t - 0.65) * 5, 2));
    const noise = rand() * 0.25;
    return Math.max(0.06, Math.min(1, envelope * 0.35 + f1 + f2 + noise));
  });
}

function vpFmtTime(secs) {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// createVoicePlayer({ src, getSrc, seed, variant })
//   src     — direct audio URL
//   getSrc  — async () => url  (lazy fetch, called on first play)
//   seed    — bar-height seed (default 42)
//   variant — 'assistant' | 'user'
function createVoicePlayer({ src = null, getSrc = null, seed = 42, variant = "assistant" } = {}) {
  const bars = vpGenerateBars(VP_BAR_COUNT, seed);

  const makeBars = (cls) =>
    bars.map((h) => `<div class="vp-bar ${cls}" style="--h:${h}"></div>`).join("");

  const el = document.createElement("div");
  el.className = `vp vp--${variant}`;
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Voice message player");
  el.innerHTML = `
    <button class="vp-play" type="button" aria-label="Play">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v14l11-7-11-7z"/></svg>
    </button>
    <div class="vp-waveform" role="slider" tabindex="0"
         aria-label="Seek audio" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
      <div class="vp-bars">${makeBars("vp-bar--inactive")}</div>
      <div class="vp-bars vp-bars--overlay vp-bars--hover" style="clip-path:inset(0 100% 0 0)">${makeBars("vp-bar--hover-fill")}</div>
      <div class="vp-bars vp-bars--overlay vp-bars--progress" style="clip-path:inset(0 100% 0 0)">${makeBars("vp-bar--active")}</div>
    </div>
    <span class="vp-time">0:00</span>
    <button class="vp-speed" type="button">1x</button>
  `;

  const playBtn   = el.querySelector(".vp-play");
  const waveEl    = el.querySelector(".vp-waveform");
  const hoverL    = el.querySelector(".vp-bars--hover");
  const progressL = el.querySelector(".vp-bars--progress");
  const timeEl    = el.querySelector(".vp-time");
  const speedBtn  = el.querySelector(".vp-speed");

  const audio = new Audio();
  if (src) audio.src = src;
  audio.preload = "metadata";

  let playing  = false;
  let duration = 0;
  let speedIdx = 0;
  let loading  = false;

  const setProgress = (pct) => {
    pct = Math.max(0, Math.min(1, pct));
    progressL.style.clipPath = `inset(0 ${(1 - pct) * 100}% 0 0)`;
    waveEl.setAttribute("aria-valuenow", Math.round(pct * 100));
  };

  const setHover = (pct) => {
    hoverL.style.clipPath = pct === null
      ? "inset(0 100% 0 0)"
      : `inset(0 ${(1 - pct) * 100}% 0 0)`;
  };

  const setPlayState = (val) => {
    playing = val;
    el.classList.toggle("vp--playing", val);
    playBtn.setAttribute("aria-label", val ? "Pause" : "Play");
    playBtn.innerHTML = val
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v14l11-7-11-7z"/></svg>`;
  };

  audio.addEventListener("loadedmetadata", () => { duration = audio.duration || 0; });
  audio.addEventListener("durationchange",  () => { duration = audio.duration || 0; });
  audio.addEventListener("timeupdate", () => {
    timeEl.textContent = vpFmtTime(audio.currentTime);
    if (duration) setProgress(audio.currentTime / duration);
  });
  audio.addEventListener("play",  () => setPlayState(true));
  audio.addEventListener("pause", () => setPlayState(false));
  audio.addEventListener("ended", () => {
    setPlayState(false);
    setProgress(0);
    timeEl.textContent = "0:00";
  });

  const ensureSrc = async () => {
    if (audio.src && audio.src !== window.location.href) return true;
    if (!getSrc || loading) return false;
    loading = true;
    playBtn.disabled = true;
    try {
      const url = await getSrc();
      audio.src = url;
      await new Promise((res, rej) => {
        audio.addEventListener("canplay", res, { once: true });
        audio.addEventListener("error",   rej, { once: true });
      });
      return true;
    } catch (err) {
      setStatus(`Voice error: ${err.message}`);
      return false;
    } finally {
      loading = false;
      playBtn.disabled = false;
    }
  };

  playBtn.addEventListener("click", async () => {
    const ready = await ensureSrc();
    if (!ready) return;
    playing ? audio.pause() : audio.play().catch(() => {});
  });

  waveEl.addEventListener("click", async (e) => {
    const ready = await ensureSrc();
    if (!ready || !duration) return;
    const rect = waveEl.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  });

  waveEl.addEventListener("mousemove", (e) => {
    const rect = waveEl.getBoundingClientRect();
    setHover(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  });
  waveEl.addEventListener("mouseleave", () => setHover(null));

  waveEl.addEventListener("keydown", (e) => {
    if (!duration) return;
    if (e.key === "ArrowRight") audio.currentTime = Math.min(duration, audio.currentTime + 5);
    if (e.key === "ArrowLeft")  audio.currentTime = Math.max(0, audio.currentTime - 5);
  });

  speedBtn.addEventListener("click", () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    const s = SPEEDS[speedIdx];
    speedBtn.textContent = `${s}x`;
    audio.playbackRate = s;
  });

  return el;
}

// Creates a right-aligned user message row that embeds a VoicePlayer.
const createUserVoiceMessage = (objectUrl) => {
  const row = document.createElement("article");
  row.className = "message-row message-row-right";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble bubble-user vp-user-bubble";

  const player = createVoicePlayer({ src: objectUrl, seed: Date.now() & 0xffffffff, variant: "user" });
  bubble.appendChild(player);

  const avatar = document.createElement("div");
  avatar.className = "avatar avatar-sm avatar-user";
  avatar.setAttribute("aria-hidden", "true");
  avatar.innerHTML = `<span class="avatar-face"></span>`;

  row.appendChild(bubble);
  row.appendChild(avatar);
  return row;
};

const wrapSelection = (prefix, suffix = prefix) => {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const value = input.value;
  const selected = value.slice(start, end);
  input.value = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;
  input.focus();
  const cursor = start + prefix.length + selected.length + suffix.length;
  input.setSelectionRange(cursor, cursor);
  autosizeInput();
};

const prependLine = (prefix) => {
  const start = input.selectionStart ?? 0;
  const value = input.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  input.value = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
  input.focus();
  const cursor = start + prefix.length;
  input.setSelectionRange(cursor, cursor);
  autosizeInput();
};

const applyFormatting = (format) => {
  if (format === "bold") {
    wrapSelection("**");
    setStatus("Bold formatting added");
    return;
  }

  if (format === "italic") {
    wrapSelection("*");
    setStatus("Italic formatting added");
    return;
  }

  if (format === "bullets") {
    prependLine("- ");
    setStatus("Bullet added");
    return;
  }

  if (format === "quote") {
    prependLine("> ");
    setStatus("Quote formatting added");
    return;
  }

  if (format === "strikethrough") {
    wrapSelection("~~");
    setStatus("Strikethrough formatting added");
    return;
  }

  if (format === "code") {
    wrapSelection("`");
    setStatus("Inline code formatting added");
    return;
  }

  if (format === "table") {
    const table = "\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell     | Cell     | Cell     |\n";
    const start = input.selectionStart ?? input.value.length;
    input.value = `${input.value.slice(0, start)}${table}${input.value.slice(start)}`;
    input.focus();
    autosizeInput();
    setStatus("Table inserted");
    return;
  }

  const lines = input.value.split("\n").map((line) => {
    let next = line;
    if (next.startsWith("> ")) {
      next = next.slice(2);
    } else if (next.startsWith("- ")) {
      next = next.slice(2);
    }

    if (next.startsWith("**") && next.endsWith("**") && next.length >= 4) {
      next = next.slice(2, -2);
    } else if (next.startsWith("*") && next.endsWith("*") && next.length >= 2) {
      next = next.slice(1, -1);
    }
    return next;
  });

  input.value = lines.join("\n");
  autosizeInput();
  setStatus("Formatting cleared");
};

const fetchReply = async (userMessage) => {
  // Show typing indicator
  const typing = document.createElement("div");
  typing.className = "typing-indicator";
  typing.innerHTML = `<span></span><span></span><span></span>`;
  thread.appendChild(typing);
  scrollToBottom();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        language: state.language,
        tone: state.tone,
        history: state.history,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    const reply = data.reply;

    // Update conversation history
    state.history.push({ role: "user", content: userMessage });
    state.history.push({ role: "assistant", content: reply });

    typing.remove();
    thread.appendChild(createAssistantReply(reply));
    state.messageCount += 1;
    updateProgress();
    scrollToBottom();
  } catch (err) {
    typing.remove();
    // Fall back to static reply so the UI never breaks
    const fallback = assistantReplies[state.language] || assistantReplies.English;
    thread.appendChild(createAssistantReply(fallback));
    state.messageCount += 1;
    updateProgress();
    scrollToBottom();
    setStatus(`AI error: ${err.message}`);
  }
};

const setLanguage = (value) => {
  state.language = value;
  if (languageSelect) languageSelect.value = value;
  input.placeholder = languagePlaceholders[value] || languagePlaceholders.English;
  setStatus(`Replies and mock ElevenLabs playback will be in ${value}`);
};

const setTone = (value) => {
  state.tone = value;
  if (personalitySelect) personalitySelect.value = value;
  document.querySelectorAll(".tone-pill").forEach((pill) => {
    pill.textContent = value;
  });
  setStatus(`Personality: ${value}`);
};

// MediaRecorder-based dictation — works in all browsers (Brave, Safari, Firefox, Chrome)
// Records audio then sends to /api/transcribe (ElevenLabs Scribe STT)

const stopDictation = () => {
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }
  if (state.micStream) {
    state.micStream.getTracks().forEach((t) => t.stop());
    state.micStream = null;
  }
  state.isListening = false;
  state.mediaRecorder = null;
  document.querySelectorAll('[data-tool="mic"]').forEach((el) => el.classList.remove("is-active"));
};

const dismissAudioPreview = () => {
  document.getElementById("audio-preview")?.remove();
};

const sendAudioMessage = async (blob, mimeType, objectUrl) => {
  dismissAudioPreview();

  // Post voice bubble immediately
  const voiceRow = createUserVoiceMessage(objectUrl);
  thread.appendChild(voiceRow);
  state.messageCount += 1;
  updateProgress();
  scrollToBottom();

  // Transcribe, then get Groq reply
  try {
    setStatus("Transcribing...");
    const formData = new FormData();
    formData.append("file", blob, mimeType === "audio/webm" ? "audio.webm" : "audio.mp4");
    formData.append("model_id", "scribe_v1");

    const res = await fetch("/api/transcribe", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (!data.transcript) {
      setStatus("No speech detected");
      return;
    }

    if (data.language_code) {
      const detected = langCodeMap[data.language_code.slice(0, 2)];
      if (detected && detected !== state.language) setLanguage(detected);
    }

    setStatus("");
    window.setTimeout(() => fetchReply(data.transcript), 450);
  } catch (err) {
    setStatus(`Transcription error: ${err.message}`);
  }
};

const showAudioPreview = (blob, mimeType) => {
  dismissAudioPreview(); // clear any existing preview

  const objectUrl = URL.createObjectURL(blob);

  const panel = document.createElement("div");
  panel.id = "audio-preview";
  panel.className = "audio-preview";

  const player = createVoicePlayer({ src: objectUrl, seed: 7, variant: "assistant" });
  player.classList.add("audio-preview-player");

  const sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.className = "audio-preview-btn audio-preview-send";
  sendBtn.title = "Send";
  sendBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.01 19 20 12 4.01 5 4 10l11 2-11 2 .01 5Z"/></svg>`;

  const discardBtn = document.createElement("button");
  discardBtn.type = "button";
  discardBtn.className = "audio-preview-btn audio-preview-discard";
  discardBtn.title = "Discard";
  discardBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/></svg>`;

  panel.appendChild(player);
  panel.appendChild(sendBtn);
  panel.appendChild(discardBtn);

  // Insert inside the form, above the composer tools
  const composerTools = document.querySelector(".composer-tools");
  composerTools.insertAdjacentElement("beforebegin", panel);

  sendBtn.addEventListener("click", () => sendAudioMessage(blob, mimeType, objectUrl));
  discardBtn.addEventListener("click", () => {
    URL.revokeObjectURL(objectUrl);
    dismissAudioPreview();
    setStatus("Recording discarded");
  });
};

const startDictation = async (button) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Microphone not supported in this browser");
    return;
  }

  // Stop if already recording
  if (state.isListening) {
    stopDictation();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.micStream = stream;
    state.isListening = true;
    button.classList.add("is-active");
    setStatus("Listening... click mic to stop");

    const chunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const recorder = new MediaRecorder(stream, { mimeType });
    state.mediaRecorder = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      stopDictation();
      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size < 1000) {
        setStatus("No audio captured — try again");
        return;
      }

      setStatus("");
      showAudioPreview(blob, mimeType);
    };

    recorder.start(200); // timeslice ensures ondataavailable fires even for short recordings
  } catch (err) {
    state.isListening = false;
    button.classList.remove("is-active");
    if (err.name === "NotAllowedError") {
      setStatus("Microphone access denied — allow it in browser settings");
    } else {
      setStatus(`Mic error: ${err.message}`);
    }
  }
};

const handleTool = (tool, button) => {
  if (tool === "attach") {
    attachmentInput.click();
    return;
  }

  if (tool === "emoji") {
    const emojis = ["🙂", "👏", "🚀", "💡"];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = `${input.value.slice(0, start)}${emoji}${input.value.slice(end)}`;
    input.focus();
    input.setSelectionRange(start + emoji.length, start + emoji.length);
    autosizeInput();
    setStatus("Emoji inserted");
    return;
  }

  if (tool === "mention") {
    const mention = "@CoachLogic ";
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = `${input.value.slice(0, start)}${mention}${input.value.slice(end)}`;
    input.focus();
    input.setSelectionRange(start + mention.length, start + mention.length);
    autosizeInput();
    setStatus("Mention inserted");
    return;
  }

  if (tool === "mic") {
    startDictation(button);
  }
};

thread.addEventListener("click", async (event) => {
  const actionButton = event.target.closest(".message-action-btn");
  if (!actionButton) {
    const toneButton = event.target.closest(".tone-pill");
    if (toneButton) {
      openMenu("tone", toneButton, menus.tone, setTone);
    }
    return;
  }

  const bubble = actionButton.closest(".message-cluster")?.querySelector(".message-bubble");
  const text = bubble?.innerText.trim() || "";
  const action = actionButton.dataset.action;

  if (action === "copy") {
    await copyText(text);
    return;
  }

  if (action === "like" || action === "dislike") {
    const actions = actionButton.closest(".message-actions");
    if (actions) {
      applyFeedbackState(actions, action);
    }
    actionButton.blur();
  }
});

document.querySelectorAll(".composer-btn").forEach((button) => {
  button.addEventListener("click", () => handleTool(button.dataset.tool, button));
});

document.querySelectorAll(".formatter-btn").forEach((button) => {
  button.addEventListener("click", () => applyFormatting(button.dataset.format));
});

attachmentInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  state.attachments.push(...files.map((file) => ({ name: file.name })));
  updateAttachmentList();
  setStatus(`${files.length} attachment${files.length > 1 ? "s" : ""} added`);
  attachmentInput.value = "";
});

if (languageSelect) languageSelect.addEventListener("change", (event) => setLanguage(event.target.value));
if (personalitySelect) personalitySelect.addEventListener("change", (e) => setTone(e.target.value));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value.trim();

  if (!value && !state.attachments.length) {
    setStatus("Write a message or attach a file");
    return;
  }

  const text = value || "Shared attachments";

  // Auto-detect language from typed text
  if (value) {
    const detected = detectLanguage(value);
    if (detected && detected !== state.language) setLanguage(detected);
  }

  thread.appendChild(createUserMessage(text));

  if (state.attachments.length) {
    const userBubble = thread.lastElementChild.querySelector(".message-bubble");
    userBubble.insertAdjacentHTML("beforeend", createAttachmentMarkup());
  }

  state.messageCount += 1;
  updateProgress();
  setStatus(`Sent in ${state.language}`);
  input.value = "";
  autosizeInput();
  state.attachments = [];
  updateAttachmentList();
  closeMenu();
  scrollToBottom();
  window.setTimeout(() => fetchReply(text), 450);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener("input", autosizeInput);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".floating-menu") && !event.target.closest(".tone-pill")) {
    closeMenu();
  }
});

updateProgress();
setLanguage(state.language);
setTone(state.tone);
autosizeInput();
