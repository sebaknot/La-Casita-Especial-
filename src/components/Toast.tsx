"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: "default" | "success" | "danger";
  /** Optional action button (e.g. Undo). */
  action?: { label: string; onClick: () => void | Promise<void> };
  /** ms before auto-dismiss. Defaults to 4000 (10000 when an action exists). */
  duration?: number;
}

interface ToastRecord extends ToastInput {
  id: number;
}

interface ToastContextValue {
  push: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      const duration = toast.duration ?? (toast.action ? 10000 : 4000);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4 md:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === "danger" ? "alert" : "status"}
            className={`toast-in pointer-events-auto flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 shadow-lg shadow-slate-900/10 ${
              toast.variant === "danger"
                ? "border-danger/40"
                : toast.variant === "success"
                  ? "border-mint"
                  : "border-line"
            }`}
          >
            <span
              aria-hidden
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                toast.variant === "danger" ? "bg-danger" : toast.variant === "success" ? "bg-mint-ink" : "bg-primary"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] font-medium text-ink">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-sm text-ink-dim">{toast.description}</p>}
            </div>
            {toast.action && (
              <button
                onClick={() => {
                  void toast.action!.onClick();
                  dismiss(toast.id);
                }}
                className="min-h-11 shrink-0 rounded-lg bg-primary-soft px-3 text-sm font-semibold text-primary-strong hover:bg-primary/15"
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              aria-label={t.common.close}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:text-ink"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
