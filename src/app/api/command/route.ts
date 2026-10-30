import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { isPillarKey, PILLAR_KEYS, pillarConfig } from "@/config/pillars";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { dict, isLocale, pillarName, type Locale } from "@/i18n";
import { buildSystemPrompt, COMMAND_SCHEMA, type ParsedCommand, type ParsedFields } from "@/lib/command/prompt";
import { fuzzyMatch } from "@/lib/command/match";
import { formatDate, formatTime, isISODate, normalizeTime, toUTC, todayISO, weekdayOf, WEEKDAYS, type Weekday } from "@/lib/dates";
import { sanitizeItem } from "@/lib/itemInput";
import { getItems, getPeople } from "@/lib/queries";
import { weeklyRule } from "@/lib/recurrence";
import { getSession, householdTZ, type HouseholdSession } from "@/lib/session";
import type { Item, Person } from "@/lib/types";

export const runtime = "nodejs";

const MODEL = process.env.COMMAND_MODEL ?? "claude-opus-5-5";
// If the main model declines a request, the API retries it on this one inside the same call.
const FALLBACK_MODEL = process.env.COMMAND_FALLBACK_MODEL ?? "claude-opus-4-8";

type Reply =
  | { status: "executed"; message: string; undo?: Record<string, unknown> }
  | { status: "clarify"; question: string }
  | { status: "error"; message: string };

function json(body: Reply, status = 200) {
  return NextResponse.json(body, { status });
}

/** Pages that must never send their context to the AI. */
async function onSensitivePage(session: HouseholdSession, pathname: unknown): Promise<boolean> {
  if (typeof pathname !== "string") return false;
  const pillar = /^\/p\/([^/?#]+)/.exec(pathname);
  if (pillar) return pillarConfig(pillar[1]).sensitive;
  const item = /^\/item\/([0-9a-f-]{36})/i.exec(pathname);
  if (item) {
    const { data } = await session.supabase.from("items").select("pillar_key").eq("id", item[1]).maybeSingle();
    return data ? pillarConfig(data.pillar_key as string).sensitive : false;
  }
  return false;
}

function recurrenceFor(fields: ParsedFields, startsOn: string): string | null {
  switch (fields.repeat) {
    case "daily":
      return "FREQ=DAILY";
    case "weekly": {
      const days = (fields.days ?? []).filter((d): d is Weekday => (WEEKDAYS as string[]).includes(d));
      return weeklyRule(days.length > 0 ? days : [weekdayOf(startsOn)]);
    }
    case "monthly":
      return `FREQ=MONTHLY;BYDAY=${Math.min(4, Math.ceil(toUTC(startsOn).getUTCDate() / 7))}${weekdayOf(startsOn)}`;
    case "yearly":
      return "FREQ=YEARLY";
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  let body: { text?: unknown; locale?: unknown; pathname?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ status: "error", message: "Invalid request" }, 400);
  }
  const locale: Locale = isLocale(body.locale) ? body.locale : "en";
  const t = dict(locale);

  if (!session.userId || !session.household) return json({ status: "error", message: t.common.unauthorized }, 401);
  const hs = session as HouseholdSession;

  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!text) return json({ status: "error", message: t.commandServer.empty }, 400);
  if (await onSensitivePage(hs, body.pathname)) return json({ status: "clarify", question: t.commandServer.sensitive });
  if (!process.env.ANTHROPIC_API_KEY) return json({ status: "error", message: t.commandServer.noAI }, 503);

  const timezone = householdTZ(hs.household);
  const today = todayISO(timezone);
  const [people, allItems] = await Promise.all([getPeople(hs.supabase, hs.household.id), getItems(hs.supabase, hs.household.id)]);

  // Sensitive pillars and everything in them stay out of the prompt entirely.
  const openPillars = PILLAR_KEYS.filter((key) => !pillarConfig(key).sensitive);
  const openItems = allItems.filter(
    (item) =>
      !pillarConfig(item.pillar_key).sensitive &&
      item.parent_id === null &&
      item.status !== "done" &&
      item.status !== "archived",
  );

  let parsed: ParsedCommand;
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 2048,
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: FALLBACK_MODEL }],
      output_config: { effort: "low", format: { type: "json_schema", schema: COMMAND_SCHEMA as unknown as Record<string, unknown> } },
      system: buildSystemPrompt({
        today,
        timezone,
        locale,
        people,
        pillars: openPillars.map((key) => ({ key, name_en: en.pillars[key].name, name_es: es.pillars[key].name })),
        openItems,
      }),
      messages: [{ role: "user", content: text }],
    });

    if (response.stop_reason === "refusal") return json({ status: "clarify", question: t.commandServer.parseFailed });
    const raw = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    parsed = JSON.parse(raw) as ParsedCommand;
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`Command parse failed (${error.status}):`, error.message);
    else console.error("Command parse failed:", error);
    return json({ status: "error", message: t.commandServer.parseFailed }, 502);
  }

  const personNamed = (name: string | null): { ok: true; person: Person | null } | { ok: false; name: string } => {
    if (!name) return { ok: true, person: null };
    const matches = fuzzyMatch(name, people, (p) => p.name);
    return matches.length === 1 ? { ok: true, person: matches[0] } : { ok: false, name };
  };

  const resolveItem = (match: string | null): { ok: true; item: Item } | { ok: false; question: string } => {
    const matches = fuzzyMatch(String(match ?? ""), openItems, (item) => item.title);
    if (matches.length === 1) return { ok: true, item: matches[0] };
    if (matches.length === 0) return { ok: false, question: t.commandServer.notFound(String(match ?? "")) };
    return {
      ok: false,
      question: t.commandServer.multiple(
        matches
          .slice(0, 4)
          .map((m) => `“${m.title}”`)
          .join(", "),
      ),
    };
  };

  async function log(pillarKey: string, action: string) {
    // The DB trigger also scrubs raw_input on sensitive pillars; this keeps it out at the source.
    await hs.supabase.from("activity_log").insert({
      household_id: hs.household.id,
      pillar_key: pillarKey,
      action,
      source: "command",
      raw_input: pillarConfig(pillarKey).sensitive ? null : text,
    });
  }

  const peopleIds = new Set(people.map((p) => p.id));

  try {
    switch (parsed.action) {
      case "clarify":
        return json({ status: "clarify", question: parsed.question || t.commandServer.fallback });

      case "create_item": {
        const fields = parsed.fields;
        if (!fields?.title) return json({ status: "clarify", question: t.commandServer.whatTitle });
        if (!fields.pillar || !isPillarKey(fields.pillar)) return json({ status: "clarify", question: t.commandServer.whichPillar });
        if (pillarConfig(fields.pillar).sensitive) return json({ status: "clarify", question: t.commandServer.sensitive });

        const person = personNamed(fields.person);
        if (!person.ok) return json({ status: "clarify", question: t.commandServer.unknownPerson(person.name) });
        const responsible = personNamed(fields.responsible);
        if (!responsible.ok) return json({ status: "clarify", question: t.commandServer.unknownPerson(responsible.name) });

        const kind = fields.kind ?? "task";
        const scheduled = kind === "event" || kind === "routine";
        const date = isISODate(fields.date) ? fields.date : null;
        const startsOn = scheduled ? (date ?? today) : null;
        const repeat = kind === "routine" && (!fields.repeat || fields.repeat === "none") ? "weekly" : fields.repeat;
        const recurrence = startsOn ? recurrenceFor({ ...fields, repeat }, startsOn) : null;

        const result = sanitizeItem(
          {
            title: fields.title,
            kind,
            pillar_key: fields.pillar,
            person_id: person.person?.id ?? null,
            responsible_person_id: responsible.person?.id ?? null,
            details: fields.details,
            location: fields.location,
            tag: fields.tag,
            starts_on: startsOn,
            start_time: scheduled ? fields.start_time : null,
            end_time: scheduled ? fields.end_time : null,
            recurrence,
            due_date: scheduled ? null : (fields.due_date ?? date),
            status: fields.status ?? "open",
          },
          peopleIds,
          false,
        );
        if (!result.ok) return json({ status: "clarify", question: t.commandServer.fallback });

        const { data, error } = await hs.supabase
          .from("items")
          .insert({ ...result.patch, household_id: hs.household.id, created_by: hs.userId })
          .select()
          .single();
        if (error) throw error;
        const item = data as Item;

        const tag = locale === "es" ? "es-US" : "en-US";
        const when = item.starts_on
          ? `${formatDate(item.starts_on, tag)}${item.start_time ? ` ${formatTime(normalizeTime(item.start_time), tag)}` : ""}`
          : item.due_date
            ? formatDate(item.due_date, tag)
            : "";
        const message = t.commandServer.added(item.title, pillarName(t, item.pillar_key), when);
        await log(item.pillar_key, message);
        return json({ status: "executed", message, undo: { op: "delete_item", id: item.id } });
      }

      case "update_item": {
        const resolved = resolveItem(parsed.match);
        if (!resolved.ok) return json({ status: "clarify", question: resolved.question });
        const target = resolved.item;
        const fields = parsed.fields;
        if (!fields) return json({ status: "clarify", question: t.commandServer.nothingToChange(target.title) });

        const raw: Record<string, unknown> = {};
        if (fields.title) raw.title = fields.title;
        if (fields.details) raw.details = fields.details;
        if (fields.location) raw.location = fields.location;
        if (fields.tag) raw.tag = fields.tag;
        if (fields.status) raw.status = fields.status;
        if (fields.start_time) raw.start_time = fields.start_time;
        if (fields.end_time) raw.end_time = fields.end_time;
        if (fields.due_date) raw.due_date = fields.due_date;
        if (fields.date) raw[target.kind === "event" || target.kind === "routine" ? "starts_on" : "due_date"] = fields.date;
        if (fields.pillar && isPillarKey(fields.pillar)) {
          if (pillarConfig(fields.pillar).sensitive) return json({ status: "clarify", question: t.commandServer.sensitive });
          raw.pillar_key = fields.pillar;
        }
        for (const [key, name] of [
          ["person_id", fields.person],
          ["responsible_person_id", fields.responsible],
        ] as const) {
          if (!name) continue;
          const found = personNamed(name);
          if (!found.ok) return json({ status: "clarify", question: t.commandServer.unknownPerson(found.name) });
          raw[key] = found.person?.id ?? null;
        }
        if (fields.repeat && fields.repeat !== "none" && (target.kind === "event" || target.kind === "routine")) {
          raw.recurrence = recurrenceFor(fields, (raw.starts_on as string) ?? target.starts_on ?? today);
          if (!target.starts_on && !raw.starts_on) raw.starts_on = today;
        }

        const result = sanitizeItem(raw, peopleIds, true);
        if (!result.ok || Object.keys(result.patch).length === 0)
          return json({ status: "clarify", question: t.commandServer.nothingToChange(target.title) });

        const patch: Record<string, unknown> = { ...result.patch };
        if (patch.status === "done") patch.completed_at = new Date().toISOString();
        const prev: Record<string, unknown> = {};
        for (const key of Object.keys(patch)) prev[key] = (target as unknown as Record<string, unknown>)[key];

        const { error } = await hs.supabase.from("items").update(patch).eq("id", target.id);
        if (error) throw error;
        const message = t.commandServer.updated(target.title);
        await log((patch.pillar_key as string) ?? target.pillar_key, message);
        return json({ status: "executed", message, undo: { op: "restore_item", id: target.id, prev } });
      }

      case "complete": {
        const resolved = resolveItem(parsed.match);
        if (!resolved.ok) return json({ status: "clarify", question: resolved.question });
        const target = resolved.item;

        if (target.kind === "routine") {
          const onDate = isISODate(parsed.on_date) && parsed.on_date <= today ? parsed.on_date : today;
          const { error } = await hs.supabase
            .from("routine_completions")
            .upsert({ item_id: target.id, on_date: onDate, completed_by: hs.userId }, { onConflict: "item_id,on_date" });
          if (error) throw error;
          const message = t.commandServer.routineChecked(target.title, formatDate(onDate, locale === "es" ? "es-US" : "en-US"));
          await log(target.pillar_key, message);
          return json({ status: "executed", message, undo: { op: "delete_completion", id: target.id, date: onDate } });
        }

        const { error } = await hs.supabase
          .from("items")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", target.id);
        if (error) throw error;
        const message = t.commandServer.completed(target.title);
        await log(target.pillar_key, message);
        return json({
          status: "executed",
          message,
          undo: { op: "restore_item", id: target.id, prev: { status: target.status, completed_at: target.completed_at } },
        });
      }

      default:
        return json({ status: "clarify", question: t.commandServer.fallback });
    }
  } catch (error) {
    console.error("Command execution failed:", error);
    return json({ status: "error", message: t.commandServer.execFailed }, 500);
  }
}
