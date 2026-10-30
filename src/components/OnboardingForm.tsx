"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { createHousehold } from "@/lib/actions";

export function OnboardingForm() {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [name, setName] = useState("La Casita");
  const [seed, setSeed] = useState(true);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await createHousehold(name, seed);
    setPending(false);
    if (!result.ok) {
      push({ title: t.onboarding.failed, description: result.error, variant: "danger" });
      return;
    }
    push({ title: t.app.title, description: t.app.tagline, variant: "success" });
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div>
        <label htmlFor="household-name" className="mb-1.5 block font-medium">
          {t.onboarding.householdName}
        </label>
        <input
          id="household-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
          className="min-h-12 w-full rounded-xl border border-line px-3"
        />
      </div>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" checked={seed} onChange={(event) => setSeed(event.target.checked)} className="mt-1 h-5 w-5 accent-[var(--color-primary)]" />
        <span>{t.onboarding.seed}</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
      >
        {pending ? t.onboarding.creating : t.onboarding.create}
      </button>
    </form>
  );
}
