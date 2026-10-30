"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Access denied. Check your credentials.");
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-hairline bg-surface p-6"
    >
      <label className="eyebrow mb-1.5 block" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mono mb-4 w-full rounded-md border border-hairline bg-obsidian px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
        placeholder="you@example.com"
      />

      <label className="eyebrow mb-1.5 block" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mono mb-6 w-full rounded-md border border-hairline bg-obsidian px-3 py-2 text-sm text-ink"
      />

      {error && (
        <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="deck-hover w-full rounded-md border border-brass-soft bg-brass/10 px-4 py-2.5 text-sm font-semibold text-brass disabled:opacity-50"
      >
        {pending ? "Authenticating…" : "Enter"}
      </button>
    </form>
  );
}
