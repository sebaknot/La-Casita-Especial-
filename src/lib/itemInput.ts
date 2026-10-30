/**
 * One validator for every way an item gets written: Quick Add, edit forms,
 * and the command bar. Anything it doesn't recognise is dropped, never passed
 * through to the database.
 */
import { isPillarKey } from "../config/pillars.ts";
import { isISODate, normalizeTime } from "./dates.ts";
import { parseRule } from "./recurrence.ts";
import { isItemKind, isItemStatus, type Item } from "./types.ts";

export type ItemPatch = Partial<
  Pick<
    Item,
    | "pillar_key"
    | "person_id"
    | "responsible_person_id"
    | "kind"
    | "tag"
    | "title"
    | "details"
    | "location"
    | "starts_on"
    | "ends_on"
    | "start_time"
    | "end_time"
    | "recurrence"
    | "due_date"
    | "countdown"
    | "status"
    | "priority"
    | "next_action"
    | "waiting_on"
    | "progress_done"
    | "progress_total"
    | "parent_id"
    | "sort_order"
  >
>;

export type ItemInputError = "title" | "pillar" | "kind" | "date" | "identifier";

/** Same pattern the database check uses: SSN-shaped or 8+ digit runs. */
export const IDENTIFIER_PATTERN = /(\d{3}-?\d{2}-?\d{4})|(\d{8,})/;

const RULE_SHAPE = /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : null;
}

function longText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function count(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : null;
}

/**
 * @param raw     untrusted input (form or parsed command)
 * @param peopleIds  ids that belong to this household
 * @param partial when true (edits), only keys present in `raw` are emitted
 */
export function sanitizeItem(
  raw: Record<string, unknown>,
  peopleIds: Set<string>,
  partial: boolean,
): { ok: true; patch: ItemPatch } | { ok: false; error: ItemInputError } {
  const has = (key: string) => !partial || Object.prototype.hasOwnProperty.call(raw, key);
  const patch: ItemPatch = {};

  if (has("title")) {
    const title = text(raw.title, 200);
    if (!title) return { ok: false, error: "title" };
    patch.title = title;
  }
  if (has("pillar_key")) {
    if (!isPillarKey(raw.pillar_key)) return { ok: false, error: "pillar" };
    patch.pillar_key = raw.pillar_key;
  }
  if (has("kind")) {
    if (!isItemKind(raw.kind)) return { ok: false, error: "kind" };
    patch.kind = raw.kind;
  }

  const person = (key: "person_id" | "responsible_person_id") => {
    if (!has(key)) return;
    const value = raw[key];
    patch[key] = typeof value === "string" && peopleIds.has(value) ? value : null;
  };
  person("person_id");
  person("responsible_person_id");

  if (has("tag")) {
    const tag = typeof raw.tag === "string" ? raw.tag.trim().toLowerCase() : "";
    patch.tag = /^[a-z_]{1,30}$/.test(tag) ? tag : null;
  }
  if (has("details")) patch.details = longText(raw.details, 2000);
  if (has("location")) patch.location = text(raw.location, 120);
  if (has("next_action")) patch.next_action = text(raw.next_action, 200);
  if (has("waiting_on")) patch.waiting_on = text(raw.waiting_on, 200);

  for (const key of ["starts_on", "ends_on", "due_date"] as const) {
    if (has(key)) patch[key] = isISODate(raw[key]) ? (raw[key] as string) : null;
  }
  for (const key of ["start_time", "end_time"] as const) {
    if (has(key)) patch[key] = normalizeTime(raw[key]);
  }
  if (patch.start_time && patch.end_time && patch.end_time <= patch.start_time) patch.end_time = null;
  if (patch.starts_on && patch.ends_on && patch.ends_on < patch.starts_on) patch.ends_on = null;

  if (has("recurrence")) {
    const rule = typeof raw.recurrence === "string" ? raw.recurrence.trim().toUpperCase() : "";
    patch.recurrence = rule && RULE_SHAPE.test(rule) && parseRule(rule) ? rule : null;
  }
  if (patch.recurrence && has("starts_on") && !patch.starts_on) return { ok: false, error: "date" };
  if (!partial && patch.kind === "routine" && !patch.recurrence) return { ok: false, error: "date" };

  if (has("countdown")) patch.countdown = raw.countdown === true || raw.countdown === "on" || raw.countdown === "true";
  if (has("status")) patch.status = isItemStatus(raw.status) ? raw.status : "open";
  if (has("priority")) {
    const p = Number(raw.priority);
    patch.priority = p === 1 || p === 3 ? p : 2;
  }
  if (has("progress_total")) patch.progress_total = count(raw.progress_total) || null;
  if (has("progress_done")) patch.progress_done = count(raw.progress_done);
  if (patch.progress_total && patch.progress_done == null && !partial) patch.progress_done = 0;
  if (patch.progress_total && patch.progress_done != null && patch.progress_done > patch.progress_total) {
    patch.progress_done = patch.progress_total;
  }
  if (has("sort_order")) patch.sort_order = count(raw.sort_order) ?? 0;
  if (has("parent_id")) patch.parent_id = typeof raw.parent_id === "string" && raw.parent_id ? raw.parent_id : null;

  // Records keep status and links only.
  if (patch.kind === "record") {
    if (IDENTIFIER_PATTERN.test(`${patch.title ?? ""} ${patch.details ?? ""}`)) return { ok: false, error: "identifier" };
    patch.progress_done = null;
    patch.progress_total = null;
  }
  return { ok: true, patch };
}
