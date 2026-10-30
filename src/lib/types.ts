import type { PillarKey } from "../config/pillars.ts";
import type { PaletteKey } from "../config/palette.ts";

export type ItemKind = "event" | "routine" | "task" | "project" | "record";
export type ItemStatus = "open" | "in_progress" | "waiting" | "done" | "archived";
export type Relation = "self" | "partner" | "child" | "grandparent" | "relative" | "other";

export const ITEM_KINDS: ItemKind[] = ["task", "event", "routine", "project", "record"];
export const ITEM_STATUSES: ItemStatus[] = ["open", "in_progress", "waiting", "done", "archived"];
export const RELATIONS: Relation[] = ["self", "partner", "child", "grandparent", "relative", "other"];

/** Tags with built-in meaning. Free-form tags are allowed too. */
export const RIDE_TAGS = ["pickup", "dropoff"] as const;
export const KIDS_REMINDER_TAGS = ["homework", "supplies", "uniform", "school_event", "teacher_meeting", "school"] as const;
export const KNOWN_TAGS = [
  ...RIDE_TAGS,
  ...KIDS_REMINDER_TAGS,
  "activity",
  "cleaning",
  "organization",
  "groceries",
  "busy",
] as const;
export type KnownTag = (typeof KNOWN_TAGS)[number];

export function isRide(tag: string | null): boolean {
  return tag === "pickup" || tag === "dropoff";
}

export interface Household {
  id: string;
  name: string;
  timezone: string;
  school_events_url: string | null;
}

export interface Person {
  id: string;
  household_id: string;
  name: string;
  relation: Relation;
  color: PaletteKey | string;
  birthday: string | null;
  sort_order: number;
}

export interface Item {
  id: string;
  household_id: string;
  pillar_key: PillarKey | string;
  person_id: string | null;
  responsible_person_id: string | null;
  kind: ItemKind;
  tag: string | null;
  title: string;
  details: string | null;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  start_time: string | null;
  end_time: string | null;
  recurrence: string | null;
  due_date: string | null;
  countdown: boolean;
  status: ItemStatus;
  priority: 1 | 2 | 3;
  next_action: string | null;
  waiting_on: string | null;
  budget: number | null;
  progress_done: number | null;
  progress_total: number | null;
  parent_id: string | null;
  template_id: string | null;
  sort_order: number;
  source: "app" | "google" | "ics";
  external_id: string | null;
  calendar_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleTemplate {
  id: string;
  household_id: string;
  pillar_key: string;
  name: string;
  location: string | null;
  slots: { days: string; start: string; end: string; title: string }[];
}

export interface RecordLink {
  id: string;
  item_id: string;
  label: string;
  url: string;
}

export interface RoutineCompletion {
  item_id: string;
  on_date: string;
}

export interface ActivityEntry {
  id: string;
  pillar_key: string | null;
  action: string;
  source: "ui" | "command";
  created_at: string;
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === "string" && (ITEM_KINDS as string[]).includes(value);
}

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === "string" && (ITEM_STATUSES as string[]).includes(value);
}

export function isRelation(value: unknown): value is Relation {
  return typeof value === "string" && (RELATIONS as string[]).includes(value);
}

/** A project with its steps attached, ordered. */
export function stepsOf(projectId: string, items: Item[]): Item[] {
  return items
    .filter((item) => item.parent_id === projectId && item.status !== "archived")
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export function stepProgress(projectId: string, items: Item[]): { done: number; total: number } {
  const steps = stepsOf(projectId, items);
  return { done: steps.filter((step) => step.status === "done").length, total: steps.length };
}
