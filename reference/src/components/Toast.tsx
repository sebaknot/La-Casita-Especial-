"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

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
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
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
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-in pointer-events-auto flex items-center gap-3 rounded-lg border bg-raised px-4 py-3 shadow-xl shadow-black/40 ${
              toast.variant === "danger"
                ? "border-danger/50"
                : toast.variant === "success"
                  ? "border-success/50"
                  : "border-hairline"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{toast.title}</p>
              {toast.description && (
                <p className="mono mt-0.5 text-xs text-ink-dim">
                  {toast.description}
                </p>
              )}
            </div>
            {toast.action && (
              <button
                onClick={() => {
                  void toast.action!.onClick();
                  dismiss(toast.id);
                }}
                className="shrink-0 rounded-md border border-brass-soft px-3 py-1 text-xs font-semibold text-brass hover:bg-brass/10"
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="shrink-0 text-ink-faint hover:text-ink"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
