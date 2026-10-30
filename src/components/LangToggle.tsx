"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/icons";
import { dict } from "@/i18n";
import { setLocale } from "@/lib/actions";

/** One tap between English and Spanish. The whole UI and the command bar follow. */
export function LangToggle() {
  const { locale, t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "en" ? "es" : "en";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t.language.switchToLabel}
      onClick={() =>
        startTransition(async () => {
          const result = await setLocale(next);
          if (result.ok) {
            push({ title: dict(next).language.switched });
            router.refresh();
          } else {
            push({ title: t.common.somethingWrong, variant: "danger" });
          }
        })
      }
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink-dim hover:text-ink disabled:opacity-60"
    >
      <Icon name="globe" className="h-4 w-4" />
      {t.language.switchTo}
    </button>
  );
}
