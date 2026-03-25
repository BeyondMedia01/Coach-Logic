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
const tonePill = document.getElementById("tone-pill");
const composerTonePill = document.getElementById("composer-tone-pill");

const state = {
  messageCount: 1,
  tone: "Professional",
  language: "English",
  attachments: [],
  isListening: false,
  mediaRecorder: null,
  micStream: null,
  speakingButton: null,
  audioContext: null,
  audioSource: null,
  menuOwner: null,
};

const menus = {
  tone: ["Professional", "Warm", "Direct", "Encouraging"],
  language: ["English", "Spanish", "French", "Portuguese"],
};

const assistantReplies = {
  English: "Thanks for sharing. I’m capturing that so I can tailor the next onboarding questions for your business.",
  Spanish: "Gracias por compartirlo. Lo estoy registrando para adaptar las siguientes preguntas de onboarding a tu negocio.",
  French: "Merci pour votre partage. Je l'enregistre pour adapter les prochaines questions d'onboarding a votre entreprise.",
  Portuguese: "Obrigado por compartilhar. Estou registrando isso para adaptar as proximas perguntas de onboarding ao seu negocio.",
};

// voice_id values are ElevenLabs voice IDs.
// Replace with your chosen Coach Logic personality voice IDs.
const elevenLabsVoices = {
  English:    { voice: "Sarah",   voice_id: "EXAVITQu4vr4xnSDxMaL" },
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
    <button class="icon-btn message-action-btn" type="button" title="Listen" data-action="listen">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Zm6 8a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 0 0-2 0 6 6 0 0 0 5 5.91V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.09A6 6 0 0 0 18 12Z"></path>
      </svg>
    </button>
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

  row.querySelector(".message-cluster").appendChild(createActionRow());
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

const stopSpeech = () => {
  if (state.audioSource) {
    state.audioSource.stop();
    state.audioSource = null;
  }
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
  state.speakingButton?.classList.remove("is-active");
  state.speakingButton = null;
  setStatus("");
};

const handleSpeech = async (text, button) => {
  // If already playing, stop
  if (state.speakingButton) {
    stopSpeech();
    return;
  }

  const voiceProfile = elevenLabsVoices[state.language] || elevenLabsVoices.English;
  state.speakingButton = button;
  button.classList.add("is-active");
  setStatus(`Generating voice in ${state.language}...`);

  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language: state.language,
        voice_id: voiceProfile.voice_id || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    state.audioContext = new AudioContext();
    const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
    state.audioSource = state.audioContext.createBufferSource();
    state.audioSource.buffer = audioBuffer;
    state.audioSource.connect(state.audioContext.destination);

    state.audioSource.onended = () => {
      stopSpeech();
    };

    state.audioSource.start();
    setStatus(`Playing ${state.language} voice...`);
  } catch (err) {
    stopSpeech();
    setStatus(`Voice error: ${err.message}`);
  }
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

const simulateReply = () => {
  const reply = assistantReplies[state.language] || assistantReplies.English;
  thread.appendChild(createAssistantReply(reply));
  state.messageCount += 1;
  updateProgress();
  scrollToBottom();
};

const setLanguage = (value) => {
  state.language = value;
  if (languageSelect) languageSelect.value = value;
  input.placeholder = languagePlaceholders[value] || languagePlaceholders.English;
  setStatus(`Replies and mock ElevenLabs playback will be in ${value}`);
};

const setTone = (value) => {
  state.tone = value;
  tonePill.textContent = value;
  document.querySelectorAll(".tone-pill").forEach((pill) => {
    pill.textContent = value;
  });
  setStatus(`Tone set to ${value}`);
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

    recorder.onstop = async () => {
      stopDictation();
      setStatus("Transcribing...");

      try {
        const blob = new Blob(chunks, { type: mimeType });
        const formData = new FormData();
        formData.append("file", blob, mimeType === "audio/webm" ? "audio.webm" : "audio.mp4");
        formData.append("language_code", { English:"en", Spanish:"es", French:"fr", Portuguese:"pt", German:"de" }[state.language] || "en");
        formData.append("model_id", "scribe_v1");

        const res = await fetch("/api/transcribe", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!data.transcript) {
          setStatus("No speech detected — try again");
          return;
        }

        input.value = input.value ? `${input.value} ${data.transcript}` : data.transcript;
        autosizeInput();
        setStatus("Voice note added");
      } catch (err) {
        setStatus(`Transcription error: ${err.message}`);
      }
    };

    recorder.start();
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

  if (action === "listen") {
    handleSpeech(text, actionButton);
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
if (composerTonePill) composerTonePill.addEventListener("click", () => openMenu("tone", composerTonePill, menus.tone, setTone));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value.trim();

  if (!value && !state.attachments.length) {
    setStatus("Write a message or attach a file");
    return;
  }

  const text = value || "Shared attachments";
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
  window.setTimeout(simulateReply, 450);
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
