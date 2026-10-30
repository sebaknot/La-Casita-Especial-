"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { IconMic } from "@/components/icons";

type CommandResponse =
  | { status: "executed"; message: string; undo?: UndoPayload }
  | { status: "clarify"; question: string }
  | { status: "error"; message: string };

export interface UndoPayload {
  op: "delete_item" | "restore_item" | "delete_loan" | "restore_loan";
  id: string;
  prev?: Record<string, unknown>;
}

// Minimal typings for the Web Speech API (not in lib.dom for all targets)
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.SpeechRecognition as new () => SpeechRecognitionLike) ??
    (w.webkitSpeechRecognition as new () => SpeechRecognitionLike) ??
    null
  );
}

export function CommandBar() {
  const router = useRouter();
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const manualStopRef = useRef(false);
  const lastSpeechRef = useRef(0);
  const startedAtRef = useRef(0);
  const silenceTimerRef = useRef<number | null>(null);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [clarify, setClarify] = useState<string | null>(null);

  /* Cmd+K / Ctrl+K focuses the bar */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (event.key === "Escape") {
        inputRef.current?.blur();
        setClarify(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = useCallback(
    async (raw: string, source: "command" | "voice") => {
      const value = raw.trim();
      if (!value || busy) return;
      setBusy(true);
      setClarify(null);

      try {
        const response = await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value, source }),
        });
        const result = (await response.json()) as CommandResponse;

        if (result.status === "executed") {
          setText("");
          push({
            title: result.message,
            variant: "success",
            action: result.undo
              ? {
                  label: "Undo",
                  onClick: async () => {
                    const undoResponse = await fetch("/api/command/undo", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ undo: result.undo }),
                    });
                    if (undoResponse.ok) {
                      push({ title: "Undone", variant: "default" });
                      router.refresh();
                    } else {
                      push({ title: "Undo failed", variant: "danger" });
                    }
                  },
                }
              : undefined,
          });
          router.refresh();
        } else if (result.status === "clarify") {
          setClarify(result.question);
        } else {
          push({
            title: "Command failed",
            description: result.message,
            variant: "danger",
          });
        }
      } catch {
        push({
          title: "Command failed",
          description: "Network error — try again.",
          variant: "danger",
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, push, router],
  );

  /**
   * Voice capture holds the mic open through pauses: the engine is restarted
   * whenever it quits early, until 10s pass with no speech (60s hard cap) or
   * the mic button is tapped again — then the transcript submits.
   */
  const SILENCE_MS = 10_000;
  const MAX_LISTEN_MS = 60_000;

  function stopSilenceWatch() {
    if (silenceTimerRef.current !== null) {
      window.clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function toggleMic() {
    if (recognitionRef.current) {
      manualStopRef.current = true;
      recognitionRef.current.stop();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      push({
        title: "Voice input unavailable",
        description:
          "This browser doesn't support the Web Speech API. Try Chrome or Edge.",
        variant: "danger",
      });
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    finalTranscriptRef.current = "";
    manualStopRef.current = false;
    startedAtRef.current = Date.now();
    lastSpeechRef.current = Date.now();

    const finish = (submitTranscript: boolean) => {
      stopSilenceWatch();
      recognitionRef.current = null;
      setListening(false);
      const spoken = finalTranscriptRef.current.trim();
      if (submitTranscript && spoken) void submit(spoken, "voice");
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscriptRef.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      lastSpeechRef.current = Date.now();
      setText((finalTranscriptRef.current + interim).trimStart());
    };

    recognition.onerror = (event) => {
      // Transient errors ("no-speech", "aborted") fall through to onend,
      // which decides whether to restart. Hard errors end the session.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        manualStopRef.current = true;
        push({
          title: "Microphone blocked",
          description: "Allow microphone access for this site and try again.",
          variant: "danger",
        });
      } else if (event.error === "audio-capture") {
        manualStopRef.current = true;
        push({
          title: "No microphone found",
          variant: "danger",
        });
      }
    };

    recognition.onend = () => {
      const withinCap = Date.now() - startedAtRef.current < MAX_LISTEN_MS;
      const stillWanted = Date.now() - lastSpeechRef.current < SILENCE_MS;
      if (!manualStopRef.current && withinCap && stillWanted) {
        // Chrome ends recognition after brief silences — keep the session alive.
        try {
          recognition.start();
          return;
        } catch {
          // fall through to finish
        }
      }
      finish(true);
    };

    recognitionRef.current = recognition;
    setListening(true);

    // Watchdog: submit after 10s of silence, or at the 60s hard cap.
    silenceTimerRef.current = window.setInterval(() => {
      const silentFor = Date.now() - lastSpeechRef.current;
      const totalFor = Date.now() - startedAtRef.current;
      if (silentFor >= SILENCE_MS || totalFor >= MAX_LISTEN_MS) {
        manualStopRef.current = true;
        recognitionRef.current?.stop();
      }
    }, 500);

    try {
      recognition.start();
    } catch {
      finish(false);
      push({ title: "Couldn't start the microphone", variant: "danger" });
    }
  }

  return (
    <div className="stagger-1 sticky top-0 z-30 border-b border-hairline bg-obsidian/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 pl-14 md:pl-4">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(text, "command");
          }}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder='Command anything… "Add to Porter: test QR flow by Friday"'
            aria-label="Command bar"
            disabled={busy}
            className="w-full rounded-md border border-hairline bg-surface px-3 py-2 pr-16 text-sm text-ink placeholder:text-ink-faint disabled:opacity-60"
          />
          <kbd className="mono pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-hairline px-1.5 py-0.5 text-[10px] text-ink-faint md:block">
            ⌘K
          </kbd>
          {busy && (
            <span className="mono absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-brass md:right-14">
              parsing…
            </span>
          )}
        </form>

        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? "Stop listening" : "Voice command"}
          aria-pressed={listening}
          className={`rounded-md border p-2 transition-colors ${
            listening
              ? "mic-listening border-danger/60 bg-danger/10"
              : "border-hairline bg-surface text-ink-dim hover:text-ink"
          }`}
        >
          <IconMic className="h-4.5 w-4.5" />
        </button>
      </div>

      {(listening || clarify) && (
        <div className="mx-auto max-w-6xl px-4 pb-2.5 pl-14 md:pl-4">
          {listening && (
            <p className="mono flex items-center gap-2 text-xs text-danger">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              Listening — pauses are fine. Tap the mic to send now.
            </p>
          )}
          {clarify && (
            <p className="rounded-md border border-signal/40 bg-signal/10 px-3 py-2 text-sm text-ink">
              <span className="eyebrow mr-2 !text-signal">Clarify</span>
              {clarify}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
