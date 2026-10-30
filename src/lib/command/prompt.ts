import { addDays, formatDate, weekdayOf, type ISODate } from "../dates.ts";
import type { Item, Person } from "../types.ts";

export interface PromptPillar {
  key: string;
  name_en: string;
  name_es: string;
}

/**
 * The parser prompt. It only ever sees NON-sensitive pillars and their items —
 * the caller filters before building it.
 */
export function buildSystemPrompt(input: {
  today: ISODate;
  timezone: string;
  locale: "en" | "es";
  people: Person[];
  pillars: PromptPillar[];
  openItems: Item[];
}): string {
  const { today, people, pillars, openItems } = input;

  // A two-week calendar so "el jueves", "next Monday", "mañana" resolve exactly.
  const calendar = Array.from({ length: 15 }, (_, i) => {
    const date = addDays(today, i);
    const label = i === 0 ? " (today / hoy)" : i === 1 ? " (tomorrow / mañana)" : i === 2 ? " (pasado mañana)" : "";
    return `- ${formatDate(date, "en-US", { weekday: "long" })} / ${formatDate(date, "es-US", { weekday: "long" })} ${date} [${weekdayOf(date)}]${label}`;
  }).join("\n");

  const peopleLines = people.map((p) => `- ${p.name} (${p.relation})`).join("\n");
  const pillarLines = pillars.map((p) => `- ${p.key}: "${p.name_en}" / "${p.name_es}"`).join("\n");
  const itemLines = openItems
    .slice(0, 80)
    .map((i) => `- [${i.pillar_key}/${i.kind}${i.tag ? `/${i.tag}` : ""}] ${i.title}`)
    .join("\n");

  return `You turn short family-planning commands into one JSON action for "La Casita Especial", a household dashboard for a working mom, her husband, two girls and extended family. Commands arrive in English or Spanish (often mixed, often informal). The user's interface language is ${input.locale === "es" ? "Spanish" : "English"}: write any "question" in that language.

Today is ${today} in ${input.timezone}. Upcoming days:
${calendar}

People in the household (use these exact names in "person" / "responsible"):
${peopleLines || "(none yet)"}

Pillars you may use (pillar keys):
${pillarLines}

Open items you may update or complete (match by title):
${itemLines || "(none)"}

Actions:
- create_item: something new. Fill "fields".
- update_item: change an existing item from the list above. "match" = a short phrase from its title; "fields" holds ONLY what changes (everything else null).
- complete: the user says something is done ("ya lavé los uniformes", "done with milk"). "match" = phrase from its title; "on_date" = the day it was done (default today).
- clarify: the pillar, the person, or the target item is genuinely ambiguous, or the request belongs to a pillar not listed above. Ask ONE short question in "question".

Field rules:
- kind: event (has a date/time: appointments, practices, parties, rides), routine (repeats and gets checked off: chores, prayers, homework day), task (a to-do, reminder, or shopping-list item), project (multi-step: trips, remodels).
- Kids' school things (homework, supplies, uniforms, school events, teacher meetings, rides) go in "kids". Groceries, cleaning, organizing, home projects go in "home". Mass, prayer, confession, Bible go in "faith". Holidays, birthdays, trips go in "family". Workouts, doctor, dentist go in "health" (use "kids" if it is clearly a child's school activity).
- Spanish cues: "recoger" = pickup, "dejar/llevar" = dropoff, "maneja/lleva Andy" = responsible Andy, "todos los martes" = weekly TU, "cada día" = daily, "el jueves" = the next Thursday on or after today, "mañana" = tomorrow, "a las 3" = 15:00 when it is clearly afternoon (school/activities), "tarea" = homework, "útiles" = supplies, "uniformes" = uniform.
- date: YYYY-MM-DD from the calendar above (first occurrence for repeating items). due_date: for tasks with a deadline ("by Friday", "para el viernes").
- start_time / end_time: 24h HH:MM.
- repeat + days: weekly needs days (MO TU WE TH FR SA SU). Routines must repeat.
- tag: one of pickup, dropoff, school, homework, supplies, uniform, school_event, teacher_meeting, activity, cleaning, organization, groceries — or null.
- title: short and natural, in the language the user wrote. Put extra context in "details".
- Never invent people. If a name isn't in the list, use clarify.`;
}

const nullable = (type: string) => ({ type: [type, "null"] });

export const COMMAND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action", "question", "match", "on_date", "fields"],
  properties: {
    action: { type: "string", enum: ["create_item", "update_item", "complete", "clarify"] },
    question: nullable("string"),
    match: nullable("string"),
    on_date: nullable("string"),
    fields: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "pillar",
            "kind",
            "title",
            "details",
            "person",
            "responsible",
            "date",
            "due_date",
            "start_time",
            "end_time",
            "repeat",
            "days",
            "location",
            "tag",
            "status",
          ],
          properties: {
            pillar: nullable("string"),
            kind: { anyOf: [{ type: "null" }, { type: "string", enum: ["event", "routine", "task", "project"] }] },
            title: nullable("string"),
            details: nullable("string"),
            person: nullable("string"),
            responsible: nullable("string"),
            date: nullable("string"),
            due_date: nullable("string"),
            start_time: nullable("string"),
            end_time: nullable("string"),
            repeat: { anyOf: [{ type: "null" }, { type: "string", enum: ["none", "daily", "weekly", "monthly", "yearly"] }] },
            days: {
              anyOf: [
                { type: "null" },
                { type: "array", items: { type: "string", enum: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] } },
              ],
            },
            location: nullable("string"),
            tag: nullable("string"),
            status: { anyOf: [{ type: "null" }, { type: "string", enum: ["open", "in_progress", "waiting", "done"] }] },
          },
        },
      ],
    },
  },
} as const;

export interface ParsedFields {
  pillar: string | null;
  kind: "event" | "routine" | "task" | "project" | null;
  title: string | null;
  details: string | null;
  person: string | null;
  responsible: string | null;
  date: string | null;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  repeat: "none" | "daily" | "weekly" | "monthly" | "yearly" | null;
  days: string[] | null;
  location: string | null;
  tag: string | null;
  status: "open" | "in_progress" | "waiting" | "done" | null;
}

export interface ParsedCommand {
  action: "create_item" | "update_item" | "complete" | "clarify";
  question: string | null;
  match: string | null;
  on_date: string | null;
  fields: ParsedFields | null;
}
