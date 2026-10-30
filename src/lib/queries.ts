import type { Supabase } from "@/lib/session";
import { addDays } from "@/lib/dates";
import type { Item, Person, RecordLink, RoutineCompletion, ScheduleTemplate } from "@/lib/types";

/** Streaks look back this far. */
const COMPLETION_HISTORY_DAYS = 120;

export async function getPeople(supabase: Supabase, householdId: string): Promise<Person[]> {
  const { data } = await supabase
    .from("people")
    .select("*")
    .eq("household_id", householdId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as Person[];
}

/** Every live item in the household — a family's data is small enough to take whole. */
export async function getItems(supabase: Supabase, householdId: string, pillarKey?: string): Promise<Item[]> {
  let query = supabase.from("items").select("*").eq("household_id", householdId).neq("status", "archived");
  if (pillarKey) query = query.eq("pillar_key", pillarKey);
  const { data } = await query.order("sort_order").order("created_at");
  return (data ?? []) as Item[];
}

export async function getCompletions(
  supabase: Supabase,
  itemIds: string[],
  today: string,
): Promise<RoutineCompletion[]> {
  if (itemIds.length === 0) return [];
  const { data } = await supabase
    .from("routine_completions")
    .select("item_id, on_date")
    .in("item_id", itemIds)
    .gte("on_date", addDays(today, -COMPLETION_HISTORY_DAYS));
  return (data ?? []) as RoutineCompletion[];
}

export async function getTemplates(supabase: Supabase, householdId: string): Promise<ScheduleTemplate[]> {
  const { data } = await supabase.from("schedule_templates").select("*").eq("household_id", householdId).order("created_at");
  return (data ?? []) as ScheduleTemplate[];
}

export async function getRecordLinks(supabase: Supabase, itemIds: string[]): Promise<RecordLink[]> {
  if (itemIds.length === 0) return [];
  const { data } = await supabase.from("record_links").select("*").in("item_id", itemIds).order("created_at");
  return (data ?? []) as RecordLink[];
}

export async function getItem(supabase: Supabase, id: string): Promise<Item | null> {
  const { data } = await supabase.from("items").select("*").eq("id", id).maybeSingle();
  return (data as Item | null) ?? null;
}

export async function getSteps(supabase: Supabase, projectId: string): Promise<Item[]> {
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("parent_id", projectId)
    .neq("status", "archived")
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as Item[];
}
