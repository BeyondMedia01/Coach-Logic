"use client";

import React, { useRef, useCallback, useEffect } from "react";
import {
  Paperclip,
  Smile,
  AtSign,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  Table,
  Mic,
  SendHorizonal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, type Language } from "@/lib/voices";

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

const PLACEHOLDERS: Record<string, string> = {
  English: "Message Coach Logic…",
  Spanish: "Escribe a Coach Logic…",
  French: "Envoyez un message à Coach Logic…",
  Portuguese: "Envie uma mensagem para o Coach Logic…",
  German: "Nachricht an Coach Logic…",
  Italian: "Scrivi a Coach Logic…",
};

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "36px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  const wrapSelection = useCallback(
    (prefix: string, suffix = prefix) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);
      const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + prefix.length + selected.length + suffix.length;
        el.setSelectionRange(cursor, cursor);
      });
    },
    [value, onChange]
  );

  const prependLine = useCallback(
    (prefix: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + prefix.length;
        el.setSelectionRange(cursor, cursor);
      });
    },
    [value, onChange]
  );

  const insertTable = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const table =
      "\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell     | Cell     | Cell     |\n";
    const start = el.selectionStart;
    onChange(value.slice(0, start) + table + value.slice(start));
    requestAnimationFrame(() => el.focus());
  }, [value, onChange]);

  const insertEmoji = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const emojis = ["🙂", "👏", "🚀", "💡"];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const start = el.selectionStart;
    onChange(value.slice(0, start) + emoji + value.slice(start));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }, [value, onChange]);

  const insertMention = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const mention = "@CoachLogic ";
    const start = el.selectionStart;
    onChange(value.slice(0, start) + mention + value.slice(start));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + mention.length, start + mention.length);
    });
  }, [value, onChange]);

  const iconBtn =
    "w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors";

  return (
    <div className="flex-shrink-0 border-t border-border bg-white/80 backdrop-blur-lg">
      <div className="max-w-3xl mx-auto px-4 py-3 space-y-2">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[language] ?? PLACEHOLDERS.English}
          disabled={disabled}
          rows={1}
          className={cn(
            "w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",
            "outline-none leading-relaxed py-1",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          style={{ height: "36px", maxHeight: "160px" }}
        />

        {/* Toolbar */}
        <div className="flex items-center gap-1">
          {/* Left cluster — attach/emoji/mention */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={iconBtn}
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button type="button" onClick={insertEmoji} className={iconBtn} title="Insert emoji">
              <Smile className="w-4 h-4" />
            </button>
            <button type="button" onClick={insertMention} className={iconBtn} title="Mention">
              <AtSign className="w-4 h-4" />
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-1" />

          {/* Format cluster */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => wrapSelection("**")}
              className={iconBtn}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("*")}
              className={iconBtn}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("~~")}
              className={iconBtn}
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("`")}
              className={iconBtn}
              title="Code"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => prependLine("- ")}
              className={iconBtn}
              title="Bullet list"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={insertTable} className={iconBtn} title="Insert table">
              <Table className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right cluster — language / mic / send */}
          <div className="flex items-center gap-1">
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className={cn(
                "h-8 pl-2 pr-7 text-xs rounded-lg border border-border bg-transparent",
                "text-muted-foreground focus:text-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring",
                "cursor-pointer appearance-none",
                "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')]",
                "bg-no-repeat bg-[right_6px_center]"
              )}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="bg-[#111113] text-foreground">
                  {l}
                </option>
              ))}
            </select>

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

            {/* Mic */}
            <button
              type="button"
              onClick={onMicClick}
              disabled={disabled || micDisabled}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                isListening
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={isListening ? "Stop recording" : "Record voice message"}
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Send */}
            <button
              type="button"
              onClick={onSend}
              disabled={disabled || !value.trim()}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
              title="Send message (Enter)"
            >
              <SendHorizonal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-[11px] text-muted-foreground/60 select-none">
          <kbd className="font-mono">Enter</kbd> to send ·{" "}
          <kbd className="font-mono">Shift+Enter</kbd> for new line
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onAttach(e.target.files);
        }}
      />
    </div>
  );
}
