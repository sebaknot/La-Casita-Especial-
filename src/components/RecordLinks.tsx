"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/icons";
import { addRecordLink, deleteRecordLink } from "@/lib/actions";
import type { RecordLink } from "@/lib/types";

/** Records keep status + links only. */
export function RecordLinks({ itemId, links }: { itemId: string; links: RecordLink[] }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await addRecordLink(itemId, label, url);
    setPending(false);
    if (!result.ok) {
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    setLabel("");
    setUrl("");
    push({ title: t.pillar.linkAdded, variant: "success" });
    router.refresh();
  }

  async function remove(id: string) {
    const result = await deleteRecordLink(id);
    push(result.ok ? { title: t.pillar.linkRemoved } : { title: t.common.somethingWrong, variant: "danger" });
    router.refresh();
  }

  return (
    <section aria-labelledby="links-title" className="rounded-2xl border border-line bg-surface p-4">
      <h2 id="links-title" className="text-lg font-semibold">
        {t.itemPage.links}
      </h2>
      <p className="mb-3 text-sm text-ink-dim">{t.pillar.recordsNote}</p>
      {links.length > 0 && (
        <ul className="mb-3 space-y-1">
          {links.map((link) => (
            <li key={link.id} className="flex items-center gap-2">
              <Icon name="link" className="h-4 w-4 text-ink-faint" />
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-primary-strong underline-offset-2 hover:underline">
                {link.label}
              </a>
              <button
                type="button"
                onClick={() => remove(link.id)}
                aria-label={`${t.common.delete}: ${link.label}`}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-faint hover:text-danger"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input
          aria-label={t.pillar.linkLabel}
          placeholder={t.pillar.linkLabel}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
          className="min-h-12 rounded-xl border border-line px-3"
        />
        <input
          aria-label={t.pillar.linkUrl}
          placeholder={t.pillar.linkUrl}
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="min-h-12 rounded-xl border border-line px-3"
        />
        <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-white disabled:opacity-60">
          {t.pillar.addLink}
        </button>
      </form>
    </section>
  );
}
