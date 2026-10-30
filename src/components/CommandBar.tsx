"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/icons";
import { pillarConfig } from "@/config/pillars";

/*
 * Adapted from Sovereign's command bar: Cmd+K, JSON actions parsed by
 * Claude, clarify-on-ambiguity, 10s undo. Text only (no voice), and it
 * speaks whichever language the UI is in.
 */

type CommandResponse =
  | { status: "executed"; message: string; undo?: UndoPayload }
  | { status: "clarify"; question: string }
  | { status: "error"; message: string };

export interface UndoPayload {
  op: "delete_item" | "restore_item" | "delete_completion";
  id: string;
  date?: string;
  prev?: Record<string, unknown>;
}

/* Pages inside a sensitive pillar switch the bar off. */
const SensitiveContext = createContext<{ setSensitive: (value: boolean) => void }>({ setSensitive: () => {} });

export function SensitiveZone({ active }: { active: boolean }) {
  const { setSensitive } = useContext(SensitiveContext);
  useEffect(() => {
    setSensitive(active);
    return () => setSensitive(false);
  }, [active, setSensitive]);
  return null;
}

export function CommandBarProvider({ children }: { children: React.ReactNode }) {
  const [sensitive, setSensitive] = useState(false);
  return (
    <SensitiveContext.Provider value={{ setSensitive }}>
      <CommandBar sensitiveZone={sensitive} />
      {children}
    </SensitiveContext.Provider>
  );
}

function CommandBar({ sensitiveZone }: { sensitiveZone: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { push } = useToast();
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [clarify, setClarify] = useState<string | null>(null);

  const pillarMatch = /^\/p\/([^/]+)/.exec(pathname);
  const disabled = sensitiveZone || (pillarMatch ? pillarConfig(pillarMatch[1]).sensitive : false);

  /* Cmd+K / Ctrl+K focuses the bar */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        setClarify(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value || busy || disabled) return;
      setBusy(true);
      setClarify(null);

      try {
        const response = await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value, locale, pathname }),
        });
        const result = (await response.json()) as CommandResponse;

        if (result.status === "executed") {
          setText("");
          push({
            title: result.message,
            variant: "success",
            action: result.undo
              ? {
                  label: t.common.undo,
                  onClick: async () => {
                    const undoResponse = await fetch("/api/command/undo", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ undo: result.undo, locale }),
                    });
                    if (undoResponse.ok) {
                      push({ title: t.common.undone });
                      router.refresh();
                    } else {
                      push({ title: t.command.undoFailed, variant: "danger" });
                    }
                  },
                }
              : undefined,
          });
          router.refresh();
        } else if (result.status === "clarify") {
          setClarify(result.question);
        } else {
          push({ title: t.command.failed, description: result.message, variant: "danger" });
        }
      } catch {
        push({ title: t.command.failed, description: t.command.network, variant: "danger" });
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, locale, pathname, push, router, t],
  );

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-2.5">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(text);
          }}
        >
          <label htmlFor="command-bar" className="sr-only">
            {t.command.label}
          </label>
          <Icon name="command" className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-ink-faint" />
          <input
            id="command-bar"
            ref={inputRef}
            value={disabled ? "" : text}
            onChange={(event) => setText(event.target.value)}
            placeholder={disabled ? t.command.disabledSensitive : t.command.placeholderShort}
            title={disabled ? t.command.disabledSensitive : t.command.placeholder}
            disabled={busy || disabled}
            enterKeyHint="send"
            autoComplete="off"
            className="min-h-12 w-full rounded-xl border border-line bg-surface py-2 pr-10 pl-11 md:pr-24 text-ink placeholder:text-ink-faint disabled:cursor-not-allowed disabled:bg-sunk"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-ink-faint">
            {disabled ? <Icon name="lock" className="h-4 w-4" /> : busy ? t.command.parsing : <span className="hidden md:inline">{t.command.shortcut}</span>}
          </span>
        </form>

        {clarify && !disabled && (
          <p role="status" className="mt-2 rounded-xl bg-primary-soft px-3 py-2 text-ink">
            <span className="mr-2 font-semibold text-primary-strong">{t.command.clarify}:</span>
            {clarify}
          </p>
        )}
      </div>
    </div>
  );
}
