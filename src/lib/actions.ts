"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, getT, syncPillars, type HouseholdSession, type Supabase } from "@/lib/session";
import { isLocale, LOCALE_COOKIE, pillarName, type Locale } from "@/i18n";
import { PALETTE_KEYS } from "@/config/palette";
import { isISODate } from "@/lib/dates";
import { sanitizeItem, type ItemInputError } from "@/lib/itemInput";
import { isRelation, type ActionResult, type Item, type ItemStatus, type Person } from "@/lib/types";

/* ---------------- plumbing ---------------- */

async function householdSession(): Promise<HouseholdSession | null> {
  const session = await getSession();
  return session.userId && session.household ? (session as HouseholdSession) : null;
}

async function unauthorized<T>(): Promise<ActionResult<T>> {
  return { ok: false, error: (await getT()).common.unauthorized };
}

async function failure<T>(message?: string): Promise<ActionResult<T>> {
  const t = await getT();
  if (message) console.error("Action failed:", message);
  return { ok: false, error: t.common.somethingWrong };
}

/** UI mutations never store raw input — only the human-readable action. */
async function logActivity(supabase: Supabase, householdId: string, pillarKey: string | null, action: string) {
  await supabase.from("activity_log").insert({ household_id: householdId, pillar_key: pillarKey, action, source: "ui" });
}

function refresh() {
  revalidatePath("/", "layout");
}

async function peopleIds(session: HouseholdSession): Promise<Set<string>> {
  const { data } = await session.supabase.from("people").select("id").eq("household_id", session.household.id);
  return new Set((data ?? []).map((row) => row.id as string));
}

async function inputError(error: ItemInputError): Promise<ActionResult<Item>> {
  const t = await getT();
  const messages: Record<ItemInputError, string> = {
    title: t.form.titleRequired,
    pillar: t.form.pillarRequired,
    kind: t.form.pillarRequired,
    date: t.form.dateRequired,
    identifier: t.form.identifier,
  };
  return { ok: false, error: messages[error] };
}

/* ---------------- items ---------------- */

export async function createItem(raw: Record<string, unknown>): Promise<ActionResult<Item>> {
  const session = await householdSession();
  if (!session) return unauthorized();

  const result = sanitizeItem(raw, await peopleIds(session), false);
  if (!result.ok) return inputError(result.error);

  const { data, error } = await session.supabase
    .from("items")
    .insert({ ...result.patch, household_id: session.household.id, created_by: session.userId })
    .select()
    .single();
  if (error) return failure(error.message);

  const item = data as Item;
  const t = await getT();
  await logActivity(session.supabase, session.household.id, item.pillar_key, `${t.form.added(item.title)} · ${pillarName(t, item.pillar_key)}`);
  refresh();
  return { ok: true, data: item };
}

export async function updateItem(id: string, raw: Record<string, unknown>): Promise<ActionResult<Item>> {
  const session = await householdSession();
  if (!session) return unauthorized();

  const result = sanitizeItem(raw, await peopleIds(session), true);
  if (!result.ok) return inputError(result.error);

  const patch: Record<string, unknown> = { ...result.patch };
  if (result.patch.status === "done") patch.completed_at = new Date().toISOString();
  else if (result.patch.status) patch.completed_at = null;

  const { data, error } = await session.supabase.from("items").update(patch).eq("id", id).select().single();
  if (error) return failure(error.message);

  const item = data as Item;
  const t = await getT();
  await logActivity(session.supabase, session.household.id, item.pillar_key, t.form.saved(item.title));
  refresh();
  return { ok: true, data: item };
}

export async function setItemStatus(id: string, status: ItemStatus): Promise<ActionResult<Item>> {
  return updateItem(id, { status });
}

export async function deleteItem(id: string): Promise<ActionResult> {
  const session = await householdSession();
  if (!session) return unauthorized();

  const { data, error } = await session.supabase.from("items").delete().eq("id", id).select("title, pillar_key").maybeSingle();
  if (error) return failure(error.message);

  if (data) {
    const t = await getT();
    await logActivity(session.supabase, session.household.id, data.pillar_key as string, t.form.deleted(data.title as string));
  }
  refresh();
  return { ok: true };
}

/** Adds a step under a project. */
export async function addStep(projectId: string, title: string): Promise<ActionResult<Item>> {
  const session = await householdSession();
  if (!session) return unauthorized();

  const { data: project } = await session.supabase
    .from("items")
    .select("id, pillar_key, kind")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.kind !== "project") return failure("parent is not a project");

  const { count } = await session.supabase.from("items").select("id", { count: "exact", head: true }).eq("parent_id", projectId);
  return createItem({ title, kind: "task", pillar_key: project.pillar_key, parent_id: projectId, sort_order: (count ?? 0) + 1 });
}

/* ---------------- routines + progress ---------------- */

export async function setRoutineDone(itemId: string, date: string, done: boolean): Promise<ActionResult> {
  const session = await householdSession();
  if (!session) return unauthorized();
  if (!isISODate(date)) return failure("bad date");

  const { data: item } = await session.supabase.from("items").select("title, pillar_key").eq("id", itemId).maybeSingle();
  if (!item) return failure("routine not found");

  const { error } = done
    ? await session.supabase
        .from("routine_completions")
        .upsert({ item_id: itemId, on_date: date, completed_by: session.userId }, { onConflict: "item_id,on_date" })
    : await session.supabase.from("routine_completions").delete().eq("item_id", itemId).eq("on_date", date);
  if (error) return failure(error.message);

  const t = await getT();
  await logActivity(
    session.supabase,
    session.household.id,
    item.pillar_key as string,
    done ? t.pillar.routineDone(item.title as string) : t.pillar.routineUndone(item.title as string),
  );
  refresh();
  return { ok: true };
}

export async function setProgress(itemId: string, done: number): Promise<ActionResult<Item>> {
  const session = await householdSession();
  if (!session) return unauthorized();
  const { data: item } = await session.supabase.from("items").select("progress_total").eq("id", itemId).maybeSingle();
  if (!item?.progress_total) return failure("not a progress item");
  const clamped = Math.max(0, Math.min(Math.round(done), item.progress_total as number));
  return updateItem(itemId, { progress_done: clamped, progress_total: item.progress_total });
}

/* ---------------- record links ---------------- */

export async function addRecordLink(itemId: string, label: string, url: string): Promise<ActionResult> {
  const session = await householdSession();
  if (!session) return unauthorized();
  const cleanLabel = label.trim().slice(0, 80);
  const cleanUrl = url.trim();
  if (!cleanLabel || !/^https:\/\/\S+$/.test(cleanUrl)) return { ok: false, error: (await getT()).pillar.linkUrl };

  const { error } = await session.supabase.from("record_links").insert({ item_id: itemId, label: cleanLabel, url: cleanUrl });
  if (error) return failure(error.message);
  refresh();
  return { ok: true };
}

export async function deleteRecordLink(id: string): Promise<ActionResult> {
  const session = await householdSession();
  if (!session) return unauthorized();
  const { error } = await session.supabase.from("record_links").delete().eq("id", id);
  if (error) return failure(error.message);
  refresh();
  return { ok: true };
}

/* ---------------- kids: school template ---------------- */

export async function applyTemplate(templateId: string, personId: string, startsOn: string): Promise<ActionResult> {
  const session = await householdSession();
  if (!session) return unauthorized();
  if (!isISODate(startsOn)) return { ok: false, error: (await getT()).form.dateRequired };

  const { data: existing } = await session.supabase
    .from("items")
    .select("id")
    .eq("template_id", templateId)
    .eq("person_id", personId)
    .in("tag", ["pickup", "dropoff"])
    .limit(1);

  // First time for this person: default rides go to whoever is signed in.
  const driver = existing && existing.length > 0 ? null : session.personId;
  const { error } = await session.supabase.rpc("apply_template", {
    p_template: templateId,
    p_person: personId,
    p_starts_on: startsOn,
    p_ends_on: null,
    p_driver: driver,
    p_locale: (await getLocaleValue()) ?? "en",
  });
  if (error) return failure(error.message);

  const t = await getT();
  const { data: person } = await session.supabase.from("people").select("name").eq("id", personId).maybeSingle();
  await logActivity(session.supabase, session.household.id, "kids", t.kids.applied((person?.name as string) ?? "", startsOn));
  refresh();
  return { ok: true };
}

/* ---------------- people + household ---------------- */

export async function savePerson(input: {
  id?: string;
  name: string;
  color: string;
  relation: string;
  birthday?: string | null;
}): Promise<ActionResult<Person>> {
  const session = await householdSession();
  if (!session) return unauthorized();
  const t = await getT();

  const name = input.name.trim().slice(0, 40);
  if (!name) return { ok: false, error: t.form.titleRequired };
  const row = {
    name,
    color: (PALETTE_KEYS as string[]).includes(input.color) ? input.color : "slate",
    relation: isRelation(input.relation) ? input.relation : "other",
    birthday: isISODate(input.birthday) ? input.birthday : null,
  };

  const { data, error } = input.id
    ? await session.supabase.from("people").update(row).eq("id", input.id).select().single()
    : await session.supabase
        .from("people")
        .insert({ ...row, household_id: session.household.id, sort_order: 100 })
        .select()
        .single();
  if (error) return failure(error.message);

  await logActivity(session.supabase, session.household.id, null, input.id ? t.settings.personSaved(name) : t.settings.personAdded(name));
  refresh();
  return { ok: true, data: data as Person };
}

export async function setMyPerson(personId: string): Promise<ActionResult> {
  const session = await householdSession();
  if (!session) return unauthorized();
  const { error } = await session.supabase
    .from("household_members")
    .update({ person_id: personId })
    .eq("household_id", session.household.id)
    .eq("user_id", session.userId);
  if (error) return failure(error.message);
  refresh();
  return { ok: true };
}

export async function saveHousehold(input: { name: string; school_events_url: string }): Promise<ActionResult> {
  const session = await householdSession();
  if (!session) return unauthorized();
  const t = await getT();
  const url = input.school_events_url.trim();
  if (url && !/^https:\/\/\S+$/.test(url)) return { ok: false, error: t.pillar.linkUrl };

  const { error } = await session.supabase
    .from("households")
    .update({ name: input.name.trim().slice(0, 80) || session.household.name, school_events_url: url || null })
    .eq("id", session.household.id);
  if (error) return failure(error.message);
  await logActivity(session.supabase, session.household.id, null, t.settings.householdSaved);
  refresh();
  return { ok: true };
}

export async function invitePartner(email: string): Promise<ActionResult> {
  const session = await householdSession();
  if (!session) return unauthorized();
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return failure("bad email");

  const { error } = await session.supabase
    .from("household_invites")
    .upsert({ household_id: session.household.id, email: clean, invited_by: session.userId }, { onConflict: "household_id,email" });
  if (error) return failure(error.message);
  const t = await getT();
  await logActivity(session.supabase, session.household.id, null, t.settings.inviteSent(clean));
  refresh();
  return { ok: true };
}

/* ---------------- onboarding ---------------- */

export async function createHousehold(name: string, seed: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session.userId) return unauthorized();
  const t = await getT();

  const { data: householdId, error } = await session.supabase.rpc("create_household", { p_name: name });
  if (error || !householdId) return { ok: false, error: `${t.onboarding.failed}: ${error?.message ?? ""}`.trim() };

  await syncPillars(session.supabase, householdId as string);
  if (seed) {
    const { error: seedError } = await session.supabase.rpc("seed_household", {
      p_household: householdId,
      p_locale: (await getLocaleValue()) ?? "en",
    });
    if (seedError) console.error("Seed failed:", seedError.message);
  }
  refresh();
  return { ok: true };
}

export async function acceptInvite(): Promise<boolean> {
  const session = await getSession();
  if (!session.userId) return false;
  const { data } = await session.supabase.rpc("accept_invite");
  return Boolean(data);
}

/* ---------------- language + auth ---------------- */

async function getLocaleValue(): Promise<Locale | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : null;
}

export async function setLocale(locale: string): Promise<ActionResult> {
  if (!isLocale(locale)) return failure("bad locale");
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax" });
  refresh();
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const session = await getSession();
  await session.supabase.auth.signOut();
  redirect("/login");
}

