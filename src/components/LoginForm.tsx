"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setPending(true);
    const supabase = createClient();

    if (mode === "signIn") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ text: `${t.auth.failed}: ${error.message}`, tone: "error" });
        setPending(false);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setPending(false);
    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
    } else {
      setMessage({ text: t.auth.checkEmail, tone: "info" });
      setMode("signIn");
    }
  }

  const input =
    "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-ink-faint";

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{mode === "signIn" ? t.auth.signIn : t.auth.signUp}</h2>
      <label className="mb-1.5 block font-medium" htmlFor="email">
        {t.auth.email}
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`${input} mb-4`}
      />
      <label className="mb-1.5 block font-medium" htmlFor="password">
        {t.auth.password}
      </label>
      <input
        id="password"
        type="password"
        autoComplete={mode === "signIn" ? "current-password" : "new-password"}
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={`${input} mb-5`}
      />

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mb-4 rounded-xl px-3 py-2 ${message.tone === "error" ? "bg-danger-soft text-danger" : "bg-mint-soft text-mint-ink"}`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
      >
        {pending ? t.auth.working : mode === "signIn" ? t.auth.signIn : t.auth.signUp}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "signIn" ? "signUp" : "signIn");
          setMessage(null);
        }}
        className="mt-3 min-h-11 w-full rounded-xl text-primary-strong hover:bg-primary-soft"
      >
        {mode === "signIn" ? t.auth.needAccount : t.auth.haveAccount}
      </button>
    </form>
  );
}
