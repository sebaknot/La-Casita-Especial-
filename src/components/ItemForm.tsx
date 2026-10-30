"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useHousehold } from "@/components/HouseholdProvider";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/icons";
import { PILLAR_KEYS, pillarConfig } from "@/config/pillars";
import { swatch } from "@/config/palette";
import { pillarName, tagLabel } from "@/i18n";
import { createItem, deleteItem, updateItem } from "@/lib/actions";
import { normalizeTime, toUTC, weekdayOf, WEEKDAYS, type Weekday } from "@/lib/dates";
import { parseRule, weeklyDays, weeklyRule } from "@/lib/recurrence";
import { ITEM_KINDS, ITEM_STATUSES, KNOWN_TAGS, type Item, type ItemKind, type ItemStatus } from "@/lib/types";

type Repeat = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface ItemFormDefaults {
  pillar_key?: string;
  kind?: ItemKind;
  person_id?: string;
  date?: string;
  tag?: string;
  title?: string;
  parent_id?: string;
}

function repeatOf(rule: string | null): Repeat {
  const parsed = rule ? parseRule(rule) : null;
  if (!parsed) return "none";
  return parsed.freq.toLowerCase() as Repeat;
}

/** "1SA" for the 7th, "-1FR" style isn't offered — first..fourth weekday only. */
function monthlyRuleFor(date: string): string {
  const nth = Math.min(4, Math.ceil(toUTC(date).getUTCDate() / 7));
  return `FREQ=MONTHLY;BYDAY=${nth}${weekdayOf(date)}`;
}

const field = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-ink-faint";
const label = "mb-1.5 block font-medium text-ink";

export function ItemForm({
  item,
  defaults = {},
  returnTo = "/",
}: {
  item?: Item;
  defaults?: ItemFormDefaults;
  returnTo?: string;
}) {
  const { t } = useI18n();
  const { people, today } = useHousehold();
  const { push } = useToast();
  const router = useRouter();
  const editing = Boolean(item);

  const [title, setTitle] = useState(item?.title ?? defaults.title ?? "");
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? defaults.kind ?? "task");
  const [pillar, setPillar] = useState<string>(item?.pillar_key ?? defaults.pillar_key ?? "kids");
  const [personId, setPersonId] = useState<string | null>(item?.person_id ?? defaults.person_id ?? null);
  const [driverId, setDriverId] = useState<string | null>(item?.responsible_person_id ?? null);
  const [date, setDate] = useState(item ? (item.starts_on ?? item.due_date ?? "") : (defaults.date ?? ""));
  const [startTime, setStartTime] = useState(normalizeTime(item?.start_time) ?? "");
  const [endTime, setEndTime] = useState(normalizeTime(item?.end_time) ?? "");
  const [repeat, setRepeat] = useState<Repeat>(repeatOf(item?.recurrence ?? null));
  const [days, setDays] = useState<Weekday[]>(weeklyDays(item?.recurrence ?? null));
  const [endsOn, setEndsOn] = useState(item?.ends_on ?? "");
  const [ruleTouched, setRuleTouched] = useState(false);
  const [tag, setTag] = useState(item?.tag ?? defaults.tag ?? "");
  const [location, setLocation] = useState(item?.location ?? "");
  const [details, setDetails] = useState(item?.details ?? "");
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? "open");
  const [priority, setPriority] = useState<1 | 2 | 3>(item?.priority ?? 2);
  const [nextAction, setNextAction] = useState(item?.next_action ?? "");
  const [waitingOn, setWaitingOn] = useState(item?.waiting_on ?? "");
  const [countdown, setCountdown] = useState(item?.countdown ?? false);
  const [progressTotal, setProgressTotal] = useState(item?.progress_total?.toString() ?? "");
  const [progressDone, setProgressDone] = useState(item?.progress_done?.toString() ?? "");
  const [more, setMore] = useState(editing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduled = kind === "event" || kind === "routine";
  const isStep = Boolean(item?.parent_id ?? defaults.parent_id);
  const effectiveRepeat: Repeat = kind === "routine" && repeat === "none" ? "weekly" : repeat;

  function chooseKind(next: ItemKind) {
    setKind(next);
    if (next === "routine" && repeat === "none") {
      setRepeat("weekly");
      if (days.length === 0) setDays([weekdayOf(date || today)]);
      setRuleTouched(true);
    }
  }

  function buildRule(): string | null {
    if (!scheduled || effectiveRepeat === "none") return null;
    if (editing && !ruleTouched && item?.recurrence) return item.recurrence;
    const anchor = date || today;
    switch (effectiveRepeat) {
      case "daily":
        return "FREQ=DAILY";
      case "weekly":
        return weeklyRule(days.length > 0 ? days : [weekdayOf(anchor)]);
      case "monthly":
        return monthlyRuleFor(anchor);
      case "yearly":
        return "FREQ=YEARLY";
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) return setError(t.form.titleRequired);
    if (scheduled && effectiveRepeat === "weekly" && ruleTouched && days.length === 0) return setError(t.form.daysRequired);

    const recurrence = buildRule();
    // A scheduled item without a date starts today.
    const startsOn = scheduled ? date || today : countdown ? date : "";
    const raw: Record<string, unknown> = {
      title,
      kind,
      pillar_key: pillar,
      person_id: personId,
      responsible_person_id: driverId,
      starts_on: startsOn || null,
      ends_on: recurrence ? endsOn || null : null,
      start_time: scheduled ? startTime || null : null,
      end_time: scheduled ? endTime || null : null,
      recurrence,
      due_date: !scheduled ? date || null : null,
      tag: tag || null,
      location,
      details,
      status,
      priority,
      next_action: nextAction,
      waiting_on: waitingOn,
      countdown,
      progress_total: progressTotal || null,
      progress_done: progressTotal ? progressDone || 0 : null,
    };
    if (!editing && defaults.parent_id) raw.parent_id = defaults.parent_id;

    setPending(true);
    const result = editing ? await updateItem(item!.id, raw) : await createItem(raw);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    const saved = result.data!;
    push({
      title: editing ? t.form.saved(saved.title) : t.form.added(saved.title),
      variant: "success",
      action: editing
        ? undefined
        : {
            label: t.common.undo,
            onClick: async () => {
              const undo = await deleteItem(saved.id);
              push(undo.ok ? { title: t.common.undone } : { title: t.command.undoFailed, variant: "danger" });
              router.refresh();
            },
          },
    });
    router.push(returnTo);
    router.refresh();
  }

  async function remove() {
    if (!item || !window.confirm(t.form.confirmDelete)) return;
    setPending(true);
    const result = await deleteItem(item.id);
    setPending(false);
    if (!result.ok) {
      push({ title: t.common.somethingWrong, description: result.error, variant: "danger" });
      return;
    }
    push({ title: t.form.deleted(item.title) });
    router.push(returnTo);
    router.refresh();
  }

  const peopleChips = (selected: string | null, onSelect: (id: string | null) => void, groupLabel: string) => (
    <div role="group" aria-label={groupLabel} className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
        className={`min-h-11 rounded-full border px-4 font-medium ${
          selected === null ? "border-primary bg-primary-soft text-primary-strong" : "border-line bg-surface text-ink-dim"
        }`}
      >
        {t.common.household}
      </button>
      {people.map((person) => {
        const active = selected === person.id;
        const colors = swatch(person.color);
        return (
          <button
            key={person.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? null : person.id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-medium"
            style={{
              borderColor: active ? colors.stroke : "transparent",
              background: colors.soft,
              color: colors.ink,
            }}
          >
            {active && <Icon name="check" className="h-4 w-4" />}
            {person.name}
          </button>
        );
      })}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="item-title" className={label}>
          {t.form.title}
        </label>
        <input
          id="item-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t.form.titlePlaceholder}
          maxLength={200}
          autoFocus={!editing}
          required
          className={`${field} text-lg`}
        />
      </div>

      <fieldset>
        <legend className={label}>{t.form.who}</legend>
        {peopleChips(personId, setPersonId, t.form.who)}
      </fieldset>

      {!isStep && (
        <fieldset>
          <legend className={label}>{t.form.kind}</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ITEM_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => chooseKind(option)}
                className={`min-h-11 rounded-xl border px-2 font-medium ${
                  kind === option ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-dim"
                }`}
              >
                {t.kinds[option]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {!isStep && (
        <div>
          <label htmlFor="item-pillar" className={label}>
            {t.form.pillar}
          </label>
          <select id="item-pillar" value={pillar} onChange={(event) => setPillar(event.target.value)} className={field}>
            {PILLAR_KEYS.map((key) => (
              <option key={key} value={key}>
                {pillarName(t, key)}
                {pillarConfig(key).sensitive ? " 🔒" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="item-date" className={label}>
            {scheduled ? (effectiveRepeat === "none" ? t.form.date : t.form.startsOn) : t.form.dueDate}
          </label>
          <input id="item-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} />
        </div>
        {scheduled && (
          <>
            <div>
              <label htmlFor="item-start" className={label}>
                {t.form.startTime}
              </label>
              <input id="item-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="item-end" className={label}>
                {t.form.endTime}
              </label>
              <input id="item-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={field} />
            </div>
          </>
        )}
      </div>

      {scheduled && (
        <fieldset className="space-y-3">
          <legend className={label}>{t.form.repeat}</legend>
          <div className="flex flex-wrap gap-2">
            {(["none", "daily", "weekly", "monthly", "yearly"] as Repeat[])
              .filter((option) => kind !== "routine" || option !== "none")
              .map((option) => {
                const labels: Record<Repeat, string> = {
                  none: t.form.repeatNone,
                  daily: t.form.repeatDaily,
                  weekly: t.form.repeatWeekly,
                  monthly: t.form.repeatMonthly,
                  yearly: t.form.repeatYearly,
                };
                const active = effectiveRepeat === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setRepeat(option);
                      setRuleTouched(true);
                      if (option === "weekly" && days.length === 0) setDays([weekdayOf(date || today)]);
                    }}
                    className={`min-h-11 rounded-full border px-4 font-medium ${
                      active ? "border-primary bg-primary-soft text-primary-strong" : "border-line bg-surface text-ink-dim"
                    }`}
                  >
                    {labels[option]}
                  </button>
                );
              })}
          </div>
          {effectiveRepeat === "weekly" && (
            <div role="group" aria-label={t.form.days} className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const active = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setRuleTouched(true);
                      setDays(active ? days.filter((d) => d !== day) : [...days, day]);
                    }}
                    className={`h-11 w-12 rounded-xl border font-semibold ${
                      active ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-dim"
                    }`}
                  >
                    {t.weekdays[day]}
                  </button>
                );
              })}
            </div>
          )}
          {effectiveRepeat !== "none" && (
            <div className="max-w-xs">
              <label htmlFor="item-ends" className={label}>
                {t.form.endsOn} <span className="font-normal text-ink-faint">({t.common.optional})</span>
              </label>
              <input id="item-ends" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className={field} />
            </div>
          )}
        </fieldset>
      )}

      <button
        type="button"
        onClick={() => setMore(!more)}
        aria-expanded={more}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 font-semibold text-primary-strong"
      >
        <Icon name={more ? "x" : "plus"} className="h-4 w-4" />
        {more ? t.common.less : t.common.more}
      </button>

      {more && (
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-4">
          {kind === "event" && (
            <fieldset>
              <legend className={label}>{t.form.driver}</legend>
              {peopleChips(driverId, setDriverId, t.form.driver)}
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="item-tag" className={label}>
                {t.form.tag}
              </label>
              <select id="item-tag" value={tag} onChange={(event) => setTag(event.target.value)} className={field}>
                <option value="">{t.common.none}</option>
                {[...KNOWN_TAGS, ...(tag && !(KNOWN_TAGS as readonly string[]).includes(tag) ? [tag] : [])].map((option) => (
                  <option key={option} value={option}>
                    {tagLabel(t, option)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="item-location" className={label}>
                {t.form.location}
              </label>
              <input
                id="item-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={t.form.locationPlaceholder}
                maxLength={120}
                className={field}
              />
            </div>
          </div>

          {(kind === "task" || kind === "project" || kind === "record") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="item-status" className={label}>
                  {t.form.status}
                </label>
                <select id="item-status" value={status} onChange={(event) => setStatus(event.target.value as ItemStatus)} className={field}>
                  {ITEM_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {t.statuses[option]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="item-priority" className={label}>
                  {t.form.priority}
                </label>
                <select
                  id="item-priority"
                  value={priority}
                  onChange={(event) => setPriority(Number(event.target.value) as 1 | 2 | 3)}
                  className={field}
                >
                  <option value={1}>{t.form.priorityHigh}</option>
                  <option value={2}>{t.form.priorityNormal}</option>
                  <option value={3}>{t.form.priorityLow}</option>
                </select>
              </div>
            </div>
          )}

          {(kind === "project" || kind === "task") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="item-next" className={label}>
                  {t.form.nextAction}
                </label>
                <input id="item-next" value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={200} className={field} />
              </div>
              <div>
                <label htmlFor="item-waiting" className={label}>
                  {t.form.waitingOn}
                </label>
                <input id="item-waiting" value={waitingOn} onChange={(event) => setWaitingOn(event.target.value)} maxLength={200} className={field} />
              </div>
            </div>
          )}

          {kind !== "record" && kind !== "routine" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="item-progress-total" className={label}>
                  {t.form.progressTotal} <span className="font-normal text-ink-faint">({t.common.optional})</span>
                </label>
                <input
                  id="item-progress-total"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={progressTotal}
                  onChange={(event) => setProgressTotal(event.target.value)}
                  className={field}
                />
              </div>
              {progressTotal && (
                <div>
                  <label htmlFor="item-progress-done" className={label}>
                    {t.form.progressDone}
                  </label>
                  <input
                    id="item-progress-done"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={progressDone}
                    onChange={(event) => setProgressDone(event.target.value)}
                    className={field}
                  />
                </div>
              )}
            </div>
          )}

          {(kind === "event" || kind === "project") && (
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={countdown}
                onChange={(event) => setCountdown(event.target.checked)}
                className="h-5 w-5 accent-[var(--color-primary)]"
              />
              <span>{t.form.countdown}</span>
            </label>
          )}

          <div>
            <label htmlFor="item-details" className={label}>
              {t.form.details}
            </label>
            <textarea
              id="item-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink"
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-xl bg-primary px-6 font-semibold text-white hover:bg-primary-strong disabled:opacity-60 sm:flex-none"
        >
          {pending ? t.common.saving : t.common.save}
        </button>
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className="min-h-12 rounded-xl border border-line bg-surface px-5 font-medium text-ink-dim"
        >
          {t.common.cancel}
        </button>
        {editing && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ml-auto min-h-12 rounded-xl px-4 font-medium text-danger hover:bg-danger-soft"
          >
            {t.common.delete}
          </button>
        )}
      </div>
    </form>
  );
}
